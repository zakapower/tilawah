'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Settings } from 'lucide-react'
import {
  FONT_SCALE_DEFAULT,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  useApp,
} from '../context/AppContext'
import './SettingsPopover.css'

export function SettingsPopover({
  variant = 'icon',
}: {
  variant?: 'icon' | 'menu'
}) {
  const {
    t,
    fontAr,
    fontTr,
    setFontAr,
    setFontTr,
    resetFonts,
  } = useApp()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const dirty =
    fontAr !== FONT_SCALE_DEFAULT || fontTr !== FONT_SCALE_DEFAULT

  return (
    <div
      className={`settings${variant === 'menu' ? ' settings--menu' : ''}`}
      ref={rootRef}
    >
      {variant === 'menu' ? (
        <button
          type="button"
          className={`site-menu__action${open ? ' is-active' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? titleId : undefined}
        >
          <Settings
            className="site-menu__action-icon"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>{t('Настройки', 'Settings')}</span>
        </button>
      ) : (
        <button
          type="button"
          className={`ctrl${open ? ' ctrl--open' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? titleId : undefined}
          aria-label={t('Настройки', 'Settings')}
          title={t('Настройки', 'Settings')}
        >
          <span className="ctrl__stack" aria-hidden="true">
            <Settings className="ctrl__gear" strokeWidth={2} />
          </span>
        </button>
      )}

      {open && (
        <div
          className="settings__panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <h2 id={titleId} className="settings__title">
            {t('Размер текста', 'Text size')}
          </h2>
          <p className="settings__hint">
            {t(
              'Для аятов и хадисов.',
              'For ayahs and hadiths.',
            )}
          </p>

          <label className="settings__row">
            <span className="settings__label">
              {t('Арабский', 'Arabic')}
              <span className="settings__value">{Math.round(fontAr * 100)}%</span>
            </span>
            <input
              type="range"
              min={FONT_SCALE_MIN}
              max={FONT_SCALE_MAX}
              step={FONT_SCALE_STEP}
              value={fontAr}
              onChange={(e) => setFontAr(Number(e.target.value))}
            />
          </label>

          <label className="settings__row">
            <span className="settings__label">
              {t('Перевод', 'Translation')}
              <span className="settings__value">{Math.round(fontTr * 100)}%</span>
            </span>
            <input
              type="range"
              min={FONT_SCALE_MIN}
              max={FONT_SCALE_MAX}
              step={FONT_SCALE_STEP}
              value={fontTr}
              onChange={(e) => setFontTr(Number(e.target.value))}
            />
          </label>

          <button
            type="button"
            className="settings__reset"
            disabled={!dirty}
            onClick={resetFonts}
          >
            {t('Сбросить', 'Reset')}
          </button>
        </div>
      )}
    </div>
  )
}
