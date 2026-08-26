'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { prefetchSurah } from '@/api/quran'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { fetchSurah, peekSurah, prefetchNearbySurahs, seedSurah, warmSurahBothLangs } from '@/api/quran'
import type { SurahContent } from '@/data/types'
import { surahMeaningRu, surahTitleRu } from '@/data/surahNamesRu'
import { parseSurahPathRef } from '@/utils/ayahRef'
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

async function writeClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    /* fall through to legacy copy */
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  if (!ok) throw new Error('copy failed')
}

function rangeList(from: number, to: number) {
  const list: number[] = []
  for (let i = from; i <= to; i++) list.push(i)
  return list
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
  const params = useParams<{ ref: string }>()
  const { lang, t } = useApp()
  const audio = useQuranAudio()
  const pathRef = useMemo(
    () => parseSurahPathRef(String(params.ref ?? '')),
    [params.ref],
  )
  const n = pathRef?.surah ?? NaN

  const [surah, setSurah] = useState<SurahContent | null>(() => {
    if (!Number.isFinite(n) || n < 1 || n > 114) return null
    return initialByLang?.[lang] ?? peekSurah(n, lang)
  })
  const [contentLang, setContentLang] = useState(lang)
  const [error, setError] = useState<string | null>(() =>
    Number.isFinite(n) && n >= 1 && n <= 114 ? null : 'missing',
  )
  const [selected, setSelected] = useState<number[]>([])
  const [copied, setCopied] = useState(false)
  const [barMounted, setBarMounted] = useState(false)
  const [barExiting, setBarExiting] = useState(false)
  const barCountRef = useRef(0)
  const seededKeyRef = useRef<string | null>(null)
  const didScrollRef = useRef<string | null>(null)

  // Sync swap on lang change before paint — avoid waiting for useEffect.
  if (lang !== contentLang) {
    setContentLang(lang)
    if (Number.isFinite(n) && n >= 1 && n <= 114) {
      const next = initialByLang?.[lang] ?? peekSurah(n, lang)
      if (next) setSurah(next)
    }
  }

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

  const urlHighlight = useMemo(() => {
    if (!pathRef || pathRef.from == null || pathRef.to == null || !surah) {
      return null
    }
    const max = surah.ayahsArabic.length
    const from = Math.min(pathRef.from, max)
    const to = Math.min(pathRef.to, max)
    if (from < 1) return null
    return { from, to }
  }, [pathRef, surah])

  useEffect(() => {
    const key = String(params.ref ?? '')
    if (!surah || !pathRef || pathRef.surah !== surah.number) return
    if (seededKeyRef.current === key) return
    seededKeyRef.current = key
    if (urlHighlight) {
      setSelected(rangeList(urlHighlight.from, urlHighlight.to))
    } else {
      setSelected([])
    }
  }, [params.ref, pathRef, surah, urlHighlight])

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

    // Keep current ayahs visible while the other language loads.
    setSurah((prev) => (prev && prev.number === n ? prev : null))
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
    if (!surah || selected.length === 0) return
    const key = String(params.ref ?? '')
    if (didScrollRef.current === key) return
    if (!urlHighlight) return
    const el = document.getElementById(`a${urlHighlight.from}`)
    if (!el) return
    didScrollRef.current = key
    const id = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => window.clearTimeout(id)
  }, [surah, selected.length, params.ref, urlHighlight])

  useReaderScrollMemory(readerPath, Boolean(surah), Boolean(urlHighlight))

  useEffect(() => {
    if (!Number.isFinite(n) || n < 1 || n > 114) return
    audio.ensureWords(n)
  }, [n, audio.ensureWords])

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(id)
  }, [copied])

  const selectOpen = selected.length > 0
  if (selectOpen) barCountRef.current = selected.length

  useEffect(() => {
    if (selectOpen) {
      setBarMounted(true)
      setBarExiting(false)
      return
    }
    if (!barMounted) return
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setBarMounted(false)
      setBarExiting(false)
      return
    }
    setBarExiting(true)
  }, [selectOpen, barMounted])

  const toggleAyah = useCallback((ayah: number) => {
    setSelected((prev) =>
      prev.includes(ayah) ? prev.filter((x) => x !== ayah) : [...prev, ayah],
    )
  }, [])

  const clearSelection = useCallback(() => {
    setSelected([])
  }, [])

  const copySelection = useCallback(async () => {
    if (!surah || selected.length === 0) return
    const label = lang === 'ru' ? 'Коран' : 'Qur’an'
    const sorted = [...selected].sort((a, b) => a - b)
    const text = sorted
      .map((ayah) => {
        const body = (surah.ayahsTranslation[ayah - 1]?.text ?? '').trim()
        return `${label} ${surah.number}:${ayah}\n${body}`
      })
      .join('\n\n')
    try {
      await writeClipboard(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }, [lang, selected, surah])

  const playerOpen = audio.visible && audio.surah === n
  const chapterWords =
    audio.wordsChapter === n ? audio.wordsByAyah : null
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const barCount = selectOpen ? selected.length : barCountRef.current

  const readerCls = [
    'reader',
    playerOpen ? 'reader--player-open' : '',
    selectOpen ? 'reader--select-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div className={readerCls}>
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
            </header>

            <SurahNav n={n} top lang={lang} />

            <div className="ayah-list">
              {surah.ayahsArabic.map((a, i) => {
                const hit = selectedSet.has(a.numberInSurah)
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
                  'ayah--selectable',
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
                    aria-pressed={hit}
                    onClick={(e) => {
                      const target = e.target as HTMLElement
                      if (target.closest('button, a')) return
                      toggleAyah(a.numberInSurah)
                    }}
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

      {/* Outside .reader: its animation transform breaks position:fixed */}
      {barMounted && (
        <div
          className={[
            'ayah-select-bar',
            playerOpen ? 'ayah-select-bar--above-player' : '',
            barExiting ? 'ayah-select-bar--out' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="toolbar"
          aria-label={t('Выбранные аяты', 'Selected ayahs')}
          aria-hidden={barExiting}
          onAnimationEnd={(e) => {
            if (e.animationName !== 'ayah-select-out') return
            setBarMounted(false)
            setBarExiting(false)
          }}
        >
          <button
            type="button"
            className="ayah-select-bar__btn ayah-select-bar__btn--ghost"
            onClick={clearSelection}
            disabled={barExiting}
          >
            {t('Снять', 'Clear')}
          </button>
          <button
            type="button"
            className={`ayah-select-bar__btn ayah-select-bar__btn--primary${
              copied ? ' ayah-select-bar__btn--done' : ''
            }`}
            onClick={() => void copySelection()}
            disabled={barExiting}
          >
            {copied
              ? t('Скопировано', 'Copied')
              : t(`Копировать (${barCount})`, `Copy (${barCount})`)}
          </button>
        </div>
      )}
    </>
  )
}
