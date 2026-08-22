/** True when a hadith translation looks like finished Russian (not empty / English). */
export function ruTranslationLooksComplete(text: string): boolean {
  const t = normalizeHadithText(text)
  if (!t) return false
  return /[а-яё]/i.test(t)
}

/** Fix literal `\n` / `\r\n` from hadith CDN JSON into real newlines. */
export function normalizeHadithText(text: string): string {
  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim()
}

/** Split "Narrated X: body" / "Сообщается …: body" for a bold lead-in. */
export function splitHadithLead(text: string): { lead: string; body: string } | null {
  const cleaned = normalizeHadithText(text)
  const i = cleaned.indexOf(':')
  if (i <= 0 || i > 140) return null
  const lead = cleaned.slice(0, i + 1)
  const body = cleaned.slice(i + 1)
  if (!body.trim()) return null
  return { lead, body }
}
