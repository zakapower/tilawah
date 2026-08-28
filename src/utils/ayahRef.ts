export type AyahRef = {
  surah: number
  from: number
  to: number
}

export type SurahPathRef = {
  surah: number
  from: number | null
  to: number | null
}

/** Разбор «2:2» или «2:2-6». */
export function parseAyahRef(input: string): AyahRef | null {
  const m = input
    .trim()
    .match(/^(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?$/)
  if (!m) return null

  const surah = Number(m[1])
  let from = Number(m[2])
  let to = m[3] ? Number(m[3]) : from

  if (!Number.isFinite(surah) || !Number.isFinite(from) || !Number.isFinite(to)) {
    return null
  }
  if (surah < 1 || surah > 114 || from < 1 || to < 1) return null
  if (to < from) [from, to] = [to, from]

  return { surah, from, to }
}

/** Разбор сегмента пути: «23», «23:2», «23:2-6». */
export function parseSurahPathRef(input: string): SurahPathRef | null {
  const raw = decodeURIComponent(input.trim())
  const onlySurah = raw.match(/^(\d{1,3})$/)
  if (onlySurah) {
    const surah = Number(onlySurah[1])
    if (!Number.isFinite(surah) || surah < 1 || surah > 114) return null
    return { surah, from: null, to: null }
  }

  const ayah = parseAyahRef(raw)
  if (!ayah) return null
  return { surah: ayah.surah, from: ayah.from, to: ayah.to }
}

export function formatAyahRef(ref: AyahRef) {
  return ref.from === ref.to
    ? `${ref.surah}:${ref.from}`
    : `${ref.surah}:${ref.from}-${ref.to}`
}

export function ayahRefPath(ref: AyahRef) {
  return `/quran/${formatAyahRef(ref)}`
}
