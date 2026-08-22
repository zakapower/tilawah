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

function looksLikeIsnadLead(lead: string): boolean {
  const t = lead.trim()
  if (t.length < 8 || t.length > 220) return false
  return (
    /^(it was )?narrated\b/i.test(t) ||
    /^reported\b/i.test(t) ||
    /^(нам )?рассказал/i.test(t) ||
    /^сообщается/i.test(t) ||
    /^передал/i.test(t) ||
    /^передается/i.test(t) ||
    /\b(сказал|сообщил|спросил|рассказал|передал|рассказывал|передавал)\s*:?\s*$/i.test(
      t,
    ) ||
    /\b(said|asked|reported|narrated)\s*:?\s*$/i.test(t) ||
    /\bnarrat/i.test(t)
  )
}

function splitAt(lead: string, body: string): { lead: string; body: string } | null {
  const l = lead.trim()
  const b = body.trim()
  if (!b || !looksLikeIsnadLead(l)) return null
  const displayLead =
    l.endsWith(':') || /,\s*что$/i.test(l) ? l : `${l}:`
  return { lead: displayLead, body: b }
}

/** Split isnad opener ("Narrated…" / "Сообщается…") from the hadith matn. */
export function splitHadithLead(text: string): { lead: string; body: string } | null {
  const cleaned = normalizeHadithText(text)
  if (!cleaned) return null

  // RU: "…сказал:\n— матн" / "…сказал: «матн"
  const ruMatn = cleaned.match(
    /^([\s\S]{8,220}?(?:сказал|сообщил|спросил|передал|рассказал|передавал))\s*:\s*\n?\s*([—«"][\s\S]+)$/iu,
  )
  if (ruMatn) {
    const hit = splitAt(`${ruMatn[1]}:`, ruMatn[2])
    if (hit) return hit
  }

  // Colon immediately before quoted matn (EN/RU).
  const quoted = cleaned.match(/^([\s\S]{8,220}?):\s*\n?\s*([—«"][\s\S]+)$/)
  if (quoted) {
    const hit = splitAt(quoted[1], quoted[2])
    if (hit) return hit
  }

  // EN: "Narrated …: matn"
  const colon = cleaned.indexOf(':')
  if (colon > 0 && colon <= 200) {
    const hit = splitAt(cleaned.slice(0, colon), cleaned.slice(colon + 1))
    if (hit) return hit
  }

  // RU: "…, что матн"
  const ruThat = cleaned.match(/^(.{10,180}?,\s*что)\s+([\s\S].+)$/i)
  if (ruThat && /сообщается|передал|рассказал|передается/i.test(ruThat[1])) {
    return { lead: ruThat[1].trim(), body: ruThat[2].trim() }
  }

  // EN: "It was narrated from … that matn"
  const enThat = cleaned.match(
    /^((?:it was )?narrated[\s\S]{8,180}?)\s+that\s+([\s\S].+)$/i,
  )
  if (enThat) {
    return { lead: enThat[1].trim(), body: enThat[2].trim() }
  }

  return null
}
