'use client'

import Link from 'next/link'
import { prefetchHadithBook } from '@/api/hadith'
import { hadithCollections } from '@/data/hadithCatalog'
import { useRestoreListScroll } from '@/hooks/useRestoreListScroll'
import { saveLastHadith, saveListScroll } from '@/utils/scrollMemory'
import { useApp } from '@/context/AppContext'
import './List.css'

export function HadithListView() {
  const { lang, t } = useApp()

  useRestoreListScroll('/hadith', true)

  return (
    <div className="list-page">
      <header className="list-page__head">
        <h1>{t('Хадисы', 'Hadith')}</h1>
        <p>
          {t(
            'Сахих аль-Бухари, Сахих Муслим и четыре сунана.',
            'Sahih al-Bukhari, Sahih Muslim, and the four Sunan.',
          )}
        </p>
      </header>

      <ol className="card-list">
        {hadithCollections.map((b, i) => (
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
        ))}
      </ol>
    </div>
  )
}
