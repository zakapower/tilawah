import { readFileSync } from 'node:fs'
import { splitHadithLead, normalizeHadithText, ruTranslationLooksComplete } from '../src/utils/hadithText.ts'

const CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1'

const BOOKS: Array<{ id: string; ru?: string; en: string }> = [
  { id: 'bukhari', ru: 'rus-bukhari', en: 'eng-bukhari' },
  { id: 'muslim', ru: 'rus-muslim', en: 'eng-muslim' },
  { id: 'abudawud', ru: 'rus-abudawud', en: 'eng-abudawud' },
  { id: 'tirmidhi', en: 'eng-tirmidhi' },
  { id: 'nasai', en: 'eng-nasai' },
  { id: 'ibnmajah', en: 'eng-ibnmajah' },
]

const metaRaw = readFileSync(new URL('../src/data/hadithSectionsMeta.ts', import.meta.url), 'utf8')
const sectionIds: Record<string, string[]> = {}
for (const book of BOOKS) {
  const re = new RegExp(`"${book.id}":\\s*\\[([\\s\\S]*?)\\n\\s*\\]`, 'm')
  const block = metaRaw.match(re)?.[1] ?? ''
  sectionIds[book.id] = [...block.matchAll(/"id":\s*"(\d+)"/g)].map((m) => m[1])
}

type Row = { book: string; section: string; n: number; text: string; lang: 'ru' | 'en' }

async function fetchSection(edition: string, sectionId: string) {
  const url = `${CDN}/editions/${edition}/sections/${sectionId}.min.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return (await res.json()) as { hadiths?: Array<{ hadithnumber: number; text: string }> }
}

function opener(text: string, max = 80) {
  const t = normalizeHadithText(text)
  const cut = t.slice(0, max)
  return cut.replace(/\s+/g, ' ')
}

function classifyRuFail(text: string) {
  const t = foldHint(text)
  if (/^переда/i.test(t)) return 'переда*'
  if (/^сообщ/i.test(t)) return 'сообщ*'
  if (/^передал/i.test(t)) return 'передал*'
  if (/^нам\s/i.test(t)) return 'нам …'
  if (/^рассказ/i.test(t)) return 'рассказ*'
  if (/^от\s/i.test(t)) return 'от …'
  if (/:/.test(t.slice(0, 120))) return 'has-colon'
  if (/,\s*что/.test(t.slice(0, 200))) return 'comma-chto'
  if (/о том, что/.test(t.slice(0, 300))) return 'otom-chto'
  return 'other'
}

function foldHint(text: string) {
  return text.replace(/ё/g, 'е').replace(/Ё/g, 'Е').toLowerCase()
}

async function auditLang(book: string, edition: string, lang: 'ru' | 'en', ids: string[]) {
  const rows: Row[] = []
  for (const sectionId of ids) {
    const data = await fetchSection(edition, sectionId)
    for (const h of data.hadiths ?? []) {
      const text = normalizeHadithText(h.text || '')
      if (!text || text.length < 20) continue
      if (lang === 'ru' && !ruTranslationLooksComplete(text)) continue
      rows.push({ book, section: sectionId, n: h.hadithnumber, text, lang })
    }
  }
  return rows
}

const ruFails: Row[] = []
const enFails: Row[] = []
const ruFailBuckets = new Map<string, number>()
const samples = new Map<string, Row[]>()

let ruTotal = 0
let enTotal = 0
let ruOk = 0
let enOk = 0

for (const book of BOOKS) {
  const ids = sectionIds[book.id] ?? []
  console.error(`Auditing ${book.id} EN (${ids.length} sections)...`)
  const enRows = await auditLang(book.id, book.en, 'en', ids)
  for (const r of enRows) {
    enTotal++
    if (splitHadithLead(r.text)) enOk++
    else enFails.push(r)
  }

  if (book.ru) {
    console.error(`Auditing ${book.id} RU (${ids.length} sections)...`)
    const ruRows = await auditLang(book.id, book.ru!, 'ru', ids)
    for (const r of ruRows) {
      ruTotal++
      const hit = splitHadithLead(r.text)
      if (hit) {
        ruOk++
      } else {
        ruFails.push(r)
        const bucket = classifyRuFail(r.text)
        ruFailBuckets.set(bucket, (ruFailBuckets.get(bucket) ?? 0) + 1)
        const arr = samples.get(bucket) ?? []
        if (arr.length < 3) {
          arr.push(r)
          samples.set(bucket, arr)
        }
      }
    }
  }
}

console.log('\n=== SUMMARY ===')
console.log(`EN split: ${enOk}/${enTotal} (${((enOk / enTotal) * 100).toFixed(1)}%)`)
console.log(`RU split: ${ruOk}/${ruTotal} (${((ruOk / ruTotal) * 100).toFixed(1)}%)`)
console.log(`EN failures: ${enFails.length}`)
console.log(`RU failures: ${ruFails.length}`)

console.log('\n=== RU failure buckets ===')
for (const [k, v] of [...ruFailBuckets.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`)
}

console.log('\n=== RU failure samples ===')
for (const [bucket, arr] of samples) {
  console.log(`\n-- ${bucket} --`)
  for (const r of arr) {
    console.log(`${r.book} §${r.section} #${r.n}: ${opener(r.text, 120)}`)
  }
}

if (enFails.length) {
  console.log('\n=== EN failure samples (first 5) ===')
  for (const r of enFails.slice(0, 5)) {
    console.log(`${r.book} §${r.section} #${r.n}: ${opener(r.text, 120)}`)
  }
}
