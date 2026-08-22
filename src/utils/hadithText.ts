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

const RU_SPEECH =
  '(?:сказал(?:а|и|ший)?|сообщил(?:а|и|ший)?|спросил(?:а|и|ший)?|рассказал(?:а|и|ший)?|передал(?:а|и|ший)?|передавал(?:а|и)?|рассказывал(?:а|и)?)'

const QUOTE_START = '[—–\\-«"“]'

function looksLikeIsnadLead(lead: string): boolean {
  const t = lead.trim()
  if (t.length < 6 || t.length > 800) return false
  return (
    /^(it was )?narrated\b/i.test(t) ||
    /^reported\b/i.test(t) ||
    /^нам\s+(рассказал|сообщил)/i.test(t) ||
    /^сообщается\b/i.test(t) ||
    /^передают\b/i.test(t) ||
    /^передал\b/i.test(t) ||
    /^передается\b/i.test(t) ||
    /^от\s+/i.test(t) ||
    /\bnarrat/i.test(t) ||
    new RegExp(`${RU_SPEECH}\\s*:?\\s*$`, 'i').test(t) ||
    /(?:о том, что|то, что)\s*$/i.test(t) ||
    /,\s*что\s*$/i.test(t) ||
    /\b(said|asked|reported|narrated)\s*:?\s*$/i.test(t)
  )
}

function finishLead(lead: string): string {
  const l = lead.trim()
  if (
    l.endsWith(':') ||
    /,\s*что$/i.test(l) ||
    /о том, что$/i.test(l) ||
    /\bто, что$/i.test(l)
  ) {
    return l
  }
  return `${l}:`
}

function splitAt(
  lead: string,
  body: string,
): { lead: string; body: string } | null {
  const l = lead.trim()
  const b = body.trim()
  if (!b || !looksLikeIsnadLead(l)) return null
  return { lead: finishLead(l), body: b }
}

/**
 * Index of "о том, что" / "то, что" that ends the isnad opening.
 * Prefer the last marker in the first ~700 chars so chained
 * "рассказал … о том, что X … о том, что matn" keeps the matn only.
 */
function findRuThatIndex(text: string): number {
  const window = text.slice(0, 700)
  const re = /о том, что|то, что/giu
  let last = -1
  let m: RegExpExecArray | null
  while ((m = re.exec(window))) last = m.index
  return last
}

/** Split isnad opener ("Narrated…" / "Сообщается…") from the hadith matn. */
export function splitHadithLead(
  text: string,
): { lead: string; body: string } | null {
  const cleaned = normalizeHadithText(text)
  if (!cleaned) return null

  // 1) RU long chains: split on first "о том, что" / "то, что" in the opening.
  const thatAt = findRuThatIndex(cleaned)
  if (thatAt >= 10) {
    const connectorMatch = cleaned.slice(thatAt).match(/^(о том, что|то, что)\s+/iu)
    if (connectorMatch) {
      const lead = `${cleaned.slice(0, thatAt).replace(/[,:\s]+$/, '')}, ${connectorMatch[1]}`
      const body = cleaned.slice(thatAt + connectorMatch[0].length)
      const hit = splitAt(lead, body)
      if (hit) return hit
    }
  }

  // 2) Speech verb + colon + dash/quote (EN/RU). First boundary only.
  const speechQuote = new RegExp(
    `^([\\s\\S]{6,800}?${RU_SPEECH})\\s*:\\s*\\n?\\s*(${QUOTE_START}[\\s\\S]+)$`,
    'iu',
  )
  const sq = cleaned.match(speechQuote)
  if (sq) {
    const hit = splitAt(`${sq[1]}:`, sq[2])
    if (hit) return hit
  }

  // 3) "Сообщается/Передают со слов …, что матн"
  const soSlov = cleaned.match(
    /^((?:сообщается|передают)\s+со\s+слов[\s\S]{3,400}?,\s*что)\s*([\s\S].+)$/iu,
  )
  if (soSlov && soSlov[2].trim().length > 8) {
    return { lead: soSlov[1].trim(), body: soSlov[2].trim() }
  }

  // 4) "Передают со слов X: матн"
  const peredayutColon = cleaned.match(
    /^(передают\s+со\s+слов[\s\S]{3,280}?):\s*\n?\s*([\s\S].+)$/iu,
  )
  if (peredayutColon && peredayutColon[2].trim().length > 8) {
    return {
      lead: finishLead(peredayutColon[1]),
      body: peredayutColon[2].trim(),
    }
  }

  // 5) Colon immediately before quoted matn.
  const quoted = cleaned.match(
    new RegExp(`^([\\s\\S]{6,800}?):\\s*\\n?\\s*(${QUOTE_START}[\\s\\S]+)$`),
  )
  if (quoted) {
    const hit = splitAt(quoted[1], quoted[2])
    if (hit) return hit
  }

  // 6) EN: "Narrated …: matn"
  const colon = cleaned.indexOf(':')
  if (colon > 0 && colon <= 220) {
    const lead = cleaned.slice(0, colon)
    if (/^(it was )?narrated\b/i.test(lead) || /^reported\b/i.test(lead)) {
      const hit = splitAt(lead, cleaned.slice(colon + 1))
      if (hit) return hit
    }
  }

  // 7) RU: "Сообщается от X, что матн"
  const ruThat = cleaned.match(/^(.{10,400}?,\s*что)\s*([\s\S].+)$/i)
  if (
    ruThat &&
    /сообщается|передал|рассказал|передается|передают/i.test(ruThat[1]) &&
    ruThat[2].trim().length > 8
  ) {
    return { lead: ruThat[1].trim(), body: ruThat[2].trim() }
  }

  // 8) EN: "It was narrated from … that matn"
  const enThat = cleaned.match(
    /^((?:it was )?narrated[\s\S]{8,220}?)\s+that\s+([\s\S].+)$/i,
  )
  if (enThat) {
    return { lead: enThat[1].trim(), body: enThat[2].trim() }
  }

  return null
}
