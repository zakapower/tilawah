/**
 * Site-wide client cache: memory + localStorage.
 * Survives navigation and reloads within the same browser.
 */

const mem = new Map<string, unknown>()
const MAX_KEYS = 96

function storageKey(ns: string) {
  return `tilawah-cache-v4:${ns}`
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function readStore(ns: string): Record<string, unknown> {
  if (!canUseStorage()) return {}
  try {
    const raw = localStorage.getItem(storageKey(ns))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function writeStore(ns: string, data: Record<string, unknown>) {
  if (!canUseStorage()) return
  try {
    const keys = Object.keys(data)
    if (keys.length > MAX_KEYS) {
      for (const k of keys.slice(0, keys.length - MAX_KEYS)) delete data[k]
    }
    localStorage.setItem(storageKey(ns), JSON.stringify(data))
  } catch {
    /* quota / private mode — memory cache still works */
  }
}

export function cacheGet<T>(ns: string, key: string): T | null {
  const full = `${ns}:${key}`
  if (mem.has(full)) return mem.get(full) as T

  const store = readStore(ns)
  if (key in store) {
    const value = store[key] as T
    mem.set(full, value)
    return value
  }
  return null
}

export function cacheSet<T>(
  ns: string,
  key: string,
  value: T,
  options?: { persist?: boolean },
) {
  const full = `${ns}:${key}`
  mem.set(full, value)
  if (options?.persist === false) return
  const store = readStore(ns)
  store[key] = value as unknown
  writeStore(ns, store)
}

/** Fire-and-forget warm of a loader; errors ignored. */
export function warmCache(task: () => Promise<unknown>) {
  void task().catch(() => {})
}
