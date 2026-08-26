import type { Metadata } from 'next'
import { SurahView } from '@/components/pages/SurahView'
import { fetchSurah } from '@/api/quran'
import { getRequestLang } from '@/lib/request-lang'
import { loadBothLangs, quranStaticParams } from '@/lib/ssg'
import { clipDescription, pageAlternates, pageTitle } from '@/lib/site'
import { surahTitleRu } from '@/data/surahNamesRu'
import { getSurahMeta } from '@/data/surahList'
import { parseSurahPathRef } from '@/utils/ayahRef'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return quranStaticParams()
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ref: string }>
}): Promise<Metadata> {
  const { ref } = await params
  const parsed = parseSurahPathRef(ref)
  const lang = await getRequestLang()
  const n = parsed?.surah ?? NaN
  const valid = Number.isFinite(n) && n >= 1 && n <= 114
  const meta = valid ? getSurahMeta(n) : null
  const tab = valid
    ? lang === 'ru'
      ? `${n}. ${surahTitleRu(n, meta?.englishName ?? '')}`
      : `${n}. ${meta?.englishName ?? n}`
    : lang === 'ru'
      ? 'Сура'
      : 'Surah'
  const title = pageTitle(tab)
  const description =
    lang === 'ru'
      ? 'Чтение суры Корана с арабским текстом и переводом.'
      : 'Read a Qur’an surah with Arabic text and translation.'

  const path = parsed
    ? parsed.from != null && parsed.to != null
      ? parsed.from === parsed.to
        ? `/quran/${parsed.surah}:${parsed.from}`
        : `/quran/${parsed.surah}:${parsed.from}-${parsed.to}`
      : `/quran/${parsed.surah}`
    : `/quran/${ref}`

  return {
    title: tab,
    description: clipDescription(description),
    alternates: pageAlternates(path),
    openGraph: { title, description: clipDescription(description) },
  }
}

export default async function SurahPage({
  params,
}: {
  params: Promise<{ ref: string }>
}) {
  const { ref } = await params
  const parsed = parseSurahPathRef(ref)
  const n = parsed?.surah ?? NaN

  const initialByLang =
    Number.isFinite(n) && n >= 1 && n <= 114
      ? await loadBothLangs((lang) =>
          fetchSurah(n, lang).catch(() => null),
        )
      : {}

  return <SurahView initialByLang={initialByLang} />
}
