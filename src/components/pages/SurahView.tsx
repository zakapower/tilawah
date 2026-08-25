'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { prefetchSurah } from '@/api/quran'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { fetchSurah, peekSurah, prefetchNearbySurahs, seedSurah, warmSurahBothLangs } from '@/api/quran'
import type { SurahContent } from '@/data/types'
import { surahMeaningRu, surahTitleRu } from '@/data/surahNamesRu'
import { parseAyahParam } from '@/utils/ayahRef'
import { CopyAyahButton } from '@/components/CopyAyahButton'
import { FavoriteButton } from '@/components/FavoriteButton'
import { ReaderSkeleton } from '@/components/ReaderSkeleton'
import { useReaderScrollMemory } from '@/hooks/useReaderScrollMemory'
import { useApp } from '@/context/AppContext'
import { useQuranAudio } from '@/context/QuranAudioContext'
import './Reader.css'

/** Map Quran.com karaoke word index onto locally displayed word tokens. */
function mapKaraokeWordIndex(
  qcIndex: number | null,
  qcLen: number,
  displayLen: number,
): number | null {
  if (qcIndex == null || qcLen <= 0 || displayLen <= 0) return null
  if (qcLen === displayLen) return qcIndex
  return Math.min(
    displayLen,
    Math.max(1, Math.round((qcIndex * displayLen) / qcLen)),
  )
}

function SurahNav({
  n,
  top = false,
  lang,
}: {
  n: number
  top?: boolean
  lang: 'ru' | 'en'
}) {
  const { t } = useApp()
  const audio = useQuranAudio()
  const activeHere = audio.visible && audio.surah === n
  const showPause = activeHere && audio.playing

  const prev =
    n > 1 ? (
      <Link
        className="reader__nav-btn"
        href={`/quran/${n - 1}`}
        onPointerEnter={() => prefetchSurah(n - 1, lang)}
        aria-label={t('Предыдущая сура', 'Previous surah')}
        title={t('Предыдущая сура', 'Previous surah')}
      >
        <ChevronLeft strokeWidth={2.25} aria-hidden="true" />
      </Link>
    ) : (
      <span className="reader__nav-btn reader__nav-btn--ghost" aria-hidden="true" />
    )

  const next =
    n < 114 ? (
      <Link
        className="reader__nav-btn"
        href={`/quran/${n + 1}`}
        onPointerEnter={() => prefetchSurah(n + 1, lang)}
        aria-label={t('Следующая сура', 'Next surah')}
        title={t('Следующая сура', 'Next surah')}
      >
        <ChevronRight strokeWidth={2.25} aria-hidden="true" />
      </Link>
    ) : (
      <span className="reader__nav-btn reader__nav-btn--ghost" aria-hidden="true" />
    )

  if (!top) {
    return (
      <nav className="reader__nav" aria-label={t('Суры', 'Surahs')}>
        {prev}
        <span className="reader__nav-spacer" aria-hidden="true" />
        {next}
      </nav>
    )
  }

  return (
    <nav
      className="reader__nav reader__nav--with-play reader__nav--top"
      aria-label={t('Суры', 'Surahs')}
    >
      <p className="reader__nav-meta">
        {t(`Сура ${n} из 114`, `Surah ${n} of 114`)}
      </p>
      <div className="reader__nav-row">
        {prev}
        <button
          type="button"
          className="reader__nav-btn reader__nav-btn--play"
          onClick={() => {
            if (audio.visible && audio.surah === n && audio.playing) {
              audio.pause()
              return
            }
            // Main surah play always restarts from ayah 1.
            audio.openAndPlay({ surah: n, ayah: 1 })
          }}
          aria-label={
            showPause
              ? t('Пауза', 'Pause')
              : t('Слушать суру', 'Play surah')
          }
          title={
            showPause
              ? t('Пауза', 'Pause')
              : t('Слушать суру', 'Play surah')
          }
        >
          {showPause ? (
            <Pause strokeWidth={2.25} aria-hidden="true" />
          ) : (
            <Play strokeWidth={2.25} aria-hidden="true" />
          )}
        </button>
        {next}
      </div>
    </nav>
  )
}

export function SurahView({
  initialByLang,
}: {
  initialByLang?: Partial<Record<'ru' | 'en', SurahContent>>
} = {}) {
  const params = useParams<{ number: string }>()
  const searchParams = useSearchParams()
  const { lang, t } = useApp()
  const audio = useQuranAudio()
  const n = Number(params.number)

  const [surah, setSurah] = useState<SurahContent | null>(() => {
    if (!Number.isFinite(n) || n < 1 || n > 114) return null
    return initialByLang?.[lang] ?? peekSurah(n, lang)
  })
  const [error, setError] = useState<string | null>(() =>
    Number.isFinite(n) && n >= 1 && n <= 114 ? null : 'missing',
  )

  useEffect(() => {
    if (initialByLang?.ru) seedSurah(initialByLang.ru, 'ru')
    if (initialByLang?.en) seedSurah(initialByLang.en, 'en')
    if (Number.isFinite(n) && n >= 1 && n <= 114) warmSurahBothLangs(n)
  }, [initialByLang, n])

  const readerPath =
    Number.isFinite(n) && n >= 1 && n <= 114 ? `/quran/${n}` : null
  const title = surah
    ? lang === 'ru'
      ? surahTitleRu(surah.number, surah.englishName)
      : surah.englishName
    : null
  const meaning = surah
    ? lang === 'ru'
      ? surahMeaningRu(surah.number, surah.englishNameTranslation)
      : surah.englishNameTranslation
    : null

  const highlight = useMemo(() => {
    const range = parseAyahParam(searchParams.get('a'))
    if (!range || !surah) return null
    const max = surah.ayahsArabic.length
    const from = Math.min(range.from, max)
    const to = Math.min(range.to, max)
    if (from < 1) return null
    return { from, to }
  }, [searchParams, surah])

  useEffect(() => {
    if (!Number.isFinite(n) || n < 1 || n > 114) {
      setError('missing')
      return
    }
    let cancelled = false
    setError(null)

    const fromInitial = initialByLang?.[lang]
    const cached = fromInitial ?? peekSurah(n, lang)
    if (cached) {
      setSurah(cached)
      if (fromInitial) seedSurah(fromInitial, lang)
      prefetchNearbySurahs(n, lang)
      return
    }

    setSurah(null)
    fetchSurah(n, lang)
      .then((data) => {
        if (!cancelled) {
          setSurah(data)
          prefetchNearbySurahs(n, lang)
        }
      })
      .catch(() => {
        if (!cancelled) setError('load-failed')
      })
    return () => {
      cancelled = true
    }
  }, [n, lang, initialByLang])

  useEffect(() => {
    if (!surah || !highlight) return
    const el = document.getElementById(`a${highlight.from}`)
    if (!el) return
    const id = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => window.clearTimeout(id)
  }, [surah, highlight])

  useReaderScrollMemory(readerPath, Boolean(surah), Boolean(highlight))

  useEffect(() => {
    if (!Number.isFinite(n) || n < 1 || n > 114) return
    audio.ensureWords(n)
  }, [n, audio.ensureWords])

  const playerOpen = audio.visible && audio.surah === n
  const chapterWords =
    audio.wordsChapter === n ? audio.wordsByAyah : null

  return (
    <div className={`reader${playerOpen ? ' reader--player-open' : ''}`}>
      <nav className="reader__crumb">
        <Link href="/quran">{t('Коран', 'Qur’an')}</Link>
        <span aria-hidden="true">/</span>
        <span>{title ?? '…'}</span>
      </nav>

      {error && (
        <p className="reader__status">
          {error === 'missing'
            ? t('Сура не найдена', 'Surah not found')
            : t('Не удалось загрузить суру', 'Could not load surah')}
        </p>
      )}
      {!surah && !error && (
        <ReaderSkeleton variant="surah" number={n} />
      )}

      {surah && title && (
        <>
          <header className="reader__head">
            <p className="reader__ar-title" dir="rtl" lang="ar">
              {surah.name}
            </p>
            <h1>{title}</h1>
            {meaning && <p className="reader__sub">{meaning}</p>}
            {highlight && (
              <p className="reader__sub reader__sub--ayah">
                {highlight.from === highlight.to
                  ? t(`Аят ${highlight.from}`, `Ayah ${highlight.from}`)
                  : t(
                      `Аяты ${highlight.from}–${highlight.to}`,
                      `Ayahs ${highlight.from}–${highlight.to}`,
                    )}
              </p>
            )}
          </header>

          <SurahNav n={n} top lang={lang} />

          <div className="ayah-list">
            {surah.ayahsArabic.map((a, i) => {
              const hit =
                highlight &&
                a.numberInSurah >= highlight.from &&
                a.numberInSurah <= highlight.to
              const playing =
                audio.visible &&
                audio.surah === surah.number &&
                audio.ayah === a.numberInSurah
              const ayahLive = playing && audio.playing
              const displayWords = a.text.trim().split(/\s+/).filter(Boolean)
              const qcWords = chapterWords?.get(a.numberInSurah)
              const activeWord = playing
                ? mapKaraokeWordIndex(
                    audio.activeWordIndex,
                    qcWords?.length ?? displayWords.length,
                    displayWords.length,
                  )
                : null
              const cls = [
                'ayah',
                hit ? 'ayah--hit' : '',
                playing ? 'ayah--playing' : '',
                ayahLive ? 'ayah--live' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <article
                  key={a.number}
                  className={cls}
                  id={`a${a.numberInSurah}`}
                >
                  <div className="ayah__top">
                    <p className="ayah__n">{a.numberInSurah}</p>
                    <div className="ayah__actions">
                      <button
                        type="button"
                        className={`ayah__play${
                          playing ? ' ayah__play--on' : ''
                        }${ayahLive ? ' ayah__play--live' : ''}`}
                        onClick={() => {
                          // Pause only while this ayah is actively playing.
                          // If paused on this ayah (or idle), start/seek via openAndPlay
                          // so karaoke syncs from the ayah start.
                          if (ayahLive) {
                            audio.togglePause()
                            return
                          }
                          audio.openAndPlay({
                            surah: surah.number,
                            ayah: a.numberInSurah,
                          })
                        }}
                        aria-label={
                          ayahLive
                            ? t('Пауза', 'Pause')
                            : t(
                                `Слушать аят ${a.numberInSurah}`,
                                `Play ayah ${a.numberInSurah}`,
                              )
                        }
                        title={
                          ayahLive
                            ? t('Пауза', 'Pause')
                            : t('Слушать', 'Play')
                        }
                      >
                        {ayahLive ? (
                          <Pause strokeWidth={2} aria-hidden="true" />
                        ) : (
                          <Play strokeWidth={2} aria-hidden="true" />
                        )}
                      </button>
                      <FavoriteButton
                        kind="ayah"
                        surah={surah.number}
                        ayah={a.numberInSurah}
                        snippet={surah.ayahsTranslation[i]?.text ?? a.text}
                      />
                      <CopyAyahButton
                        surah={surah.number}
                        ayah={a.numberInSurah}
                        translation={surah.ayahsTranslation[i]?.text ?? ''}
                      />
                    </div>
                  </div>
                  <p className="ayah__ar" dir="rtl" lang="ar">
                    {displayWords.map((w, wi) => {
                      const idx = wi + 1
                      const active = activeWord === idx
                      return (
                        <span key={`${a.numberInSurah}-${idx}`}>
                          {wi > 0 ? ' ' : null}
                          <span
                            className={
                              active
                                ? 'ayah__word ayah__word--active'
                                : 'ayah__word'
                            }
                          >
                            {w}
                          </span>
                        </span>
                      )
                    })}
                  </p>
                  <p className="ayah__tr">{surah.ayahsTranslation[i]?.text}</p>
                </article>
              )
            })}
          </div>

          <SurahNav n={n} lang={lang} />
        </>
      )}
    </div>
  )
}
