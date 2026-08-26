'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react'
import { getReciter, RECITERS } from '@/data/reciters'
import { useQuranAudio } from '@/context/QuranAudioContext'
import { useApp } from '@/context/AppContext'
import './QuranPlayerBar.css'

function PlayPauseIcons({ playing }: { playing: boolean }) {
  return (
    <span className="quran-player__icon-swap" aria-hidden="true">
      <Play
        className={`quran-player__icon quran-player__icon--play${
          playing ? '' : ' is-active'
        }`}
        strokeWidth={2}
      />
      <Pause
        className={`quran-player__icon quran-player__icon--pause${
          playing ? ' is-active' : ''
        }`}
        strokeWidth={2}
      />
    </span>
  )
}

export function QuranPlayerBar() {
  const { t, lang } = useApp()
  const {
    visible,
    playing,
    loading,
    error,
    reciterId,
    surah,
    ayah,
    togglePause,
    close,
    nextAyah,
    prevAyah,
    setReciter,
    retry,
    registerProgressEl,
  } = useQuranAudio()

  const [reciterOpen, setReciterOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const reciterRef = useRef<HTMLDivElement>(null)
  const sheetCloseRef = useRef<HTMLButtonElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const sheetId = useId()
  const current = getReciter(reciterId)
  const refLabel = surah != null && ayah != null ? `${surah}:${ayah}` : '—'

  useEffect(() => {
    if (!reciterOpen || sheetOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!reciterRef.current?.contains(e.target as Node)) {
        setReciterOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReciterOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [reciterOpen, sheetOpen])

  useEffect(() => {
    if (!visible) {
      setReciterOpen(false)
      setSheetOpen(false)
    }
  }, [visible])

  useEffect(() => {
    if (!sheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheetCloseRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [sheetOpen])

  useEffect(() => {
    registerProgressEl(visible ? progressRef.current : null)
    return () => registerProgressEl(null)
  }, [visible, loading, registerProgressEl])

  if (!visible) return null

  const errorBlock = error ? (
    <p className="quran-player__error">
      {error === 'play-failed'
        ? t('Нажмите Play ещё раз', 'Tap Play again')
        : t('Не удалось загрузить аудио', 'Could not load audio')}
      {error !== 'play-failed' && (
        <button type="button" onClick={retry}>
          {t('Повторить', 'Retry')}
        </button>
      )}
    </p>
  ) : null

  return (
    <>
      <div
        className={`quran-player${loading ? ' quran-player--loading' : ''}${
          sheetOpen ? ' quran-player--sheet-open' : ''
        }`}
        role="region"
        aria-busy={loading || undefined}
        aria-label={t('Плеер Корана', 'Qur’an player')}
      >
        <div
          ref={progressRef}
          className="quran-player__progress"
          aria-hidden="true"
        />

        <div className="quran-player__row quran-player__row--desktop">
          <div className="quran-player__side quran-player__side--left">
            <span className="quran-player__ref" aria-live="polite">
              {refLabel}
            </span>
          </div>

          <div className="quran-player__transport">
            <button
              type="button"
              className="quran-player__btn"
              onClick={prevAyah}
              aria-label={t('Предыдущий аят', 'Previous ayah')}
              disabled={loading}
            >
              <SkipBack strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="quran-player__btn quran-player__btn--main"
              onClick={togglePause}
              aria-label={
                playing ? t('Пауза', 'Pause') : t('Слушать', 'Play')
              }
              disabled={loading}
            >
              <PlayPauseIcons playing={playing} />
            </button>
            <button
              type="button"
              className="quran-player__btn"
              onClick={nextAyah}
              aria-label={t('Следующий аят', 'Next ayah')}
              disabled={loading}
            >
              <SkipForward strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <div className="quran-player__side quran-player__side--right">
            <div className="quran-player__reciter" ref={reciterRef}>
              <button
                type="button"
                className={`quran-player__reciter-btn${
                  reciterOpen ? ' is-open' : ''
                }`}
                onClick={() => setReciterOpen((v) => !v)}
                disabled={loading}
                aria-expanded={reciterOpen}
                aria-haspopup="listbox"
                aria-controls={reciterOpen ? listId : undefined}
                aria-label={t('Чтец', 'Reciter')}
              >
                <span className="quran-player__reciter-name">
                  {lang === 'ru' ? current.nameRu : current.nameEn}
                </span>
                <ChevronDown
                  className="quran-player__reciter-chevron"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
              </button>

              {reciterOpen && (
                <div
                  className="quran-player__reciter-menu"
                  id={listId}
                  role="listbox"
                  aria-label={t('Чтецы', 'Reciters')}
                >
                  <p className="quran-player__reciter-title">
                    {t('Чтец', 'Reciter')}
                  </p>
                  {RECITERS.map((r) => {
                    const selected = r.id === reciterId
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`quran-player__reciter-option${
                          selected ? ' is-selected' : ''
                        }`}
                        onClick={() => {
                          setReciter(r.id)
                          setReciterOpen(false)
                        }}
                      >
                        <span>
                          {lang === 'ru' ? r.nameRu : r.nameEn}
                        </span>
                        {selected && (
                          <Check
                            className="quran-player__reciter-check"
                            strokeWidth={2.25}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              className="quran-player__btn"
              onClick={close}
              aria-label={t('Закрыть плеер', 'Close player')}
            >
              <X strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="quran-player__mini">
          <span className="quran-player__ref quran-player__ref--mini" aria-live="polite">
            {refLabel}
          </span>

          <div className="quran-player__mini-transport">
            <button
              type="button"
              className="quran-player__btn"
              onClick={prevAyah}
              aria-label={t('Предыдущий аят', 'Previous ayah')}
              disabled={loading}
            >
              <SkipBack strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="quran-player__btn quran-player__btn--main"
              onClick={togglePause}
              aria-label={
                playing ? t('Пауза', 'Pause') : t('Слушать', 'Play')
              }
              disabled={loading}
            >
              <PlayPauseIcons playing={playing} />
            </button>
            <button
              type="button"
              className="quran-player__btn"
              onClick={nextAyah}
              aria-label={t('Следующий аят', 'Next ayah')}
              disabled={loading}
            >
              <SkipForward strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <div className="quran-player__mini-actions">
            <button
              type="button"
              className="quran-player__btn"
              onClick={() => setSheetOpen(true)}
              aria-expanded={sheetOpen}
              aria-controls={sheetId}
              aria-label={t('Чтец', 'Reciter')}
            >
              <ChevronUp strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="quran-player__btn"
              onClick={close}
              aria-label={t('Закрыть плеер', 'Close player')}
            >
              <X strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>

        {errorBlock}
      </div>

      {sheetOpen && (
        <div className="quran-player-sheet-root">
          <button
            type="button"
            className="quran-player-sheet__backdrop"
            aria-label={t('Закрыть', 'Close')}
            onClick={() => setSheetOpen(false)}
          />
          <div
            id={sheetId}
            className="quran-player-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t('Чтец', 'Reciter')}
          >
            <div className="quran-player-sheet__handle" aria-hidden="true" />
            <div className="quran-player-sheet__head">
              <h2 className="quran-player-sheet__title">
                {t('Чтец', 'Reciter')}
              </h2>
              <button
                ref={sheetCloseRef}
                type="button"
                className="quran-player__btn"
                onClick={() => setSheetOpen(false)}
                aria-label={t('Закрыть', 'Close')}
              >
                <X strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div
              className="quran-player-sheet__reciters"
              role="listbox"
              aria-label={t('Чтецы', 'Reciters')}
            >
              {RECITERS.map((r) => {
                const selected = r.id === reciterId
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`quran-player__reciter-option${
                      selected ? ' is-selected' : ''
                    }`}
                    onClick={() => {
                      const active = document.activeElement
                      if (active instanceof HTMLElement) {
                        active.blur()
                      }
                      setReciter(r.id)
                      setSheetOpen(false)
                    }}
                  >
                    <span>{lang === 'ru' ? r.nameRu : r.nameEn}</span>
                    {selected && (
                      <Check
                        className="quran-player__reciter-check"
                        strokeWidth={2.25}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
