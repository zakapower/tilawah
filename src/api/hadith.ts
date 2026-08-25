import type { HadithCollectionMeta, HadithItem, HadithSectionMeta, Lang } from '../data/types'
import { getHadithCollection, hadithCollections } from '../data/hadithCatalog'
import { getHadithSectionsStatic } from '../data/hadithSectionsMeta'
import { sectionNameRu } from '../data/hadithSectionsRu'
import { translateEnToRuMany } from '../lib/translateEnRu'
import { cacheGet, cacheSet, warmCache } from '../utils/pageCache'
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
  if (col.editions.ru) return `${col.editions.ru}+enmt1`
  return 'enmt1'
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

  const BATCH = 40
  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH)
    const translated = await translateBatch(chunk.map((c) => c.en))
    for (let j = 0; j < chunk.length; j++) {
      const ru = normalizeHadithText(translated[j] || '')
      if (ru) result.set(chunk[j].n, ru)
    }
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

function storeSectionItems(
  key: string,
  items: HadithItem[],
  lang: Lang,
  machineTranslate: boolean,
) {
  cacheSet(SECTION_NS, key, items, {
    persist: shouldPersistSection(lang, items, machineTranslate),
  })
}

export function hadithSectionNeedsRuBackfill(items: HadithItem[]) {
  return sectionNeedsRuBackfill(items)
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
    const enMap = textMapFromHadiths(english.hadiths ?? [])
    const cdnRu = textMapFromHadiths(russian?.hadiths ?? [])
    const primary = await buildRuMap(arList, cdnRu, enMap, undefined)
    items = mapHadiths(bookId, arList, primary)
    storeSectionItems(key, items, lang, machineTranslate)
    options?.onPartial?.(items)

    if (translateBatch) {
      const ruMap = await buildRuMap(arList, primary, enMap, translateBatch)
      items = mapHadiths(bookId, arList, ruMap)
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
    options?.onPartial?.(items)
  }

  storeSectionItems(key, items, lang, machineTranslate)
  return items
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
  cacheSet(SECTION_NS, sectionItemsKey(bookId, sectionId, lang), items)
}

/** Warm both language caches for a chapter (for lang tab switching). */
export function warmHadithSectionBothLangs(bookId: string, sectionId: string) {
  // Fast shells first, then RU MT fill so the chapter paints sooner.
  warmCache(() =>
    fetchHadithSection(bookId, sectionId, 'en', { machineTranslate: false }),
  )
  warmCache(() =>
    fetchHadithSection(bookId, sectionId, 'ru', { machineTranslate: false }),
  )
  warmCache(() => fetchHadithSection(bookId, sectionId, 'ru'))
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
  const nearby = [sectionIds[idx - 1], sectionIds[idx + 1]].filter(Boolean)
  const other: Lang = lang === 'ru' ? 'en' : 'ru'
  for (const id of nearby) {
    warmCache(() =>
      fetchHadithSection(bookId, id, lang, { machineTranslate: false }),
    )
    warmCache(() =>
      fetchHadithSection(bookId, id, other, { machineTranslate: false }),
    )
  }
}

/** Seed caches for all collections on the hadith list page. */
export function warmHadithCatalog() {
  for (const book of hadithCollections) {
    warmCache(() => fetchHadithSections(book.id, 'ru'))
    warmCache(() => fetchHadithSections(book.id, 'en'))
  }
}

/** Prefetch chapter list for a collection. */
export function prefetchHadithBook(bookId: string, lang: Lang) {
  warmCache(() => fetchHadithSections(bookId, lang))
  const other: Lang = lang === 'ru' ? 'en' : 'ru'
  warmCache(() => fetchHadithSections(bookId, other))
}

/** Prefetch a single chapter's hadiths. */
export function prefetchHadithSection(
  bookId: string,
  sectionId: string,
  lang: Lang,
) {
  warmCache(async () => {
    await fetchHadithSections(bookId, lang)
    await fetchHadithSection(bookId, sectionId, lang, {
      machineTranslate: false,
    })
  })
  const other: Lang = lang === 'ru' ? 'en' : 'ru'
  warmCache(async () => {
    await fetchHadithSections(bookId, other)
    await fetchHadithSection(bookId, sectionId, other, {
      machineTranslate: false,
    })
  })
}

/** Prefetch the first few chapters after opening a book. */
export function prefetchHadithBookSections(
  bookId: string,
  lang: Lang,
  sectionIds: string[],
  count = 6,
) {
  const other: Lang = lang === 'ru' ? 'en' : 'ru'
  for (const [i, id] of sectionIds.slice(0, count).entries()) {
    warmCache(() =>
      fetchHadithSection(bookId, id, lang, { machineTranslate: false }),
    )
    warmCache(() =>
      fetchHadithSection(bookId, id, other, { machineTranslate: false }),
    )
    // First chapter: finish RU MT in the background for a warm open.
    if (i === 0) {
      warmCache(() => fetchHadithSection(bookId, id, 'ru'))
    }
  }
}
