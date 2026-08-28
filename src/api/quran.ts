import type { Ayah, SurahContent } from '../data/types'
import { getSurahMeta } from '../data/surahList'
import { cacheGet, cacheSet, warmCache } from '../utils/pageCache'

const CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions'

const ARABIC_EDITION = 'ara-quranuthmanihaf'
const TRANSLATION = {
  ru: 'rus-elmirkuliev',
  en: 'eng-ummmuhammad',
} as const

const CACHE_NS = 'surah'

type CdnChapter = {
  chapter: Array<{ chapter: number; verse: number; text: string }>
}

function cacheKey(number: number, lang: 'ru' | 'en') {
  return `${number}:${lang}`
}

function toAyahs(rows: CdnChapter['chapter']): Ayah[] {
  return rows.map((row) => ({
    number: row.chapter * 1000 + row.verse,
    numberInSurah: row.verse,
    text: row.text,
  }))
}

async function fetchCdnChapter(edition: string, number: number) {
  const res = await fetch(`${CDN}/${edition}/${number}.min.json`, {
    cache: 'force-cache',
  })
  if (!res.ok) throw new Error(`Failed to load ${edition}/${number}`)
  return (await res.json()) as CdnChapter
}

/** Sync peek — avoid skeleton flash when revisiting a surah. */
export function peekSurah(
  number: number,
  lang: 'ru' | 'en',
): SurahContent | null {
  return cacheGet<SurahContent>(CACHE_NS, cacheKey(number, lang))
}

export async function fetchSurah(
  number: number,
  lang: 'ru' | 'en',
): Promise<SurahContent> {
  const key = cacheKey(number, lang)
  const cached = peekSurah(number, lang)
  if (cached) return cached

  const meta = getSurahMeta(number)
  if (!meta) throw new Error('Surah not found')

  const translationEdition = TRANSLATION[lang]
  const [arabic, translation] = await Promise.all([
    fetchCdnChapter(ARABIC_EDITION, number),
    fetchCdnChapter(translationEdition, number),
  ])

  const content: SurahContent = {
    number: meta.number,
    name: meta.name,
    englishName: meta.englishName,
    englishNameTranslation: meta.englishNameTranslation,
    ayahsArabic: toAyahs(arabic.chapter),
    ayahsTranslation: toAyahs(translation.chapter),
  }

  cacheSet(CACHE_NS, key, content)
  return content
}

/** Warm client/server memory cache (e.g. after SSG props). */
export function seedSurah(content: SurahContent, lang: 'ru' | 'en') {
  cacheSet(CACHE_NS, cacheKey(content.number, lang), content)
}

/** Prefetch neighbors so next/prev surah opens instantly (both langs). */
export function prefetchNearbySurahs(number: number, lang: 'ru' | 'en') {
  const other: 'ru' | 'en' = lang === 'ru' ? 'en' : 'ru'
  for (const n of [number - 1, number + 1]) {
    if (n < 1 || n > 114) continue
    warmCache(() => fetchSurah(n, lang))
    warmCache(() => fetchSurah(n, other))
  }
}

/** Warm current surah in both languages for instant RU/EN switch. */
export function warmSurahBothLangs(number: number) {
  if (number < 1 || number > 114) return
  warmCache(() => fetchSurah(number, 'en'))
  warmCache(() => fetchSurah(number, 'ru'))
}

/** Prefetch a surah on hover (both langs). */
export function prefetchSurah(number: number, lang: 'ru' | 'en') {
  if (number < 1 || number > 114) return
  const other: 'ru' | 'en' = lang === 'ru' ? 'en' : 'ru'
  warmCache(() => fetchSurah(number, lang))
  warmCache(() => fetchSurah(number, other))
}

/** Idle-warm first surahs from the list page. */
export function warmQuranList(lang: 'ru' | 'en', count = 4) {
  const other: 'ru' | 'en' = lang === 'ru' ? 'en' : 'ru'
  for (let n = 1; n <= count; n++) {
    warmCache(() => fetchSurah(n, lang))
    warmCache(() => fetchSurah(n, other))
  }
}
