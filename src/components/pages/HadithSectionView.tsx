'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchHadithSection, fetchHadithSections, hadithSectionNeedsRuBackfill, peekHadithSection, peekHadithSections, prefetchHadithSection, prefetchNearbyHadithSections, seedHadithSection, seedHadithSections, warmHadithSectionBothLangs } from '@/api/hadith'
import { getHadithCollection } from '@/data/hadithCatalog'
import type { HadithItem, HadithSectionMeta } from '@/data/types'
import { CopyQuoteButton } from '@/components/CopyQuoteButton'
import { FavoriteButton } from '@/components/FavoriteButton'
import { ReaderSkeleton } from '@/components/ReaderSkeleton'
import { useReaderScrollMemory } from '@/hooks/useReaderScrollMemory'
import { parseHadithParam } from '@/utils/hadithRef'
import { normalizeHadithText, splitHadithLead } from '@/utils/hadithText'
import { useApp } from '@/context/AppContext'
import './Reader.css'

function HadithTranslation({ text }: { text: string }) {
  const cleaned = normalizeHadithText(text)
  const parts = splitHadithLead(cleaned)
  if (!parts) {
    return <p className="ayah__tr ayah__tr--hadith">{cleaned}</p>
  }
  return (
    <div className="ayah__tr ayah__tr--hadith">
      <p className="ayah__tr-lead">{parts.lead}</p>
      <p className="ayah__tr-body">{parts.body}</p>
    </div>
  )
}

function HadithSectionNav({
  bookId,
  prevId,
  nextId,
  index,
  total,
  top = false,
  lang,
}: {
  bookId: string
  prevId: string | null
  nextId: string | null
  index: number
  total: number
  top?: boolean
  lang: 'ru' | 'en'
}) {
  const { t } = useApp()
  return (
    <nav
      className={`reader__nav${top ? ' reader__nav--top' : ''}`}
      aria-label={t('Главы', 'Chapters')}
    >
      {prevId ? (
        <Link
          className="reader__nav-btn"
          href={`/hadith/${bookId}/${prevId}`}
          onPointerEnter={() => prefetchHadithSection(bookId, prevId, lang)}
          aria-label={t('Предыдущая глава', 'Previous chapter')}
          title={t('Предыдущая глава', 'Previous chapter')}
        >
          <ChevronLeft strokeWidth={2.25} aria-hidden="true" />
        </Link>
      ) : (
        <span className="reader__nav-btn reader__nav-btn--ghost" aria-hidden="true" />
      )}
      <p className="reader__nav-meta">
        {t(`Глава ${index} из ${total}`, `Chapter ${index} of ${total}`)}
      </p>
      {nextId ? (
        <Link
          className="reader__nav-btn"
          href={`/hadith/${bookId}/${nextId}`}
          onPointerEnter={() => prefetchHadithSection(bookId, nextId, lang)}
          aria-label={t('Следующая глава', 'Next chapter')}
          title={t('Следующая глава', 'Next chapter')}
        >
          <ChevronRight strokeWidth={2.25} aria-hidden="true" />
        </Link>
      ) : (
        <span className="reader__nav-btn reader__nav-btn--ghost" aria-hidden="true" />
      )}
    </nav>
  )
}

export function HadithSectionView({
  initialByLang,
}: {
  initialByLang?: Partial<
    Record<
      'ru' | 'en',
      { sections: HadithSectionMeta[]; hadiths?: HadithItem[]; title: string }
    >
  >
} = {}) {
  const params = useParams<{ id: string; sectionId: string }>()
  const searchParams = useSearchParams()
  const { lang, t } = useApp()
  const book = params.id ? getHadithCollection(params.id) : undefined
  const sectionId = params.sectionId

  const boot = () => {
    if (!book || !sectionId) return null
    const init = initialByLang?.[lang]
    const secs = init?.sections ?? peekHadithSections(book.id, lang)
    const items =
      init?.hadiths ?? peekHadithSection(book.id, sectionId, lang)
    if (secs && items) {
      const sec = secs.find((s) => s.id === sectionId)
      return {
        sections: secs,
        hadiths: items,
        title: init?.title ?? sec?.name ?? sectionId,
      }
    }
    if (secs) {
      const sec = secs.find((s) => s.id === sectionId)
      return {
        sections: secs,
        hadiths: null as HadithItem[] | null,
        title: init?.title ?? sec?.name ?? sectionId,
      }
    }
    return null
  }

  const started = boot()
  const [title, setTitle] = useState<string>(started?.title ?? '')
  const [sections, setSections] = useState<HadithSectionMeta[] | null>(
    started?.sections ?? null,
  )
  const [hadiths, setHadiths] = useState<HadithItem[] | null>(
    started?.hadiths ?? null,
  )
  const [error, setError] = useState<string | null>(() =>
    book && sectionId ? null : 'missing',
  )
  const readerPath =
    book && sectionId ? `/hadith/${book.id}/${sectionId}` : null

  const highlight = useMemo(() => {
    const n = parseHadithParam(searchParams.get('h'))
    if (!n || !hadiths) return null
    return hadiths.some((h) => h.number === n) ? n : null
  }, [searchParams, hadiths])

  const adjacent = useMemo(() => {
    if (!sections || !sectionId) {
      return { prevId: null as string | null, nextId: null as string | null, index: 0, total: 0 }
    }
    const i = sections.findIndex((s) => s.id === sectionId)
    if (i < 0) {
      return { prevId: null, nextId: null, index: 0, total: sections.length }
    }
    return {
      prevId: i > 0 ? sections[i - 1].id : null,
      nextId: i < sections.length - 1 ? sections[i + 1].id : null,
      index: i + 1,
      total: sections.length,
    }
  }, [sections, sectionId])

  useEffect(() => {
    if (!book || !sectionId) return
    for (const l of ['ru', 'en'] as const) {
      const pack = initialByLang?.[l]
      if (!pack) continue
      seedHadithSections(book.id, l, pack.sections)
      if (pack.hadiths) seedHadithSection(book.id, sectionId, l, pack.hadiths)
    }
    warmHadithSectionBothLangs(book.id, sectionId)
  }, [book, sectionId, initialByLang])

  useEffect(() => {
    if (!book || !sectionId) {
      setError('missing')
      return
    }
    let cancelled = false
    setError(null)

    const init = initialByLang?.[lang]
    const cachedSecs = init?.sections ?? peekHadithSections(book.id, lang)
    const cachedItems =
      init?.hadiths ?? peekHadithSection(book.id, sectionId, lang)
    const ruNeedsBackfill =
      lang === 'ru' &&
      Boolean(cachedItems && hadithSectionNeedsRuBackfill(cachedItems))

    if (cachedSecs && cachedItems && !ruNeedsBackfill) {
      const sec = cachedSecs.find((s) => s.id === sectionId)
      setSections(cachedSecs)
      setTitle(init?.title ?? sec?.name ?? sectionId)
      setHadiths(cachedItems)
      if (init) {
        seedHadithSections(book.id, lang, init.sections)
        if (init.hadiths) {
          seedHadithSection(book.id, sectionId, lang, init.hadiths)
        }
      }
      prefetchNearbyHadithSections(
        book.id,
        sectionId,
        lang,
        cachedSecs.map((s) => s.id),
      )
      return () => {
        cancelled = true
      }
    }

    // Show whatever we have immediately (incl. incomplete RU) while backfill runs.
    if (cachedSecs) {
      const sec = cachedSecs.find((s) => s.id === sectionId)
      setSections(cachedSecs)
      setTitle(init?.title ?? sec?.name ?? sectionId)
      if (init) seedHadithSections(book.id, lang, init.sections)
    } else {
      setSections(null)
    }
    if (cachedItems) {
      setHadiths(cachedItems)
      if (init?.hadiths) {
        seedHadithSection(book.id, sectionId, lang, init.hadiths)
      }
    } else {
      setHadiths(null)
    }

    const loads: Promise<void>[] = []

    if (!cachedSecs) {
      loads.push(
        fetchHadithSections(book.id, lang).then((secs) => {
          if (cancelled) return
          const sec = secs.find((s) => s.id === sectionId)
          setSections(secs)
          setTitle(sec?.name ?? sectionId)
        }),
      )
    }

    loads.push(
      fetchHadithSection(book.id, sectionId, lang, {
        onPartial: (items) => {
          if (!cancelled) setHadiths(items)
        },
      }).then((items) => {
        if (cancelled) return
        setHadiths(items)
      }),
    )

    Promise.all(loads)
      .then(() => {
        if (cancelled) return
        const secs = peekHadithSections(book.id, lang)
        if (secs) {
          prefetchNearbyHadithSections(
            book.id,
            sectionId,
            lang,
            secs.map((s) => s.id),
          )
        }
      })
      .catch(() => {
        if (!cancelled) setError('load-failed')
      })

    return () => {
      cancelled = true
    }
  }, [book, sectionId, lang, initialByLang])

  useEffect(() => {
    if (!hadiths || !highlight || !book) return
    const el = document.getElementById(`${book.id}-${highlight}`)
    if (!el) return
    const id = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => window.clearTimeout(id)
  }, [hadiths, highlight, book])

  useReaderScrollMemory(readerPath, Boolean(hadiths), Boolean(highlight))

  if (!book || error === 'missing') {
    return (
      <div className="reader">
        <h1>{t('Не найдено', 'Not found')}</h1>
        <Link href="/hadith">{t('К хадисам', 'Back to hadith')}</Link>
      </div>
    )
  }

  return (
    <div className="reader reader--wide">
      <nav className="reader__crumb">
        <Link href="/hadith">{t('Хадисы', 'Hadith')}</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/hadith/${book.id}`}>{book.title[lang]}</Link>
        <span aria-hidden="true">/</span>
        <span>{title || '…'}</span>
      </nav>

      {error === 'load-failed' && (
        <p className="reader__status">
          {t('Не удалось загрузить главу', 'Could not load chapter')}
        </p>
      )}
      {!hadiths && !error && !title && <ReaderSkeleton variant="hadith" />}
      {!hadiths && !error && title && sections && (
        <>
          <header className="reader__head">
            <h1>{title}</h1>
            <p className="reader__sub">{book.title[lang]}</p>
          </header>
          <HadithSectionNav
            bookId={book.id}
            prevId={adjacent.prevId}
            nextId={adjacent.nextId}
            index={adjacent.index}
            total={adjacent.total}
            lang={lang}
            top
          />
          <ReaderSkeleton
            variant="hadith"
            hideHead
            hideNav
            hidePrev={!adjacent.prevId}
            hideNext={!adjacent.nextId}
          />
        </>
      )}
      {!hadiths && !error && title && !sections && (
        <>
          <header className="reader__head">
            <h1>{title}</h1>
            <p className="reader__sub">{book.title[lang]}</p>
          </header>
          <ReaderSkeleton variant="hadith" hideHead />
        </>
      )}

      {hadiths && (
        <>
          <header className="reader__head">
            <h1>{title}</h1>
            <p className="reader__sub">
              {highlight
                ? t(`Хадис ${highlight}`, `Hadith ${highlight}`)
                : book.title[lang]}
            </p>
          </header>

          <HadithSectionNav
            bookId={book.id}
            prevId={adjacent.prevId}
            nextId={adjacent.nextId}
            index={adjacent.index}
            total={adjacent.total}
            lang={lang}
            top
          />

          <div className="ayah-list">
            {hadiths.map((h) => {
              const hit = highlight === h.number
              const translation = h.text ? normalizeHadithText(h.text) : ''
              const arabic = h.arabic ? normalizeHadithText(h.arabic) : ''
              const copyBody = translation || arabic
              return (
                <article
                  key={h.id}
                  className={hit ? 'ayah ayah--hit ayah--hadith' : 'ayah ayah--hadith'}
                  id={h.id}
                >
                  <div className="ayah__top">
                    <p className="ayah__n">
                      {Number.isInteger(h.number) ? h.number : String(h.number)}
                    </p>
                    <div className="ayah__actions">
                      <FavoriteButton
                        kind="hadith"
                        bookId={book.id}
                        sectionId={sectionId}
                        number={h.number}
                        bookTitle={book.title[lang]}
                        snippet={copyBody}
                      />
                      <CopyQuoteButton
                        heading={`${book.title[lang]} ${h.number}`}
                        body={copyBody}
                        label={t('Копировать хадис', 'Copy hadith')}
                      />
                    </div>
                  </div>
                  {(translation || arabic) && (
                    <div
                      className={
                        (translation || lang === 'ru') && arabic
                          ? 'ayah__bilingual'
                          : 'ayah__bilingual ayah__bilingual--solo'
                      }
                    >
                      {translation ? (
                        <HadithTranslation text={translation} />
                      ) : (
                        lang === 'ru' &&
                        arabic && (
                          <div
                            className="ayah__tr ayah__tr--hadith ayah__tr--pending"
                            aria-hidden="true"
                          >
                            <div className="ayah__tr-pending-line" style={{ width: '92%' }} />
                            <div className="ayah__tr-pending-line" style={{ width: '78%' }} />
                            <div className="ayah__tr-pending-line" style={{ width: '84%' }} />
                          </div>
                        )
                      )}
                      {arabic && (
                        <p className="ayah__ar" dir="rtl" lang="ar">
                          {arabic}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          <HadithSectionNav
            bookId={book.id}
            prevId={adjacent.prevId}
            nextId={adjacent.nextId}
            index={adjacent.index}
            total={adjacent.total}
            lang={lang}
          />
        </>
      )}
    </div>
  )
}
