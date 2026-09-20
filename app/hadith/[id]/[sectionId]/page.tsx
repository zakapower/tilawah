import type { Metadata } from 'next'
import { Suspense } from 'react'
import { HadithSectionView } from '@/components/pages/HadithSectionView'
import { fetchHadithSection, fetchHadithSections } from '@/api/hadith'
import { getHadithCollection } from '@/data/hadithCatalog'
import { getRequestLang } from '@/lib/request-lang'
import {
  hadithSectionStaticParams,
  loadBothLangs,
} from '@/lib/ssg'
import { clipDescription, pageAlternates, pageTitle } from '@/lib/site'
import { parseHadithSectionPathRef } from '@/utils/hadithRef'

/** First visit builds HTML; then cached (ISR). Avoids huge Vercel builds. */
export const revalidate = 86400
export const dynamicParams = true

export async function generateStaticParams() {
  return hadithSectionStaticParams()
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; sectionId: string }>
}): Promise<Metadata> {
  const { id, sectionId: sectionRaw } = await params
  const pathRef = parseHadithSectionPathRef(sectionRaw)
  const sectionId = pathRef?.sectionId ?? sectionRaw
  const lang = await getRequestLang()
  const book = getHadithCollection(id)
  const tab = book
    ? book.title[lang]
    : lang === 'ru'
      ? 'Хадисы'
      : 'Hadith'
  const title = pageTitle(tab)
  const description =
    lang === 'ru' ? 'Чтение главы хадисов.' : 'Read a hadith chapter.'

  const path =
    pathRef?.hadithNumber != null
      ? `/hadith/${id}/${sectionId}:${pathRef.hadithNumber}`
      : `/hadith/${id}/${sectionId}`

  return {
    title: tab,
    description: clipDescription(description),
    alternates: pageAlternates(path),
    openGraph: { title, description: clipDescription(description) },
  }
}

export default async function HadithSectionPage({
  params,
}: {
  params: Promise<{ id: string; sectionId: string }>
}) {
  const { id, sectionId: sectionRaw } = await params
  const pathRef = parseHadithSectionPathRef(sectionRaw)
  const sectionId = pathRef?.sectionId ?? sectionRaw
  const book = getHadithCollection(id)

  type Pack = {
    sections: Awaited<ReturnType<typeof fetchHadithSections>>
    hadiths?: Awaited<ReturnType<typeof fetchHadithSection>>
    title: string
  }

  const initialByLang = book
    ? await loadBothLangs(async (lang): Promise<Pack | null> => {
        try {
          const sections = await fetchHadithSections(book.id, lang)
          const sec = sections.find((s) => s.id === sectionId)
          const base = {
            sections,
            title: sec?.name ?? sectionId,
          }
          const hadiths = await fetchHadithSection(book.id, sectionId, lang)
          return { ...base, hadiths }
        } catch {
          return null
        }
      })
    : {}

  return (
    <Suspense fallback={null}>
      <HadithSectionView initialByLang={initialByLang} />
    </Suspense>
  )
}
