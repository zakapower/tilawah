import type { SurahMeta } from '@/data/types'
import { surahMeaningRu, surahTitleRu } from '@/data/surahNamesRu'

const SURAH_PREFIX_RE =
  /^(?:аль|al|ан|an|ар|ar|ас|as|ат|at|аш|ash|аз|az|ад|ad|аб|ab)[\s-]+/i

function foldSurahText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[\s-–—]+/g, '')
}

function stripSurahPrefixes(value: string) {
  let next = value
  while (SURAH_PREFIX_RE.test(next)) {
    next = next.replace(SURAH_PREFIX_RE, '')
  }
  return next
}

function surahNeedles(s: SurahMeta) {
  const raw = [
    String(s.number),
    s.englishName,
    s.englishNameTranslation,
    surahTitleRu(s.number, s.englishName),
    surahMeaningRu(s.number, s.englishNameTranslation),
    s.name,
  ]

  const folded = new Set<string>()
  for (const part of raw) {
    const base = foldSurahText(part)
    if (!base) continue
    folded.add(base)
    folded.add(stripSurahPrefixes(base))
  }
  return [...folded]
}

function surahMatchesQuery(s: SurahMeta, query: string) {
  const q = query.trim()
  if (!q) return true

  const foldedQuery = foldSurahText(q)
  const strippedQuery = stripSurahPrefixes(foldedQuery)
  const lowerQuery = q.toLowerCase()

  return surahNeedles(s).some((needle) => {
    if (needle.includes(foldedQuery) || foldedQuery.includes(needle)) return true
    if (
      strippedQuery &&
      (needle.includes(strippedQuery) || strippedQuery.includes(needle))
    ) {
      return true
    }
    return false
  }) || s.name.includes(q)
}

export function filterSurahs(surahs: SurahMeta[], query: string) {
  const q = query.trim()
  if (!q) return surahs
  return surahs.filter((s) => surahMatchesQuery(s, q))
}
