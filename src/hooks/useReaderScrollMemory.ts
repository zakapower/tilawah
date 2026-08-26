import { useEffect } from 'react'
import {
  findReadingAnchorId,
  saveReaderAnchor,
} from '../utils/scrollMemory'

/**
 * Сохраняет позицию чтения (на будущее / отладку).
 * Скролл наверх при смене маршрута — в ScrollToTop; здесь не трогаем window.scrollY
 * (иначе /quran/N:a-b → /quran/N сбрасывает якорь после remount).
 */
export function useReaderScrollMemory(
  path: string | null,
  ready: boolean,
  skip = false,
) {
  useEffect(() => {
    if (!path || !ready || skip) return

    const persist = () => {
      const id = findReadingAnchorId()
      if (id) saveReaderAnchor(path, id)
    }

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        persist()
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('pointerdown', persist, true)
    window.addEventListener('pagehide', persist)

    return () => {
      persist()
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('pointerdown', persist, true)
      window.removeEventListener('pagehide', persist)
    }
  }, [path, ready, skip])
}