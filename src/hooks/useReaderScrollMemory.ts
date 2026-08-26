import { useEffect } from 'react'
import {
  findReadingAnchorId,
  saveReaderAnchor,
} from '../utils/scrollMemory'

/**
 * Сохраняет позицию чтения (на будущее / отладку).
 * При входе в читалку всегда оставляем верх — кроме skip (аят в URL / ?h=).
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

  useEffect(() => {
    if (!path || !ready || skip) return
    window.scrollTo(0, 0)
  }, [path, ready, skip])
}
