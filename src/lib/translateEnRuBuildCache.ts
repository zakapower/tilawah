import 'server-only'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { hashText, translateEnToRuManyDirect } from './translateEnRu'

const CACHE_PATH = join(process.cwd(), '.cache', 'translate-en-ru.json')

let store: Record<string, string> | null = null
let dirty = false

function loadStore(): Record<string, string> {
  if (store) return store
  try {
    if (!existsSync(CACHE_PATH)) {
      store = {}
      return store
    }
    const parsed = JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) as unknown
    store =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, string>)
        : {}
  } catch {
    store = {}
  }
  return store
}

function flushStore() {
  if (!dirty || !store) return
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true })
    writeFileSync(CACHE_PATH, JSON.stringify(store))
    dirty = false
  } catch {
    /* read-only FS */
  }
}

/** Build-time EN→RU with a persistent disk cache across SSG workers. */
export async function translateEnToRuManyForBuild(
  texts: string[],
): Promise<string[]> {
  if (texts.length === 0) return []

  const disk = loadStore()
  const out = new Array<string>(texts.length)
  const missingIdx: number[] = []
  const missingTexts: string[] = []

  for (let i = 0; i < texts.length; i++) {
    const key = hashText(texts[i])
    const hit = disk[key]
    if (hit) out[i] = hit
    else {
      missingIdx.push(i)
      missingTexts.push(texts[i])
    }
  }

  if (missingTexts.length === 0) return out

  const translated = await translateEnToRuManyDirect(missingTexts)
  for (let j = 0; j < missingIdx.length; j++) {
    const i = missingIdx[j]
    const ru = (translated[j] || '').trim()
    // Never persist English fallbacks as Russian.
    if (!ru || !/[а-яё]/i.test(ru)) {
      out[i] = ''
      continue
    }
    const cyr = (ru.match(/[а-яё]/gi) || []).length
    const lat = (ru.match(/[a-z]/gi) || []).length
    if (lat > 24 && lat > cyr * 2) {
      out[i] = ''
      continue
    }
    out[i] = ru
    disk[hashText(texts[i])] = ru
    dirty = true
  }

  flushStore()
  return out
}
