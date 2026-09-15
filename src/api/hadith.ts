import type { HadithCollectionMeta, HadithItem, HadithSectionMeta, Lang } from '../data/types'
import { getHadithCollection, hadithCollections } from '../data/hadithCatalog'
import { getHadithSectionsStatic } from '../data/hadithSectionsMeta'
import { sectionNameRu } from '../data/hadithSectionsRu'
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
  // isnad.link editions via CDN only (no EN→RU machine translate).
  return col.editions.ru ? `${col.editions.ru}+isnad1` : 'none-isnad1'
}

function sectionsKey(bookId: string, lang: Lang) {
  return `${bookId}:${lang}`
}

function sectionItemsKey(bookId: string, sectionId: string, lang: Lang) {
  const col = getHadithCollection(bookId)
  if (!col) return `${bookId}:${sectionId}:${lang}`
  return `${col.editions.ar}:${translationLabel(col, lang)}:${sectionId}`
}

function textMapFromHadiths(hadiths: ApiHadith[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const h of hadiths) {
    const text = h.text ? normalizeHadithText(h.text) : ''
    if (text) map.set(h.hadithnumber, text)
  }
  return map
}

/** Keep only finished Russian CDN lines (drop empty / English leftovers). */
function ruMapFromCdn(
  arabic: ApiHadith[],
  cdnRu: Map<number, string>,
): Map<number, string> {
  const result = new Map<number, string>()
  for (const h of arabic) {
    const raw = cdnRu.get(h.hadithnumber) || ''
    if (ruTranslationLooksComplete(raw)) result.set(h.hadithnumber, raw)
  }
  return result
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

export type FetchHadithSectionOptions = {
  /** @deprecated No-op — RU uses CDN/isnad only; kept for call-site compat. */
  machineTranslate?: boolean
  /** @deprecated No-op — machine translate removed. */
  translateBatch?: (texts: string[]) => Promise<string[]>
  onPartial?: (items: HadithItem[]) => void
}

function storeSectionItems(key: string, items: HadithItem[]) {
  cacheSet(SECTION_NS, key, items)
}

/** Dedupe concurrent section loads. */
const sectionInflight = new Map<string, Promise<HadithItem[]>>()

/** Limit parallel CDN prefetches so chapter opens stay snappy. */
const warmQueue: Array<() => Promise<unknown>> = []
let warmRunning = 0
const WARM_CONCURRENCY = 6

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

function warmHadithSection(
  bookId: string,
  sectionId: string,
  lang: Lang,
  priority = false,
) {
  if (sectionCached(bookId, sectionId, lang)) return
  warmHadithTask(() => fetchHadithSection(bookId, sectionId, lang), priority)
}

function warmHadithSectionPair(
  bookId: string,
  sectionId: string,
  lang: Lang,
  options?: { priority?: boolean },
) {
  const other: Lang = lang === 'ru' ? 'en' : 'ru'
  const priority = options?.priority ?? false
  warmHadithSection(bookId, sectionId, lang, priority)
  warmHadithSection(bookId, sectionId, other, priority)
}

export async function fetchHadithSection(
  bookId: string,
  sectionId: string,
  lang: Lang,
  options?: FetchHadithSectionOptions,
): Promise<HadithItem[]> {
  const col = getHadithCollection(bookId)
  if (!col) throw new Error('Unknown collection')

  const key = sectionItemsKey(bookId, sectionId, lang)
  const cached = peekHadithSection(bookId, sectionId, lang)
  if (cached) {
    options?.onPartial?.(cached)
    return cached
  }

  const pending = sectionInflight.get(key)
  if (pending) {
    const items = await pending
    options?.onPartial?.(items)
    return items
  }

  const loadPromise = loadHadithSectionItems(
    bookId,
    sectionId,
    lang,
    col,
    key,
    options?.onPartial,
  )
  sectionInflight.set(key, loadPromise)
  try {
    return await loadPromise
  } finally {
    if (sectionInflight.get(key) === loadPromise) {
      sectionInflight.delete(key)
    }
  }
}

async function loadHadithSectionItems(
  bookId: string,
  sectionId: string,
  lang: Lang,
  col: HadithCollectionMeta,
  key: string,
  onPartial?: (items: HadithItem[]) => void,
): Promise<HadithItem[]> {
  const arUrl = `${CDN}/editions/${col.editions.ar}/sections/${sectionId}.min.json`
  const trUrl =
    lang === 'ru'
      ? col.editions.ru
        ? `${CDN}/editions/${col.editions.ru}/sections/${sectionId}.min.json`
        : null
      : `${CDN}/editions/${col.editions.en}/sections/${sectionId}.min.json`

  const [arabic, translation] = await Promise.all([
    fetchJson<SectionPayload>(arUrl),
    trUrl
      ? fetchJson<SectionPayload>(trUrl).catch(() => null)
      : Promise.resolve(null),
  ])

  const arList = arabic.hadiths ?? []
  let textMap: Map<number, string>

  if (lang === 'ru') {
    textMap = ruMapFromCdn(arList, textMapFromHadiths(translation?.hadiths ?? []))
  } else {
    const enRaw = textMapFromHadiths(translation?.hadiths ?? [])
    textMap = resolveEnStubs(
      enRaw,
      arList.map((h) => h.hadithnumber),
    )
  }

  const items = mapHadiths(bookId, arList, textMap)
  onPartial?.(items)
  storeSectionItems(key, items)
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
  storeSectionItems(sectionItemsKey(bookId, sectionId, lang), items)
}

/** Warm both language caches for a chapter (for lang tab switching). */
export function warmHadithSectionBothLangs(bookId: string, sectionId: string) {
  warmHadithSection(bookId, sectionId, 'en')
  warmHadithSection(bookId, sectionId, 'ru')
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
    warmHadithSectionPair(bookId, id, lang)
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
  if (firstId) warmHadithSectionPair(bookId, firstId, lang)
}

/** Prefetch a single chapter's hadiths. */
export function prefetchHadithSection(
  bookId: string,
  sectionId: string,
  lang: Lang,
) {
  warmHadithTask(() => fetchHadithSections(bookId, lang))
  warmHadithTask(() => fetchHadithSections(bookId, lang === 'ru' ? 'en' : 'ru'))
  warmHadithSectionPair(bookId, sectionId, lang, { priority: true })
}

/** Prefetch the first few chapters after opening a book. */
export function prefetchHadithBookSections(
  bookId: string,
  lang: Lang,
  sectionIds: string[],
  count = 14,
) {
  for (const id of sectionIds.slice(0, count)) {
    warmHadithSectionPair(bookId, id, lang)
  }
}

/**
 * Idle batch: warm a bounded set of CDN sections (focus chapter first).
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
