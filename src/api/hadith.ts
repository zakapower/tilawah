import type { HadithCollectionMeta, HadithItem, HadithSectionMeta, Lang } from '../data/types'
import { getHadithCollection, hadithCollections } from '../data/hadithCatalog'
import { getHadithSectionsStatic } from '../data/hadithSectionsMeta'
import { sectionNameRu } from '../data/hadithSectionsRu'
import { translateEnToRuMany } from '../lib/translateEnRu'
import { cacheGet, cacheSet } from '../utils/pageCache'
import { normalizeHadithText, ruTranslationLooksComplete } from '../utils/hadithText'

const CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1'

type ApiHadith = {
  hadithnumber: number
  arabicnumber?: number
  text: string
  reference?: { book: number; hadith: number }
}

type SectionPayload = {
  metadata?: {
    name?: string
    section?: Record<string, string>
  }
  hadiths: ApiHadith[]
}

const SECTIONS_NS = 'hadith-sections'
const SECTION_NS = 'hadith-section'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'force-cache', ...init })
  if (!res.ok) throw new Error(`Failed to load ${url}`)
  return (await res.json()) as T
}

/** Cache label — bump when RU source strategy changes. */
function translationLabel(col: HadithCollectionMeta, lang: Lang) {
  if (lang !== 'ru') return col.editions.en
  if (col.editions.ru) return `${col.editions.ru}+enmt4`
  return 'enmt4'
}

function sectionsKey(bookId: string, lang: Lang) {
  return `${bookId}:${lang}`
}

function sectionItemsKey(bookId: string, sectionId: string, lang: Lang) {
  const col = getHadithCollection(bookId)
  if (!col) return `${bookId}:${sectionId}:${lang}`
  return `${col.editions.ar}:${translationLabel(col, lang)}:${sectionId}`
}

/**
 * CDN Russian when present; empty slots filled by EN→RU machine translate.
 * No i-muslim — EN→RU is preferred for missing RU lines.
 */
async function buildRuMap(
  arabic: ApiHadith[],
  primary: Map<number, string>,
  enMap: Map<number, string>,
  translateBatch?: (texts: string[]) => Promise<string[]>,
  onProgress?: (map: Map<number, string>) => void,
): Promise<Map<number, string>> {
  const result = new Map<number, string>()
  for (const h of arabic) {
    const n = h.hadithnumber
    const raw = primary.get(n) || ''
    if (ruTranslationLooksComplete(raw)) result.set(n, raw)
  }

  if (!translateBatch) return result

  const missing: Array<{ n: number; en: string }> = []
  for (const h of arabic) {
    if (result.has(h.hadithnumber)) continue
    const en = enMap.get(h.hadithnumber)
    if (en) missing.push({ n: h.hadithnumber, en })
  }
  if (missing.length === 0) return result

  // Keep batches under the translate API char limit (~12k) and item cap.
  const MAX_ITEMS = 24
  const MAX_CHARS = 10000
  let i = 0
  while (i < missing.length) {
    const chunk: Array<{ n: number; en: string }> = []
    let chars = 0
    while (i < missing.length && chunk.length < MAX_ITEMS) {
      const next = missing[i]
      if (chunk.length > 0 && chars + next.en.length > MAX_CHARS) break
      chunk.push(next)
      chars += next.en.length
      i++
    }
    let translated = await translateBatch(chunk.map((c) => c.en))
    // One retry for empty / non-RU slots (transient API / gtx failures).
    const retryIdx: number[] = []
    for (let j = 0; j < chunk.length; j++) {
      const ru = normalizeHadithText(translated[j] || '')
      if (!ru || !ruTranslationLooksComplete(ru)) retryIdx.push(j)
    }
    if (retryIdx.length > 0) {
      const retried = await translateBatch(retryIdx.map((j) => chunk[j].en))
      for (let k = 0; k < retryIdx.length; k++) {
        translated[retryIdx[k]] = retried[k] || translated[retryIdx[k]] || ''
      }
    }
    for (let j = 0; j < chunk.length; j++) {
      const ru = normalizeHadithText(translated[j] || '')
      if (ru && ruTranslationLooksComplete(ru)) result.set(chunk[j].n, ru)
    }
    onProgress?.(new Map(result))
  }
  return result
}

function textMapFromHadiths(hadiths: ApiHadith[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const h of hadiths) {
    const text = h.text ? normalizeHadithText(h.text) : ''
    if (text) map.set(h.hadithnumber, text)
  }
  return map
}

/** Expand CDN stubs like "Narrated Anas: as above" using the previous real text. */
function resolveEnStubs(enMap: Map<number, string>, order: number[]): Map<number, string> {
  const out = new Map(enMap)
  const stubRe =
    /^(?:narrated\s+[\s\S]{0,80}?:?\s*)?(?:as above|the same hadith|the above hadith|mentioned above)\.?$/i
  let lastFull = ''
  for (const n of order) {
    const raw = (out.get(n) || '').trim()
    if (!raw) continue
    if (stubRe.test(raw) || (/\bas above\b/i.test(raw) && raw.length < 80)) {
      if (lastFull) out.set(n, lastFull)
      continue
    }
    lastFull = raw
  }
  return out
}

export function peekHadithSections(
  bookId: string,
  lang: Lang = 'en',
): HadithSectionMeta[] | null {
  return cacheGet<HadithSectionMeta[]>(SECTIONS_NS, sectionsKey(bookId, lang))
}

export function peekHadithSection(
  bookId: string,
  sectionId: string,
  lang: Lang,
): HadithItem[] | null {
  return cacheGet<HadithItem[]>(SECTION_NS, sectionItemsKey(bookId, sectionId, lang))
}

function buildHadithSections(bookId: string, lang: Lang): HadithSectionMeta[] {
  const col = getHadithCollection(bookId)
  if (!col) throw new Error('Unknown collection')

  const staticSections = getHadithSectionsStatic(col.apiBook)
  if (!staticSections) throw new Error('Unknown collection')

  return staticSections.map((s) => {
    const count =
      s.hadithLast >= s.hadithFirst && s.hadithFirst > 0
        ? s.hadithLast - s.hadithFirst + 1
        : 0
    return {
      id: s.id,
      number: s.number,
      name: lang === 'ru' ? sectionNameRu(bookId, s.id, s.en) : s.en,
      hadithFirst: s.hadithFirst,
      hadithLast: s.hadithLast,
      count,
    }
  })
}

export async function fetchHadithSections(
  bookId: string,
  lang: Lang = 'en',
): Promise<HadithSectionMeta[]> {
  const key = sectionsKey(bookId, lang)
  const cached = peekHadithSections(bookId, lang)
  if (cached) return cached

  const list = buildHadithSections(bookId, lang)
  cacheSet(SECTIONS_NS, key, list)
  return list
}

function mapHadiths(
  bookId: string,
  arabic: ApiHadith[],
  translations: Map<number, string>,
): HadithItem[] {
  return arabic
    .map((ar) => {
      const n = ar.hadithnumber
      const arabicText = ar.text ? normalizeHadithText(ar.text) : undefined
      const text = translations.get(n) ?? ''
      return {
        id: `${bookId}-${n}`,
        number: n,
        arabic: arabicText || undefined,
        text,
        reference: ar.reference,
      }
    })
    .filter((h) => h.text || h.arabic)
}

/** Patch RU text slots during MT without re-normalizing Arabic. */
function applyRuMapToItems(
  items: HadithItem[],
  ruMap: Map<number, string>,
): HadithItem[] {
  let changed = false
  const next = items.map((h) => {
    const text = ruMap.get(h.number)
    if (!text || text === h.text) return h
    changed = true
    return { ...h, text }
  })
  return changed ? next : items
}

export type FetchHadithSectionOptions = {
  translateBatch?: (texts: string[]) => Promise<string[]>
  /** When false, skip EN→RU machine translate (fast path / prefetch). Default true. */
  machineTranslate?: boolean
  /** Called after CDN texts are ready, before machine translate finishes. */
  onPartial?: (items: HadithItem[]) => void
}

function sectionNeedsRuBackfill(items: HadithItem[]) {
  return items.some((h) => !ruTranslationLooksComplete(h.text))
}

function shouldPersistSection(
  lang: Lang,
  items: HadithItem[],
  machineTranslate: boolean,
) {
  if (lang !== 'ru') return true
  if (!machineTranslate) return false
  return !sectionNeedsRuBackfill(items)
}

/** Keep any already-translated lines when a slower shell fetch finishes later. */
function mergeRuPreferComplete(
  incoming: HadithItem[],
  existing: HadithItem[] | null,
): HadithItem[] {
  if (!existing?.length) return incoming
  const prevByNumber = new Map(existing.map((h) => [h.number, h]))
  return incoming.map((h) => {
    if (ruTranslationLooksComplete(h.text)) return h
    const prev = prevByNumber.get(h.number)
    if (prev && ruTranslationLooksComplete(prev.text)) {
      return { ...h, text: prev.text }
    }
    return h
  })
}

function storeSectionItems(
  key: string,
  items: HadithItem[],
  lang: Lang,
  machineTranslate: boolean,
  options?: { persist?: boolean },
) {
  const existing = cacheGet<HadithItem[]>(SECTION_NS, key)
  let next = items
  if (lang === 'ru') {
    next = mergeRuPreferComplete(items, existing)
    // Never let a fast shell / partial overwrite a finished RU section.
    if (
      existing &&
      !sectionNeedsRuBackfill(existing) &&
      sectionNeedsRuBackfill(next)
    ) {
      return
    }
  }
  cacheSet(SECTION_NS, key, next, {
    persist:
      options?.persist ??
      shouldPersistSection(lang, next, machineTranslate),
  })
}

export function hadithSectionNeedsRuBackfill(items: HadithItem[]) {
  return sectionNeedsRuBackfill(items)
}

/** Dedupe concurrent section loads (shell vs full MT must not clobber each other). */
const sectionInflight = new Map<string, Promise<HadithItem[]>>()

/** Limit parallel CDN prefetches so chapter opens stay snappy. */
const warmQueue: Array<() => Promise<unknown>> = []
let warmRunning = 0
const WARM_CONCURRENCY = 3

function drainWarmQueue() {
  while (warmRunning < WARM_CONCURRENCY && warmQueue.length > 0) {
    const task = warmQueue.shift()!
    warmRunning += 1
    void task()
      .catch(() => {})
      .finally(() => {
        warmRunning -= 1
        drainWarmQueue()
      })
  }
}

function warmHadithTask(task: () => Promise<unknown>, priority = false) {
  if (priority) warmQueue.unshift(task)
  else warmQueue.push(task)
  drainWarmQueue()
}

function sectionCached(bookId: string, sectionId: string, lang: Lang) {
  return Boolean(peekHadithSection(bookId, sectionId, lang))
}

/** CDN shell only — instant chapter open; MT runs separately when needed. */
function warmHadithSectionShell(
  bookId: string,
  sectionId: string,
  lang: Lang,
  priority = false,
) {
  if (sectionCached(bookId, sectionId, lang)) return
  warmHadithTask(
    () => fetchHadithSection(bookId, sectionId, lang, { machineTranslate: false }),
    priority,
  )
}

/** Full RU backfill after shell is warm. */
function warmHadithSectionMt(bookId: string, sectionId: string, priority = false) {
  const cached = peekHadithSection(bookId, sectionId, 'ru')
  if (cached && !sectionNeedsRuBackfill(cached)) return
  warmHadithTask(() => fetchHadithSection(bookId, sectionId, 'ru'), priority)
}

function warmHadithSectionPair(
  bookId: string,
  sectionId: string,
  lang: Lang,
  options?: { mt?: boolean; priority?: boolean },
) {
  const other: Lang = lang === 'ru' ? 'en' : 'ru'
  const priority = options?.priority ?? false
  warmHadithSectionShell(bookId, sectionId, lang, priority)
  warmHadithSectionShell(bookId, sectionId, other, priority)
  if (options?.mt && lang === 'ru') warmHadithSectionMt(bookId, sectionId, priority)
}

export async function fetchHadithSection(
  bookId: string,
  sectionId: string,
  lang: Lang,
  options?: FetchHadithSectionOptions,
): Promise<HadithItem[]> {
  const col = getHadithCollection(bookId)
  if (!col) throw new Error('Unknown collection')

  const machineTranslate = options?.machineTranslate !== false
  const translateBatch =
    lang === 'ru' && machineTranslate
      ? (options?.translateBatch ?? translateEnToRuMany)
      : undefined

  const key = sectionItemsKey(bookId, sectionId, lang)
  const cached = peekHadithSection(bookId, sectionId, lang)
  if (cached) {
    options?.onPartial?.(cached)
    if (
      lang !== 'ru' ||
      !translateBatch ||
      !sectionNeedsRuBackfill(cached)
    ) {
      return cached
    }
    // Fall through: refresh from sources and fill RU gaps with MT.
  }

  const inflightKey = `${key}|mt:${translateBatch ? 1 : 0}`
  const pending = sectionInflight.get(inflightKey)
  if (pending) {
    const items = await pending
    options?.onPartial?.(items)
    return items
  }

  // If a full RU fill is already running, reuse it even for shell requests.
  if (!translateBatch && lang === 'ru') {
    const fullPending = sectionInflight.get(`${key}|mt:1`)
    if (fullPending) {
      const items = await fullPending
      options?.onPartial?.(items)
      return items
    }
  }

  // Wait for an in-flight shell before starting MT, then reuse its cache.
  if (translateBatch && lang === 'ru') {
    const shellPending = sectionInflight.get(`${key}|mt:0`)
    if (shellPending) {
      await shellPending
      const afterShell = peekHadithSection(bookId, sectionId, lang)
      if (afterShell) {
        options?.onPartial?.(afterShell)
        if (!sectionNeedsRuBackfill(afterShell)) return afterShell
      }
    }
  }

  const loadPromise = loadHadithSectionItems(
    bookId,
    sectionId,
    lang,
    col,
    key,
    machineTranslate,
    translateBatch,
    options?.onPartial,
  )
  sectionInflight.set(inflightKey, loadPromise)
  try {
    return await loadPromise
  } finally {
    if (sectionInflight.get(inflightKey) === loadPromise) {
      sectionInflight.delete(inflightKey)
    }
  }
}

async function loadHadithSectionItems(
  bookId: string,
  sectionId: string,
  lang: Lang,
  col: HadithCollectionMeta,
  key: string,
  machineTranslate: boolean,
  translateBatch: ((texts: string[]) => Promise<string[]>) | undefined,
  onPartial?: (items: HadithItem[]) => void,
): Promise<HadithItem[]> {
  const arUrl = `${CDN}/editions/${col.editions.ar}/sections/${sectionId}.min.json`
  const enUrl = `${CDN}/editions/${col.editions.en}/sections/${sectionId}.min.json`

  let items: HadithItem[]

  if (lang === 'ru') {
    const fetches: [
      Promise<SectionPayload>,
      Promise<SectionPayload>,
      Promise<SectionPayload | null>,
    ] = [
      fetchJson<SectionPayload>(arUrl),
      fetchJson<SectionPayload>(enUrl),
      col.editions.ru
        ? fetchJson<SectionPayload>(
            `${CDN}/editions/${col.editions.ru}/sections/${sectionId}.min.json`,
          )
        : Promise.resolve(null),
    ]
    const [arabic, english, russian] = await Promise.all(fetches)
    const arList = arabic.hadiths ?? []
    const enRaw = textMapFromHadiths(english.hadiths ?? [])
    const enMap = resolveEnStubs(
      enRaw,
      arList.map((h) => h.hadithnumber),
    )
    const cdnRu = textMapFromHadiths(russian?.hadiths ?? [])
    const primary = await buildRuMap(arList, cdnRu, enMap, undefined)
    items = mapHadiths(bookId, arList, primary)
    storeSectionItems(key, items, lang, machineTranslate)
    onPartial?.(peekHadithSection(bookId, sectionId, lang) ?? items)

    if (translateBatch) {
      const shellItems = items
      const ruMap = await buildRuMap(
        arList,
        primary,
        enMap,
        translateBatch,
        (partial) => {
          const partialItems = applyRuMapToItems(shellItems, partial)
          if (partialItems === shellItems) return
          storeSectionItems(key, partialItems, lang, true, { persist: false })
          onPartial?.(partialItems)
        },
      )
      items = mapHadiths(bookId, arList, ruMap)
      // Second pass for anything still empty after transient failures.
      if ([...arList].some((h) => !ruTranslationLooksComplete(ruMap.get(h.hadithnumber) || ''))) {
        const again = await buildRuMap(arList, ruMap, enMap, translateBatch)
        items = mapHadiths(bookId, arList, again)
      }
    }
  } else {
    const [arabic, translation] = await Promise.all([
      fetchJson<SectionPayload>(arUrl),
      fetchJson<SectionPayload>(enUrl),
    ])
    items = mapHadiths(
      bookId,
      arabic.hadiths ?? [],
      textMapFromHadiths(translation.hadiths ?? []),
    )
    onPartial?.(items)
  }

  storeSectionItems(key, items, lang, machineTranslate)
  return peekHadithSection(bookId, sectionId, lang) ?? items
}

export function seedHadithSections(
  bookId: string,
  lang: Lang,
  sections: HadithSectionMeta[],
) {
  cacheSet(SECTIONS_NS, sectionsKey(bookId, lang), sections)
}

export function seedHadithSection(
  bookId: string,
  sectionId: string,
  lang: Lang,
  items: HadithItem[],
) {
  const key = sectionItemsKey(bookId, sectionId, lang)
  // Merge through store guard so SSG/shell seeds cannot wipe filled RU.
  storeSectionItems(key, items, lang, lang === 'ru' ? false : true)
}

/** Warm both language caches for a chapter (for lang tab switching). */
export function warmHadithSectionBothLangs(bookId: string, sectionId: string) {
  warmHadithSectionShell(bookId, sectionId, 'en')
  warmHadithSectionShell(bookId, sectionId, 'ru')
  warmHadithSectionMt(bookId, sectionId)
}

/** Prefetch adjacent hadith chapters in both languages (fast nav / lang switch). */
export function prefetchNearbyHadithSections(
  bookId: string,
  sectionId: string,
  lang: Lang,
  sectionIds: string[],
) {
  const idx = sectionIds.indexOf(sectionId)
  if (idx < 0) return
  const neighbors = sectionIds.slice(Math.max(0, idx - 2), idx + 3)
  for (const id of neighbors) {
    if (id === sectionId) continue
    const isForward = sectionIds.indexOf(id) > idx
    warmHadithSectionPair(bookId, id, lang, { mt: lang === 'ru' && isForward })
  }
}

let catalogWarmStarted = false

/** Seed caches for all collections on the hadith list page. */
export function warmHadithCatalog() {
  if (catalogWarmStarted) return
  catalogWarmStarted = true
  for (const book of hadithCollections) {
    warmHadithTask(() => fetchHadithSections(book.id, 'ru'))
    warmHadithTask(() => fetchHadithSections(book.id, 'en'))
    const sections = getHadithSectionsStatic(book.apiBook)
    const firstId = sections?.[0]?.id
    if (firstId) warmHadithSectionPair(book.id, firstId, 'ru')
  }
}

/** Prefetch chapter list for a collection. */
export function prefetchHadithBook(bookId: string, lang: Lang) {
  warmHadithTask(() => fetchHadithSections(bookId, lang))
  const other: Lang = lang === 'ru' ? 'en' : 'ru'
  warmHadithTask(() => fetchHadithSections(bookId, other))
  const col = getHadithCollection(bookId)
  if (!col) return
  const sections = getHadithSectionsStatic(col.apiBook)
  const firstId = sections?.[0]?.id
  if (firstId) warmHadithSectionPair(bookId, firstId, lang, { mt: lang === 'ru' })
}

/** Prefetch a single chapter's hadiths (shell first, MT in background for RU). */
export function prefetchHadithSection(
  bookId: string,
  sectionId: string,
  lang: Lang,
) {
  warmHadithTask(() => fetchHadithSections(bookId, lang))
  warmHadithTask(() => fetchHadithSections(bookId, lang === 'ru' ? 'en' : 'ru'))
  warmHadithSectionPair(bookId, sectionId, lang, { mt: lang === 'ru', priority: true })
}

/** Prefetch the first few chapters after opening a book. */
export function prefetchHadithBookSections(
  bookId: string,
  lang: Lang,
  sectionIds: string[],
  count = 8,
) {
  for (const [i, id] of sectionIds.slice(0, count).entries()) {
    warmHadithSectionPair(bookId, id, lang, { mt: lang === 'ru' && i === 0 })
  }
}

/**
 * Idle batch: warm a bounded set of CDN shells (focus chapter first).
 * Avoid stampeding all ~100 Bukhari chapters at once.
 */
export function warmHadithBookSectionsIdle(
  bookId: string,
  lang: Lang,
  sectionIds: string[],
  options?: { focusId?: string | null; max?: number },
) {
  const max = options?.max ?? 14
  const focusId = options?.focusId ?? null
  const ordered: string[] = []
  const seen = new Set<string>()
  const push = (id: string | undefined) => {
    if (!id || seen.has(id)) return
    seen.add(id)
    ordered.push(id)
  }

  if (focusId) {
    const idx = sectionIds.indexOf(focusId)
    if (idx >= 0) {
      for (let d = 0; d < sectionIds.length; d += 1) {
        if (idx - d >= 0) push(sectionIds[idx - d])
        if (d > 0 && idx + d < sectionIds.length) push(sectionIds[idx + d])
      }
    }
  }
  for (const id of sectionIds) push(id)

  let queued = 0
  for (const id of ordered) {
    if (queued >= max) break
    if (sectionCached(bookId, id, lang)) continue
    warmHadithSectionPair(bookId, id, lang)
    queued += 1
  }
}
