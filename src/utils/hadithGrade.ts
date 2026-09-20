export type HadithGradeBucket = 'sahih' | 'hasan' | 'daif' | 'mawdu' | 'unknown'

export type HadithGradeEntry = {
  name?: string
  grade?: string
}

const SAHIH_BOOKS = new Set(['bukhari', 'muslim'])

function pickGradeString(grades: HadithGradeEntry[] | undefined): string | null {
  if (!grades?.length) return null
  const albani = grades.find((g) =>
    (g.name || '').toLowerCase().includes('albani'),
  )
  const chosen = albani ?? grades[0]
  const raw = (chosen.grade || '').trim()
  return raw || null
}

/** Map a free-form CDN grade label to a display bucket. */
export function bucketFromGradeLabel(label: string): HadithGradeBucket {
  const s = label.toLowerCase().replace(/['’]/g, '')

  if (
    s.includes('mawdu') ||
    s.includes('maudu') ||
    s.includes('fabricat') ||
    /\bforg(e|ed|ery)\b/.test(s)
  ) {
    return 'mawdu'
  }

  // Hasan Sahih / Isnaad Sahih / Sahih Lighairihi → sahih
  if (s.includes('sahih')) return 'sahih'

  if (s.includes('hasan')) return 'hasan'

  if (
    s.includes('daif') ||
    s.includes('weak') ||
    s.includes('munkar') ||
    s.includes('shadh') ||
    s.includes('muallal') ||
    s.includes('mudtarib')
  ) {
    return 'daif'
  }

  return 'unknown'
}

/**
 * Resolve display grade for a hadith card.
 * Bukhari/Muslim → always sahih. Else Albani if present, else first grade.
 */
export function resolveHadithGrade(
  bookId: string,
  grades: HadithGradeEntry[] | undefined,
): HadithGradeBucket {
  if (SAHIH_BOOKS.has(bookId)) return 'sahih'
  const label = pickGradeString(grades)
  if (!label) return 'unknown'
  return bucketFromGradeLabel(label)
}
