/** EN→RU for hadith gaps when no human Russian edition exists. Results are cached. */

const GTX =
  'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q='
const CONCURRENCY = 6

const mem = new Map<string, string>()

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function storeKey() {
  return 'tilawah-tr-en-ru-v3'
}

function isValidRuTranslation(ru: string, source: string): boolean {
  const t = ru.trim()
  if (!t) return false
  if (!/[а-яё]/i.test(t)) return false
  if (t === source.trim()) return false
  const cyr = (t.match(/[а-яё]/gi) || []).length
  const lat = (t.match(/[a-z]/gi) || []).length
  if (lat > 24 && lat > cyr * 2) return false
  return true
}

function readStore(): Record<string, string> {
  if (!canUseStorage()) return {}
  try {
    const raw = localStorage.getItem(storeKey())
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, string>)
      : {}
  } catch {
    return {}
  }
}

function writeStore(data: Record<string, string>) {
  if (!canUseStorage()) return
  try {
    const keys = Object.keys(data)
    if (keys.length > 4000) {
      for (const k of keys.slice(0, keys.length - 4000)) delete data[k]
    }
    localStorage.setItem(storeKey(), JSON.stringify(data))
  } catch {
    /* quota */
  }
}

export function hashText(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function cacheGet(key: string): string | null {
  if (mem.has(key)) return mem.get(key) ?? null
  const store = readStore()
  if (key in store) {
    mem.set(key, store[key])
    return store[key]
  }
  return null
}

function cacheSet(key: string, value: string) {
  mem.set(key, value)
  const store = readStore()
  store[key] = value
  writeStore(store)
}

function parseGtx(data: unknown): string {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return ''
  return (data[0] as unknown[])
    .map((row) => (Array.isArray(row) && typeof row[0] === 'string' ? row[0] : ''))
    .join('')
    .trim()
}

async function gtxTranslateChunk(text: string): Promise<string> {
  const url = GTX + encodeURIComponent(text)
  // Never force-cache translate responses — failures/empty bodies would stick.
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('translate failed: ' + res.status)
  return parseGtx(await res.json())
}

function chunkText(text: string): string[] {
  // Keep encoded URL length safe for GTX GET (~2–8KB practical limits).
  const max = 900
  if (text.length <= max) return [text]
  const parts: string[] = []
  let rest = text
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max)
    if (cut < max * 0.4) cut = rest.lastIndexOf('. ', max)
    if (cut < max * 0.4) cut = rest.lastIndexOf(' ', max)
    if (cut < max * 0.4) cut = max
    parts.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) parts.push(rest)
  return parts.filter(Boolean)
}

async function translateViaGtx(text: string): Promise<string> {
  const chunks = chunkText(text)
  const out: string[] = []
  for (const chunk of chunks) {
    out.push(await gtxTranslateChunk(chunk))
  }
  return out.join('\n').trim()
}

async function translateViaApi(texts: string[]): Promise<string[]> {
  const res = await fetch('/api/translate-en-ru', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texts }),
  })
  if (!res.ok) throw new Error('translate api failed: ' + res.status)
  const data = (await res.json()) as { translations?: string[] }
  return data.translations ?? texts
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  const n = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

export async function translateEnToRuMany(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return []

  const keys = texts.map((t) => hashText(t))
  const out = new Array<string>(texts.length)
  const missingIdx: number[] = []

  for (let i = 0; i < texts.length; i++) {
    const hit = cacheGet(keys[i])
    if (hit && isValidRuTranslation(hit, texts[i])) out[i] = hit
    else missingIdx.push(i)
  }

  if (missingIdx.length === 0) return out

  const missingTexts = missingIdx.map((i) => texts[i])
  let translated: string[]

  if (typeof window !== 'undefined') {
    try {
      translated = []
      // Match server limits: 40 items / ~12k chars (leave headroom).
      let i = 0
      while (i < missingTexts.length) {
        const batch: string[] = []
        let chars = 0
        while (i < missingTexts.length && batch.length < 24) {
          const t = missingTexts[i]
          if (batch.length > 0 && chars + t.length > 10000) break
          batch.push(t)
          chars += t.length
          i++
        }
        const part = await translateViaApi(batch)
        translated.push(...part)
      }
    } catch {
      translated = await mapPool(missingTexts, CONCURRENCY, (t) =>
        translateViaGtx(t).catch(() => t),
      )
    }
  } else {
    translated = await mapPool(missingTexts, CONCURRENCY, (t) =>
      translateViaGtx(t).catch(() => t),
    )
  }

  for (let j = 0; j < missingIdx.length; j++) {
    const i = missingIdx[j]
    const candidate = (translated[j] || '').trim()
    if (isValidRuTranslation(candidate, texts[i])) {
      out[i] = candidate
      cacheSet(keys[i], candidate)
    } else {
      out[i] = ''
    }
  }

  return out
}

export async function translateEnToRuManyDirect(
  texts: string[],
): Promise<string[]> {
  if (texts.length === 0) return []
  return mapPool(texts, CONCURRENCY, async (t) => {
    const key = hashText(t)
    const hit = cacheGet(key)
    if (hit && isValidRuTranslation(hit, t)) return hit
    try {
      const ru = await translateViaGtx(t)
      if (isValidRuTranslation(ru, t)) {
        cacheSet(key, ru)
        return ru
      }
      return ''
    } catch {
      return ''
    }
  })
}
