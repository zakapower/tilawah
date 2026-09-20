import type { HadithSectionMeta } from '@/data/types'

/** Разбор номера хадиса: «756». */
export function parseHadithNumber(input: string): number | null {
  const m = input.trim().match(/^(\d{1,5})$/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 1) return null
  return n
}

/** Параметр ?h=756 (legacy). */
export function parseHadithParam(value: string | null): number | null {
  return parseHadithNumber(value ?? '')
}

export type HadithSectionPathRef = {
  sectionId: string
  hadithNumber: number | null
}

/** Разбор сегмента пути: «1», «1:424». */
export function parseHadithSectionPathRef(input: string): HadithSectionPathRef | null {
  const raw = decodeURIComponent(input.trim())
  const onlySection = raw.match(/^(\d{1,4})$/)
  if (onlySection) {
    return { sectionId: onlySection[1], hadithNumber: null }
  }

  const withHadith = raw.match(/^(\d{1,4})\s*:\s*(\d{1,5})$/)
  if (!withHadith) return null
  const sectionId = withHadith[1]
  const hadithNumber = Number(withHadith[2])
  if (!Number.isFinite(hadithNumber) || hadithNumber < 1) return null
  return { sectionId, hadithNumber }
}

export function findSectionForHadith(
  sections: HadithSectionMeta[],
  n: number,
): HadithSectionMeta | null {
  return (
    sections.find(
      (s) => s.hadithFirst > 0 && n >= s.hadithFirst && n <= s.hadithLast,
    ) ?? null
  )
}

/** /hadith/ibnmajah/1:424 */
export function hadithRefPath(bookId: string, sectionId: string, n: number) {
  return `/hadith/${bookId}/${sectionId}:${n}`
}
