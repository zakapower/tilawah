import { getHadithCollection, hadithCollections } from '@/data/hadithCatalog'
import { getHadithSectionsStatic } from '@/data/hadithSectionsMeta'
import { sectionNameRu } from '@/data/hadithSectionsRu'
import type { HadithCollectionMeta, HadithSectionMeta, Lang } from '@/data/types'
import { findSectionForHadith, parseHadithNumber } from './hadithRef'

export type HadithHit = {
  book: HadithCollectionMeta
  section: HadithSectionMeta
  number: number
}

export type HadithCrossRef = {
  bookId?: string
  number: number
}

function buildSectionsSync(bookId: string, lang: Lang): HadithSectionMeta[] {
  const col = getHadithCollection(bookId)
  if (!col) return []
  const staticSections = getHadithSectionsStatic(col.apiBook)
  if (!staticSections) return []

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

function resolveBookId(token: string): string | null {
  const value = token.trim().toLowerCase()
  const byIndex = Number(value)
  if (
    Number.isInteger(byIndex) &&
    byIndex >= 1 &&
    byIndex <= hadithCollections.length
  ) {
    return hadithCollections[byIndex - 1].id
  }

  return (
    hadithCollections.find((c) => c.id === value || c.apiBook === value)?.id ??
    null
  )
}

/** Разбор ссылки: bukhari:756, 1:756 или просто 756. */
export function parseHadithCrossRef(input: string): HadithCrossRef | null {
  const q = input.trim()
  const colon = q.match(/^([^:\s]+)\s*:\s*(\d{1,5})$/)
  if (colon) {
    const bookId = resolveBookId(colon[1])
    const number = Number(colon[2])
    if (!bookId || !Number.isFinite(number) || number < 1) return null
    return { bookId, number }
  }

  const number = parseHadithNumber(q)
  if (number) return { number }
  return null
}

export function findHadithHits(
  lang: Lang,
  ref: HadithCrossRef,
): HadithHit[] {
  const books = ref.bookId
    ? hadithCollections.filter((b) => b.id === ref.bookId)
    : hadithCollections

  const hits: HadithHit[] = []
  for (const book of books) {
    if (ref.number > book.hadithCount) continue
    const sections = buildSectionsSync(book.id, lang)
    const section = findSectionForHadith(sections, ref.number)
    if (section) hits.push({ book, section, number: ref.number })
  }
  return hits
}

export function filterHadithCollections(query: string): HadithCollectionMeta[] {
  const q = query.trim().toLowerCase()
  if (!q) return hadithCollections

  return hadithCollections.filter((b, i) => {
    const index = String(i + 1)
    return (
      index.includes(q) ||
      b.id.includes(q) ||
      b.apiBook.includes(q) ||
      b.title.ru.toLowerCase().includes(q) ||
      b.title.en.toLowerCase().includes(q) ||
      b.narrator.ru.toLowerCase().includes(q) ||
      b.narrator.en.toLowerCase().includes(q)
    )
  })
}
