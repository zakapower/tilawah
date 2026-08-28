'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { SurahMeta } from '@/data/types'
import { prefetchSurah, warmQuranList } from '@/api/quran'
import { surahMeaningRu, surahTitleRu } from '@/data/surahNamesRu'
import {
  ayahRefPath,
  formatAyahRef,
  parseAyahRef,
} from '@/utils/ayahRef'
import { filterSurahs } from '@/utils/surahSearch'
import { useRestoreListScroll } from '@/hooks/useRestoreListScroll'
import { saveLastSurah, saveListScroll } from '@/utils/scrollMemory'
import { useApp } from '@/context/AppContext'
import './Home.css'
import './List.css'

export function QuranListView({ surahs }: { surahs: SurahMeta[] }) {
  const { lang, t } = useApp()
  const router = useRouter()
  const [query, setQuery] = useState('')

  useRestoreListScroll('/quran', !query.trim())

  useEffect(() => {
    warmQuranList(lang, 4)
  }, [lang])

  const ayahRef = useMemo(() => parseAyahRef(query), [query])

  const ayahTarget = useMemo(() => {
    if (!ayahRef) return null
    const surah = surahs.find((s) => s.number === ayahRef.surah)
    if (!surah) return null
    if (ayahRef.from > surah.numberOfAyahs) return null
    const to = Math.min(ayahRef.to, surah.numberOfAyahs)
    return {
      surah,
      ref: { ...ayahRef, to },
      clipped: to !== ayahRef.to,
    }
  }, [surahs, ayahRef])

  const filtered = useMemo(() => {
    if (ayahTarget) return []
    return filterSurahs(surahs, query)
  }, [surahs, query, ayahTarget])

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault()
    if (ayahTarget) {
      router.push(ayahRefPath(ayahTarget.ref))
      return
    }
    if (filtered.length === 1) {
      router.push(`/quran/${filtered[0].number}`)
    }
  }

  return (
    <>
      <div className="list-page list-page--intro-only">
        <div className="list-page__intro">
          <header className="list-page__head">
            <h1>{t('Коран', 'Qur’an')}</h1>
            <p>
              {t(
                'Все суры и аяты из Священного Корана',
                'All surahs and ayahs from the Holy Qur’an',
              )}
            </p>
            <form className="search" onSubmit={onSearchSubmit}>
              <label>
                <span className="sr-only">{t('Поиск', 'Search')}</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t(
                    'Поиск сур или аятов по названию или по номеру',
                    'Search surahs or ayahs by name or number',
                  )}
                  inputMode="search"
                  autoComplete="off"
                />
              </label>
            </form>
          </header>

          {ayahRef && !ayahTarget && (
            <p className="list-page__status">
              {t(
                'Аят не найден. Проверь номер суры и аята.',
                'Ayah not found. Check the surah and ayah numbers.',
              )}
            </p>
          )}

          {query.trim() && !ayahRef && filtered.length === 0 && (
            <p className="list-page__status">
              {t(
                'Сура не найдена. Проверь название или номер.',
                'Surah not found. Check the name or number.',
              )}
            </p>
          )}

          {ayahTarget && (
            <ol className="card-list">
              <li>
                <Link
                  className="card-list__ayah-hit"
                  href={ayahRefPath(ayahTarget.ref)}
                >
                  <span className="card-list__n">
                    {formatAyahRef(ayahTarget.ref)}
                  </span>
                  <span className="card-list__body">
                    <strong>
                      {lang === 'ru'
                        ? surahTitleRu(
                            ayahTarget.surah.number,
                            ayahTarget.surah.englishName,
                          )
                        : ayahTarget.surah.englishName}
                      <span className="card-list__ar" dir="rtl">
                        {ayahTarget.surah.name}
                      </span>
                    </strong>
                    <span className="card-list__meta">
                      {ayahTarget.ref.from === ayahTarget.ref.to
                        ? t('Перейти к аяту', 'Go to ayah')
                        : t('Перейти к аятам', 'Go to ayahs')}
                      {ayahTarget.clipped
                        ? ` · ${t('до конца суры', 'to end of surah')}`
                        : ''}
                    </span>
                  </span>
                </Link>
              </li>
            </ol>
          )}
        </div>
      </div>

      {!ayahTarget && (
        <section className="home-surahs quran-surahs" aria-label={t('Суры', 'Surahs')}>
          <ol className="card-list card-list--cols">
            {filtered.map((s) => (
              <li key={s.number} id={`surah-${s.number}`}>
                <Link
                  href={`/quran/${s.number}`}
                  onPointerEnter={() => prefetchSurah(s.number, lang)}
                  onClick={() => {
                    saveListScroll('/quran')
                    saveLastSurah(s.number)
                  }}
                >
                  <span className="card-list__n">
                    {String(s.number).padStart(2, '0')}
                  </span>
                  <span className="card-list__body">
                    <strong>
                      {lang === 'ru'
                        ? surahTitleRu(s.number, s.englishName)
                        : s.englishName}
                      <span className="card-list__ar" dir="rtl">
                        {s.name}
                      </span>
                    </strong>
                    <span className="card-list__meta">
                      {lang === 'ru'
                        ? surahMeaningRu(s.number, s.englishNameTranslation)
                        : s.englishNameTranslation}{' '}
                      · {s.numberOfAyahs} {t('аятов', 'ayahs')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}
