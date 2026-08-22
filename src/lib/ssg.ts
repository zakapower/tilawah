import { allHadithSectionPathParams, getHadithSectionsStatic } from '@/data/hadithSectionsMeta'
import { hadithCollections } from '@/data/hadithCatalog'

/** ISR window for on-demand hadith chapters (24 h). */
export const SSG_REVALIDATE_SECONDS = 86400

/** Prefetch early chapters per book at build time — keeps Vercel builds small. */
export const HADITH_SECTION_PREFETCH = 12

export function quranStaticParams() {
  return Array.from({ length: 114 }, (_, i) => ({ number: String(i + 1) }))
}

export function hadithBookStaticParams() {
  return hadithCollections.map((b) => ({ id: b.id }))
}

export function hadithSectionStaticParams() {
  const params: Array<{ id: string; sectionId: string }> = []
  for (const book of hadithCollections) {
    const sections = getHadithSectionsStatic(book.apiBook) ?? []
    for (const s of sections.slice(0, HADITH_SECTION_PREFETCH)) {
      params.push({ id: book.id, sectionId: s.id })
    }
  }
  return params
}

export function isHadithSectionPregenerated(
  apiBook: string,
  sectionId: string,
): boolean {
  const sections = getHadithSectionsStatic(apiBook) ?? []
  return sections
    .slice(0, HADITH_SECTION_PREFETCH)
    .some((s) => s.id === sectionId)
}

/** All hadith section paths for sitemap (static, no network). */
export function allHadithSectionPaths() {
  return allHadithSectionPathParams()
}

/** Load data for both languages in parallel; skips failed fetches. */
export async function loadBothLangs<T>(
  load: (lang: 'ru' | 'en') => Promise<T | null>,
): Promise<Partial<Record<'ru' | 'en', T>>> {
  const [ru, en] = await Promise.all([load('ru'), load('en')])
  return {
    ...(ru ? { ru } : {}),
    ...(en ? { en } : {}),
  }
}
