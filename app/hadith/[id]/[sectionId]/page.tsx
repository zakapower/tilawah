import type { Metadata } from 'next'
import { Suspense } from 'react'
import { HadithSectionView } from '@/components/pages/HadithSectionView'
import { fetchHadithSections } from '@/api/hadith'
import { getHadithCollection } from '@/data/hadithCatalog'
import { getRequestLang } from '@/lib/request-lang'
import {
  hadithSectionStaticParams,
  loadBothLangs,
} from '@/lib/ssg'
import { clipDescription, pageAlternates, pageTitle } from '@/lib/site'

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
  const { id, sectionId } = await params
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

  return {
    title: tab,
    description: clipDescription(description),
    alternates: pageAlternates(`/hadith/${id}/${sectionId}`),
    openGraph: { title, description: clipDescription(description) },
  }
}

export default async function HadithSectionPage({
  params,
}: {
  params: Promise<{ id: string; sectionId: string }>
}) {
  const { id, sectionId } = await params
  const book = getHadithCollection(id)

  type Pack = {
    sections: Awaited<ReturnType<typeof fetchHadithSections>>
    title: string
  }

  // Only static chapter metadata on the server — hadith JSON + MT load on the client.
  // Awaiting CDN / i-muslim / translate here blocked navigation and wedged the server.
  const initialByLang = book
    ? await loadBothLangs(async (lang): Promise<Pack | null> => {
        try {
          const sections = await fetchHadithSections(book.id, lang)
          const sec = sections.find((s) => s.id === sectionId)
          return {
            sections,
            title: sec?.name ?? sectionId,
          }
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
