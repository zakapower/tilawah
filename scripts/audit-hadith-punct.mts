import { readFileSync } from 'node:fs'
import { normalizeHadithText } from '../src/utils/hadithText.ts'

const CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1'
const BOOKS = [
  { id: 'bukhari', ru: 'rus-bukhari' },
  { id: 'muslim', ru: 'rus-muslim' },
  { id: 'abudawud', ru: 'rus-abudawud' },
]

const metaRaw = readFileSync(new URL('../src/data/hadithSectionsMeta.ts', import.meta.url), 'utf8')
const sectionIds: Record<string, string[]> = {}
for (const book of BOOKS) {
  const re = new RegExp(`"${book.id}":\\s*\\[([\\s\\S]*?)\\n\\s*\\]`, 'm')
  const block = metaRaw.match(re)?.[1] ?? ''
  sectionIds[book.id] = [...block.matchAll(/"id":\s*"(\d+)"/g)].map((m) => m[1])
}

type Issue = { id: string; n: number; kind: string; sample: string }

const checks: Array<{ kind: string; re: RegExp }> = [
  { kind: 'no-space-after-colon-quote', re: /:[«"“]/ },
  { kind: 'missing-space-after-comma', re: /,[а-яё«"(]/i },
  { kind: 'space-before-colon', re: / \:/ },
  { kind: 'ascii-double-quote', re: /"/ },
  { kind: 'ascii-single-quote', re: /'/ },
  { kind: 'hyphen-not-dash', re: /[а-яё]\s-\s[а-яё]/i },
  { kind: 'broken-ellipsis', re: /\.{4,}/ },
  { kind: 'double-comma', re: /,\s*,/ },
]

const counts = new Map<string, number>()
const samples = new Map<string, Issue[]>()

async function fetchSection(edition: string, sectionId: string) {
  const url = `${CDN}/editions/${edition}/sections/${sectionId}.min.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return (await res.json()) as { hadiths?: Array<{ hadithnumber: number; text: string }> }
}

let total = 0
for (const book of BOOKS) {
  for (const sectionId of sectionIds[book.id] ?? []) {
    const data = await fetchSection(book.ru!, sectionId)
    for (const h of data.hadiths ?? []) {
      const raw = normalizeHadithText(h.text || '')
      const t = raw
      if (!t || !/[а-яё]/i.test(t)) continue
      total++
      for (const c of checks) {
        if (!c.re.test(t)) continue
        counts.set(c.kind, (counts.get(c.kind) ?? 0) + 1)
        const arr = samples.get(c.kind) ?? []
        if (arr.length < 2) {
          const m = t.match(c.re)
          const at = m?.index ?? 0
          arr.push({
            id: `${book.id} §${sectionId} #${h.hadithnumber}`,
            n: h.hadithnumber,
            kind: c.kind,
            sample: t.slice(Math.max(0, at - 25), at + 45).replace(/\s+/g, ' '),
          })
          samples.set(c.kind, arr)
        }
      }
    }
  }
}

console.log(`Scanned ${total} RU hadiths\n`)
for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${k}: ${v}`)
  for (const s of samples.get(k) ?? []) console.log(`  ${s.id}: …${s.sample}…`)
}
