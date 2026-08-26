'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import type { Lang } from '@/data/types'
import { LANG_COOKIE } from '@/lib/lang'

export type Theme = 'light' | 'dark'

const FONT_AR_KEY = 'qh-font-ar'
const FONT_TR_KEY = 'qh-font-tr'
const REDUCE_MOTION_KEY = 'qh-reduce-motion'
export const FONT_SCALE_MIN = 0.7
export const FONT_SCALE_MAX = 1.4
export const FONT_SCALE_STEP = 0.05
export const FONT_SCALE_DEFAULT = 1

interface AppState {
  lang: Lang
  theme: Theme
  themeReady: boolean
  fontAr: number
  fontTr: number
  reduceMotion: boolean
  setLang: (lang: Lang) => void
  setFontAr: (n: number) => void
  setFontTr: (n: number) => void
  setReduceMotion: (on: boolean) => void
  resetFonts: () => void
  toggleLang: () => void
  toggleTheme: () => void
  t: (ru: string, en: string) => string
}

const AppContext = createContext<AppState | null>(null)

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('qh-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return 'dark'
}

function readStoredScale(key: string): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return FONT_SCALE_DEFAULT
    const n = Number(raw)
    if (!Number.isFinite(n)) return FONT_SCALE_DEFAULT
    return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, n))
  } catch {
    return FONT_SCALE_DEFAULT
  }
}

function readStoredReduceMotion(): boolean {
  try {
    return localStorage.getItem(REDUCE_MOTION_KEY) === '1'
  } catch {
    return false
  }
}

function applyReduceMotionAttr(on: boolean) {
  const root = document.documentElement
  if (on) root.setAttribute('data-reduce-motion', '1')
  else root.removeAttribute('data-reduce-motion')
}

function clampScale(n: number) {
  const stepped = Math.round(n / FONT_SCALE_STEP) * FONT_SCALE_STEP
  return Math.min(
    FONT_SCALE_MAX,
    Math.max(FONT_SCALE_MIN, Number(stepped.toFixed(2))),
  )
}

function writeLangCookie(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`
}

function scheduleRouterRefresh(router: { refresh: () => void }) {
  const run = () => {
    try {
      router.refresh()
    } catch {
      /* ignore */
    }
  }
  if (typeof window === 'undefined') {
    run()
    return
  }
  // Paint client lang first, then sync RSC on the next frames.
  requestAnimationFrame(() => {
    requestAnimationFrame(run)
  })
}

export function AppProvider({
  children,
  initialLang,
}: {
  children: ReactNode
  initialLang: Lang
}) {
  const router = useRouter()
  const [lang, setLangState] = useState<Lang>(initialLang)
  const [theme, setTheme] = useState<Theme>('dark')
  const [themeReady, setThemeReady] = useState(false)
  const [fontAr, setFontArState] = useState(FONT_SCALE_DEFAULT)
  const [fontTr, setFontTrState] = useState(FONT_SCALE_DEFAULT)
  const [reduceMotion, setReduceMotionState] = useState(false)

  useEffect(() => {
    setTheme(readStoredTheme())
    setThemeReady(true)
    setFontArState(readStoredScale(FONT_AR_KEY))
    setFontTrState(readStoredScale(FONT_TR_KEY))
    setReduceMotionState(readStoredReduceMotion())
  }, [])

  useEffect(() => {
    setLangState(initialLang)
  }, [initialLang])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    if (!themeReady) return
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.setItem('qh-theme', theme)
    } catch {
      /* ignore */
    }
    if (!document.documentElement.classList.contains('theme-changing')) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('theme-changing')
      })
    })
  }, [theme, themeReady])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--reader-ar-scale', String(fontAr))
    root.style.setProperty('--reader-tr-scale', String(fontTr))
    try {
      localStorage.setItem(FONT_AR_KEY, String(fontAr))
      localStorage.setItem(FONT_TR_KEY, String(fontTr))
    } catch {
      /* ignore */
    }
  }, [fontAr, fontTr])

  useEffect(() => {
    applyReduceMotionAttr(reduceMotion)
    try {
      localStorage.setItem(REDUCE_MOTION_KEY, reduceMotion ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [reduceMotion])

  const value = useMemo<AppState>(
    () => ({
      lang,
      theme,
      themeReady,
      fontAr,
      fontTr,
      reduceMotion,
      setLang: (next) => {
        writeLangCookie(next)
        setLangState(next)
        scheduleRouterRefresh(router)
      },
      setFontAr: (n) => setFontArState(clampScale(n)),
      setFontTr: (n) => setFontTrState(clampScale(n)),
      setReduceMotion: setReduceMotionState,
      resetFonts: () => {
        setFontArState(FONT_SCALE_DEFAULT)
        setFontTrState(FONT_SCALE_DEFAULT)
      },
      toggleLang: () => {
        const next: Lang = lang === 'ru' ? 'en' : 'ru'
        writeLangCookie(next)
        setLangState(next)
        scheduleRouterRefresh(router)
      },
      toggleTheme: () => {
        document.documentElement.classList.add('theme-changing')
        setTheme((t) => (t === 'light' ? 'dark' : 'light'))
      },
      t: (ru, en) => (lang === 'ru' ? ru : en),
    }),
    [lang, theme, themeReady, fontAr, fontTr, reduceMotion, router],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
