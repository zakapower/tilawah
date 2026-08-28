'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  prefetchHadithSection,
  prefetchHadithBook,
} from '@/api/hadith'
import { hadithCollections } from '@/data/hadithCatalog'
import { useRestoreListScroll } from '@/hooks/useRestoreListScroll'
import { saveLastHadith, saveListScroll } from '@/utils/scrollMemory'
import { hadithRefPath } from '@/utils/hadithRef'
import {
  filterHadithCollections,
  findHadithHits,
  parseHadithCrossRef,
} from '@/utils/hadithSearch'
import { useApp } from '@/context/AppContext'
import './List.css'

export function HadithListView() {
  const { lang, t } = useApp()
  const router = useRouter()
  const [query, setQuery] = useState('')

  useRestoreListScroll('/hadith', !query.trim())

  const hadithRef = useMemo(() => parseHadithCrossRef(query), [query])

  const hadithHits = useMemo(() => {
    if (!hadithRef) return []
    return findHadithHits(lang, hadithRef)
  }, [hadithRef, lang])

  const filteredBooks = useMemo(() => {
    if (hadithRef) return []
    return filterHadithCollections(query)
  }, [query, hadithRef])

  useEffect(() => {
    for (const hit of hadithHits) {
      const path = hadithRefPath(hit.book.id, hit.section.id, hit.number)
      router.prefetch(path)
      prefetchHadithSection(hit.book.id, hit.section.id, lang)
    }
  }, [hadithHits, lang, router])

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault()
    if (hadithHits.length === 1) {
      const hit = hadithHits[0]
      prefetchHadithSection(hit.book.id, hit.section.id, lang)
      router.push(hadithRefPath(hit.book.id, hit.section.id, hit.number))
    }
  }

  return (
    <div className="list-page">
      <header className="list-page__head list-page__head--center">
        <h1>{t('Хадисы', 'Hadith')}</h1>
        <p>
          {t(
            'Шесть главных сборников хадисов',
            'Six main hadith collections',
          )}
        </p>
        <form className="search" onSubmit={onSearchSubmit}>
          <label>
            <span className="sr-only">{t('Поиск', 'Search')}</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                'Поиск хадиса по номеру во всех сборниках',
                'Search hadith by number across all collections',
              )}
              inputMode="search"
              autoComplete="off"
            />
          </label>
        </form>
      </header>

      {hadithRef && hadithHits.length === 0 && (
        <p className="list-page__status">
          {t(
            'Хадис не найден. Проверь сборник и номер.',
            'Hadith not found. Check the collection and number.',
          )}
        </p>
      )}

      {hadithHits.length > 0 && (
        <ol className="card-list">
          {hadithHits.map((hit) => (
            <li key={`${hit.book.id}-${hit.number}`}>
              <Link
                className="card-list__ayah-hit"
                href={hadithRefPath(hit.book.id, hit.section.id, hit.number)}
                prefetch={false}
                onPointerEnter={() =>
                  prefetchHadithSection(hit.book.id, hit.section.id, lang)
                }
                onPointerDown={() =>
                  prefetchHadithSection(hit.book.id, hit.section.id, lang)
                }
              >
                <span className="card-list__n">{hit.number}</span>
                <span className="card-list__body">
                  <strong>{hit.book.title[lang]}</strong>
                  <span className="card-list__meta">
                    {hit.section.name}
                    {` · ${t('Перейти к хадису', 'Go to hadith')}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {!hadithRef && (
        <ol className="card-list card-list--cols-2">
          {filteredBooks.map((b) => {
            const i = hadithCollections.findIndex((c) => c.id === b.id)
            return (
              <li key={b.id} id={`hadith-book-${b.id}`}>
                <Link
                  href={`/hadith/${b.id}`}
                  prefetch={false}
                  onPointerEnter={() => prefetchHadithBook(b.id, lang)}
                  onPointerDown={() => prefetchHadithBook(b.id, lang)}
                  onClick={() => {
                    saveListScroll('/hadith')
                    saveLastHadith(b.id)
                  }}
                >
                  <span className="card-list__n">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="card-list__body">
                    <strong>{b.title[lang]}</strong>
                    <span className="card-list__meta">
                      {b.narrator[lang]}
                      {` · ${b.hadithCount} ${t('хадисов', 'hadiths')}`}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
