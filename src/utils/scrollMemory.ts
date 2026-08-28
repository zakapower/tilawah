const PREFIX = 'tilawah:scroll:'
const RESTORE = 'tilawah:restore:'
const ANCHOR = 'tilawah:anchor:'
const LAST_SURAH = 'tilawah:lastSurah'
const LAST_HADITH = 'tilawah:lastHadith'

// Полная загрузка страницы (не SPA): не прыгаем по старому «restore»
try {
  for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
    const key = sessionStorage.key(i)
    if (key?.startsWith(RESTORE)) sessionStorage.removeItem(key)
  }
} catch {
  /* ignore */
}

export function saveListScroll(path: string, y = window.scrollY) {
  try {
    sessionStorage.setItem(PREFIX + path, String(Math.round(y)))
    sessionStorage.setItem(RESTORE + path, '1')
  } catch {
    /* ignore */
  }
}

export function saveLastSurah(n: number) {
  try {
    sessionStorage.setItem(LAST_SURAH, String(n))
  } catch {
    /* ignore */
  }
}

export function peekLastSurahAnchor() {
  try {
    const n = Number(sessionStorage.getItem(LAST_SURAH) || 0)
    return n >= 1 && n <= 114 ? `surah-${n}` : null
  } catch {
    return null
  }
}

/** bookId или bookId/sectionId */
export function saveLastHadith(bookId: string, sectionId?: string) {
  try {
    sessionStorage.setItem(
      LAST_HADITH,
      sectionId ? `${bookId}/${sectionId}` : bookId,
    )
  } catch {
    /* ignore */
  }
}

/** sectionId for a book from last visit, e.g. bukhari → "1" */
export function peekLastHadithSection(bookId: string): string | null {
  try {
    const raw = sessionStorage.getItem(LAST_HADITH)
    if (!raw?.startsWith(`${bookId}/`)) return null
    const sectionId = raw.slice(bookId.length + 1)
    return sectionId || null
  } catch {
    return null
  }
}

export function peekLastHadithAnchor(listPath: string) {
  try {
    const raw = sessionStorage.getItem(LAST_HADITH)
    if (!raw) return null
    if (listPath === '/hadith') {
      const bookId = raw.split('/')[0]
      return bookId ? `hadith-book-${bookId}` : null
    }
    const m = /^\/hadith\/([^/]+)$/.exec(listPath)
    if (!m) return null
    const bookId = m[1]
    if (!raw.startsWith(`${bookId}/`)) return null
    const sectionId = raw.slice(bookId.length + 1)
    return sectionId ? `hadith-section-${bookId}-${sectionId}` : null
  } catch {
    return null
  }
}

export function peekListScroll(path: string) {
  try {
    const n = Number(sessionStorage.getItem(PREFIX + path))
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

export function consumeListRestore(path: string) {
  try {
    const key = RESTORE + path
    if (sessionStorage.getItem(key) !== '1') return false
    sessionStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function saveReaderAnchor(path: string, anchorId: string) {
  if (!anchorId) return
  try {
    sessionStorage.setItem(ANCHOR + path, anchorId)
    sessionStorage.setItem(PREFIX + path, String(Math.round(window.scrollY)))
  } catch {
    /* ignore */
  }
}

export function peekReaderAnchor(path: string) {
  try {
    return sessionStorage.getItem(ANCHOR + path)
  } catch {
    return null
  }
}

export function restoreListScroll(path: string, anchorId?: string | null) {
  const y = peekListScroll(path)

  const apply = () => {
    if (y > 0) {
      window.scrollTo(0, y)
      document.documentElement.scrollTop = y
      if (Math.abs(window.scrollY - y) <= 2) return true
      const max =
        document.documentElement.scrollHeight - window.innerHeight
      if (max >= y - 2) {
        window.scrollTo(0, y)
        return Math.abs(window.scrollY - y) <= 2
      }
    }
    if (anchorId) {
      const el = document.getElementById(anchorId)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'auto' })
        return true
      }
    }
    return false
  }

  if (apply()) return () => {}

  let cancelled = false
  let attempts = 0
  const tick = () => {
    if (cancelled) return
    attempts += 1
    if (apply() || attempts >= 100) return
    window.setTimeout(tick, 32)
  }
  requestAnimationFrame(() => requestAnimationFrame(tick))

  return () => {
    cancelled = true
  }
}

/** Аят/хадис, который сейчас на «линии чтения». */
export function findReadingAnchorId(selector = '.ayah-list .ayah[id]') {
  const nodes = document.querySelectorAll(selector)
  if (!nodes.length) return null
  const marker = Math.min(160, window.innerHeight * 0.22)
  let fallback: string | null = null
  let fallbackDist = Infinity

  for (const node of nodes) {
    const el = node as HTMLElement
    const rect = el.getBoundingClientRect()
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue
    if (rect.top <= marker && rect.bottom > marker) return el.id
    const dist = Math.abs(rect.top - marker)
    if (rect.top <= marker && dist < fallbackDist) {
      fallbackDist = dist
      fallback = el.id
    }
  }

  if (fallback) return fallback
  const first = nodes[0] as HTMLElement
  const last = nodes[nodes.length - 1] as HTMLElement
  if (first.getBoundingClientRect().top > marker) return first.id
  return last.id
}

export function restoreReaderAnchor(path: string) {
  const anchorId = peekReaderAnchor(path)
  const y = peekListScroll(path)
  if (!anchorId && y <= 0) return () => {}

  const apply = () => {
    if (anchorId) {
      const el = document.getElementById(anchorId)
      if (el) {
        el.scrollIntoView({ block: 'start', behavior: 'auto' })
        window.scrollBy(0, -72)
        return true
      }
    }
    if (y > 0) {
      window.scrollTo(0, y)
      return (
        Math.abs(window.scrollY - y) <= 2 ||
        document.documentElement.scrollHeight - window.innerHeight >= y - 2
      )
    }
    return false
  }

  if (apply()) return () => {}

  let cancelled = false
  let attempts = 0
  const tick = () => {
    if (cancelled) return
    attempts += 1
    if (apply() || attempts >= 100) return
    window.setTimeout(tick, 32)
  }
  requestAnimationFrame(() => requestAnimationFrame(tick))

  return () => {
    cancelled = true
  }
}
