'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

function fromReaderToList(from: string, to: string) {
  if ((to === '/' || to === '/quran') && /^\/quran\/\d+/.test(from)) return true
  if (to === '/hadith' && /^\/hadith\/[^/]+/.test(from)) return true
  if (
    /^\/hadith\/[^/]+$/.test(to) &&
    /^\/hadith\/[^/]+\/[^/]+$/.test(from)
  ) {
    return true
  }
  return false
}

/** /quran/3 ↔ /quran/3:70-75 — та же сура, скролл держит SurahView. */
function sameSurahReaderNav(from: string, to: string) {
  const surahOf = (p: string) => {
    const m = /^\/quran\/(\d+)/.exec(p)
    return m ? m[1] : null
  }
  const a = surahOf(from)
  const b = surahOf(to)
  return a != null && a === b
}

/**
 * При смене маршрута — наверх.
 * Исключения: возврат из читалки на список; смена аятного ref внутри одной суры.
 */
export function ScrollToTop() {
  const pathname = usePathname()
  const prevPath = useRef(pathname)

  useLayoutEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
  }, [])

  useLayoutEffect(() => {
    const from = prevPath.current
    prevPath.current = pathname
    if (fromReaderToList(from, pathname)) return
    if (sameSurahReaderNav(from, pathname)) return
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
