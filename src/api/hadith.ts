import type { HadithCollectionMeta, HadithItem, HadithSectionMeta, Lang } from '../data/types'
import { getHadithCollection, hadithCollections } from '../data/hadithCatalog'
import { getHadithSectionsStatic } from '../data/hadithSectionsMeta'
import { sectionNameRu } from '../data/hadithSectionsRu'
import { translateEnToRuMany } from '../lib/translateEnRu'
import { cacheGet, cacheSet, warmCache } from '../utils/pageCache'
import { normalizeHadithText } from '../utils/hadithText'

const CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1'
const IMUSLIM = 'https://i-muslim.com/api/v1/translations/hadith'

/** CDN has no rus-* — use i-muslim CC0 Russian as primary translation. */
const IMUSLIM_PRIMARY_RU = new Set(['tirmidhi', 'nasai', 'ibnmajah'])
/** CDN rus-* has gaps; fill empty slots from i-muslim authored Russian. */
const IMUSLIM_GAP_RU = new Set(['abudawud'])

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

type ImuslimPayload = {
  data?: {
    items?: Array<{
      number: number
      text: string | null
      source?: string
    }>
  }
}

const SECTIONS_NS = 'hadith-sections'
const SECTION_NS = 'hadith-section'
const IMUSLIM_NS = 'imuslim-ru'

const imuslimMaps = new Map<string, Map<number, string>>()
const imuslimPromises = new Map<string, Promise<Map<number, string>>>()

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'force-cache', ...init })
  if (!res.ok) throw new Error(`Failed to load ${url}`)
  return (await res.json()) as T
}

function translationLabel(col: HadithCollectionMeta, lang: Lang) {
  if (lang !== 'ru') return col.editions.en
  if (col.editions.ru) {
    const gap = IMUSLIM_GAP_RU.has(col.id) ? '+imuslim' : ''
    return `${col.editions.ru}${gap}+mtfill2`
  }
  if (IMUSLIM_PRIMARY_RU.has(col.id)) return 'imuslim-ru+mtfill2'
  return col.editions.en
}

function sectionsKey(bookId: string, lang: Lang) {
  return `${bookId}:${lang}`
}

function sectionItemsKey(bookId: string, sectionId: string, lang: Lang) {
  const col = getHadithCollection(bookId)
  if (!col) return `${bookId}:${sectionId}:${lang}`
  return `${col.editions.ar}:${translationLabel(col, lang)}:${sectionId}`
}

async function getImuslimRuMap(bookId: string): Promise<Map<number, string>> {
  const cachedMap = imuslimMaps.get(bookId)
  if (cachedMap) return cachedMap

  const fromStore = cacheGet<Array<[number, string]>>(IMUSLIM_NS, bookId)
  if (fromStore) {
    const map = new Map(fromStore)
    imuslimMaps.set(bookId, map)
    return map
  }

  let pending = imuslimPromises.get(bookId)
  if (!pending) {
    pending = fetchJson<ImuslimPayload>(`${IMUSLIM}/${bookId}/ru`, {
      cache: 'force-cache',
    }).then((payload) => {
      const map = new Map<number, string>()
      for (const item of payload.data?.items ?? []) {
        const raw = item.text?.trim()
        if (!raw) continue
        map.set(item.number, normalizeHadithText(raw))
      }
      imuslimMaps.set(bookId, map)
      cacheSet(IMUSLIM_NS, bookId, [...map.entries()])
      return map
    })
    imuslimPromises.set(bookId, pending)
  }
  return pending
}


async function buildRuMap(
  arabic: ApiHadith[],
  primary: Map<number, string>,
  enMap: Map<number, string>,
  imuslim?: Map<number, string>,
  translateBatch?: (texts: string[]) => Promise<string[]>,
): Promise<Map<number, string>> {
  // Only numbers from this Arabic section — never the whole-book imuslim map.
  const result = new Map<number, string>()
  for (const h of arabic) {
    const n = h.hadithnumber
    const text = primary.get(n) || imuslim?.get(n) || ''
    if (text) result.set(n, text)
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
  /** Called after CDN/i-muslim texts are ready, before machine translate finishes. */
  onPartial?: (items: HadithItem[]) => void
}

function sectionHasTranslationGaps(items: HadithItem[]) {
  return items.some((h) => !h.text)
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
      !sectionHasTranslationGaps(cached)
    ) {
      return cached
    }
    // Fall through: refresh from sources and fill RU gaps with MT.
  }

  const arUrl = `${CDN}/editions/${col.editions.ar}/sections/${sectionId}.min.json`
  const enUrl = `${CDN}/editions/${col.editions.en}/sections/${sectionId}.min.json`

  let items: HadithItem[]

  if (lang === 'ru' && col.editions.ru) {
    const ruUrl = `${CDN}/editions/${col.editions.ru}/sections/${sectionId}.min.json`
    const needImuslim = IMUSLIM_GAP_RU.has(bookId)
    const [arabic, russian, english, imuslim] = await Promise.all([
      fetchJson<SectionPayload>(arUrl),
      fetchJson<SectionPayload>(ruUrl),
      fetchJson<SectionPayload>(enUrl),
      needImuslim ? getImuslimRuMap(bookId) : Promise.resolve(undefined),
    ])
    const arList = arabic.hadiths ?? []
    const enMap = textMapFromHadiths(english.hadiths ?? [])
    const primary = await buildRuMap(
      arList,
      textMapFromHadiths(russian.hadiths ?? []),
      enMap,
      imuslim,
      undefined,
    )
    items = mapHadiths(bookId, arList, primary)
    cacheSet(SECTION_NS, key, items)
    options?.onPartial?.(items)

    if (translateBatch) {
      const ruMap = await buildRuMap(
        arList,
        primary,
        enMap,
        undefined,
        translateBatch,
      )
      items = mapHadiths(bookId, arList, ruMap)
    }
  } else if (lang === 'ru' && IMUSLIM_PRIMARY_RU.has(bookId)) {
    const [arabic, english, imuslim] = await Promise.all([
      fetchJson<SectionPayload>(arUrl),
      fetchJson<SectionPayload>(enUrl),
      getImuslimRuMap(bookId),
    ])
    const arList = arabic.hadiths ?? []
    const enMap = textMapFromHadiths(english.hadiths ?? [])
    const primary = await buildRuMap(arList, imuslim, enMap, undefined, undefined)
    items = mapHadiths(bookId, arList, primary)
    cacheSet(SECTION_NS, key, items)
    options?.onPartial?.(items)

    if (translateBatch) {
      const ruMap = await buildRuMap(
        arList,
        primary,
        enMap,
        undefined,
        translateBatch,
      )
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

  cacheSet(SECTION_NS, key, items)
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

/** Prefetch adjacent hadith chapters. */
export function prefetchNearbyHadithSections(
  bookId: string,
  sectionId: string,
  lang: Lang,
  sectionIds: string[],
) {
  const idx = sectionIds.indexOf(sectionId)
  if (idx < 0) return
  const prev = sectionIds[idx - 1]
  const next = sectionIds[idx + 1]
  if (prev) {
    warmCache(() =>
      fetchHadithSection(bookId, prev, lang, { machineTranslate: false }),
    )
  }
  if (next) {
    warmCache(() =>
      fetchHadithSection(bookId, next, lang, { machineTranslate: false }),
    )
  }
}

/** Seed caches for all collections on the hadith list page. */
export function warmHadithCatalog() {
  for (const book of hadithCollections) {
    warmCache(() => fetchHadithSections(book.id, 'ru'))
    warmImuslimRu(book.id)
  }
}

/** Warm Russian translation map for books that rely on i-muslim. */
export function warmImuslimRu(bookId: string) {
  if (!IMUSLIM_PRIMARY_RU.has(bookId) && !IMUSLIM_GAP_RU.has(bookId)) return
  warmCache(() => getImuslimRuMap(bookId))
}

/** Prefetch chapter list for a collection. */
export function prefetchHadithBook(bookId: string, lang: Lang) {
  warmCache(() => fetchHadithSections(bookId, lang))
  warmImuslimRu(bookId)
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
}

/** Prefetch the first few chapters after opening a book. */
export function prefetchHadithBookSections(
  bookId: string,
  lang: Lang,
  sectionIds: string[],
  count = 4,
) {
  warmImuslimRu(bookId)
  for (const id of sectionIds.slice(0, count)) {
    warmCache(() =>
      fetchHadithSection(bookId, id, lang, { machineTranslate: false }),
    )
  }
}
