export type FavoriteAyah = {
  surah: number
  ayah: number
  snippet: string
  addedAt: number
}

export type FavoriteHadith = {
  bookId: string
  sectionId: string
  number: number
  bookTitle: string
  snippet: string
  addedAt: number
}

export type FavoritesStore = {
  ayahs: FavoriteAyah[]
  hadiths: FavoriteHadith[]
}

const KEY = 'tilawah-favorites-v1'
const MAX = 200

const serverSnapshot: FavoritesStore = { ayahs: [], hadiths: [] }

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function truncate(text: string, max = 180) {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

function readRaw(): FavoritesStore {
  if (!canUseStorage()) return { ayahs: [], hadiths: [] }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ayahs: [], hadiths: [] }
    const parsed = JSON.parse(raw) as Partial<FavoritesStore>
    return {
      ayahs: Array.isArray(parsed.ayahs) ? parsed.ayahs : [],
      hadiths: Array.isArray(parsed.hadiths) ? parsed.hadiths : [],
    }
  } catch {
    return { ayahs: [], hadiths: [] }
  }
}

function persist(store: FavoritesStore) {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* private mode / quota — memory store still works */
  }
}

let snapshot: FavoritesStore | null = null
const listeners = new Set<() => void>()
let storageBound = false

function getSnapshotState(): FavoritesStore {
  if (!snapshot) snapshot = readRaw()
  return snapshot
}

function emitChange() {
  listeners.forEach((l) => l())
}

function commit(next: FavoritesStore) {
  snapshot = next
  emitChange()
  // Persist after notifying UI so storage failures cannot block the toggle.
  persist(next)
}

function onStorage(e: StorageEvent) {
  if (e.key !== KEY && e.key !== null) return
  snapshot = readRaw()
  emitChange()
}

export function getFavoritesSnapshot(): FavoritesStore {
  return getSnapshotState()
}

export function getServerFavoritesSnapshot(): FavoritesStore {
  return serverSnapshot
}

export function subscribeFavorites(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  listeners.add(onChange)
  if (!storageBound) {
    window.addEventListener('storage', onStorage)
    storageBound = true
  }

  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0 && storageBound) {
      window.removeEventListener('storage', onStorage)
      storageBound = false
    }
  }
}

function ayahKey(surah: number, ayah: number) {
  return `${surah}:${ayah}`
}

function hadithKey(bookId: string, sectionId: string, number: number) {
  return `${bookId}:${sectionId}:${number}`
}

export function isAyahFavorite(surah: number, ayah: number) {
  return getFavoritesSnapshot().ayahs.some(
    (a) => a.surah === surah && a.ayah === ayah,
  )
}

export function isHadithFavorite(
  bookId: string,
  sectionId: string,
  number: number,
) {
  return getFavoritesSnapshot().hadiths.some(
    (h) =>
      h.bookId === bookId && h.sectionId === sectionId && h.number === number,
  )
}

export function toggleAyahFavorite(opts: {
  surah: number
  ayah: number
  snippet: string
}) {
  const prev = getFavoritesSnapshot()
  const i = prev.ayahs.findIndex(
    (a) => a.surah === opts.surah && a.ayah === opts.ayah,
  )
  const ayahs =
    i >= 0
      ? prev.ayahs.filter((_, idx) => idx !== i)
      : [
          {
            surah: opts.surah,
            ayah: opts.ayah,
            snippet: truncate(opts.snippet),
            addedAt: Date.now(),
          },
          ...prev.ayahs,
        ].slice(0, MAX)
  commit({ ayahs, hadiths: prev.hadiths })
  return i < 0
}

export function toggleHadithFavorite(opts: {
  bookId: string
  sectionId: string
  number: number
  bookTitle: string
  snippet: string
}) {
  const prev = getFavoritesSnapshot()
  const i = prev.hadiths.findIndex(
    (h) =>
      h.bookId === opts.bookId &&
      h.sectionId === opts.sectionId &&
      h.number === opts.number,
  )
  const hadiths =
    i >= 0
      ? prev.hadiths.filter((_, idx) => idx !== i)
      : [
          {
            bookId: opts.bookId,
            sectionId: opts.sectionId,
            number: opts.number,
            bookTitle: opts.bookTitle,
            snippet: truncate(opts.snippet),
            addedAt: Date.now(),
          },
          ...prev.hadiths,
        ].slice(0, MAX)
  commit({ ayahs: prev.ayahs, hadiths })
  return i < 0
}

export function removeAyahFavorite(surah: number, ayah: number) {
  if (!isAyahFavorite(surah, ayah)) return
  toggleAyahFavorite({ surah, ayah, snippet: '' })
}

export function removeHadithFavorite(
  bookId: string,
  sectionId: string,
  number: number,
) {
  if (!isHadithFavorite(bookId, sectionId, number)) return
  toggleHadithFavorite({
    bookId,
    sectionId,
    number,
    bookTitle: '',
    snippet: '',
  })
}

export { ayahKey, hadithKey }
