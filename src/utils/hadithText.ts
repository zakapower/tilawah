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
    /^(it was )?narrated(?:\s|:|$)/i.test(t) ||
    /^reported(?:\s|:|$)/i.test(t) ||
    /^нам\s+(?:рассказал|сообщил)/i.test(t) ||
    /^сообщается/i.test(t) ||
    /^передают/i.test(t) ||
    /^передал/i.test(t) ||
    /^передается/i.test(t) ||
    /^от\s+/i.test(t) ||
    /narrat/i.test(t) ||
    new RegExp(`${RU_SPEECH}\\s*:?\\s*$`, 'i').test(t) ||
    /о том, что\s*$/i.test(t) ||
    /\b(said|asked|reported|narrated)\s*:?\s*$/i.test(t)
  )
}

function finishLead(lead: string): string {
  const l = lead.trim()
  if (l.endsWith(':') || /о том, что$/i.test(l)) return l
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

/** Prefer splitting right after the first colon when matn follows. */
function splitAtFirstColon(text: string): { lead: string; body: string } | null {
  const colon = text.indexOf(':')
  if (colon <= 0 || colon > 400) return null

  const lead = text.slice(0, colon)
  const body = text.slice(colon + 1).trim()
  if (!body) return null

  // Usual case: "…: «матн»" / "…: — матн" / "Narrated X: matn"
  if (new RegExp(`^${QUOTE_START}`).test(body)) {
    return splitAt(lead, body)
  }

  if (/^(it was )?narrated(?:\s|:|$)/i.test(lead) || /^reported(?:\s|:|$)/i.test(lead)) {
    return splitAt(lead, body)
  }

  // Short openers without a colon inside the lead: "Передают со слов X:"
  if (
    /^(?:передают\s+со\s+слов|сообщается,\s*что|сообщается\s+от)/i.test(
      lead,
    ) &&
    !lead.slice(20).includes(':')
  ) {
    return splitAt(lead, body)
  }

  return null
}

/** Last "о том, что" in the isnad opening (long Bukhari-style chains). */
function splitAtRuOtomChto(text: string): { lead: string; body: string } | null {
  const window = text.slice(0, 700)
  const re = /о том, что/giu
  let last = -1
  let m: RegExpExecArray | null
  while ((m = re.exec(window))) last = m.index
  if (last < 10) return null

  const connector = 'о том, что'
  const lead = `${text.slice(0, last).replace(/[,:\s]+$/, '')}, ${connector}`
  const body = text.slice(last + connector.length).trim()
  return splitAt(lead, body)
}

/** Split isnad opener ("Narrated…" / "Сообщается…") from the hadith matn. */
export function splitHadithLead(
  text: string,
): { lead: string; body: string } | null {
  const cleaned = normalizeHadithText(text)
  if (!cleaned) return null

  // 1) First colon — the usual boundary ("Передают со слов X: «…»").
  const colonSplit = splitAtFirstColon(cleaned)
  if (colonSplit) return colonSplit

  // 2) Speech verb + colon + quote/dash.
  const speechQuote = new RegExp(
    `^([\\s\\S]{6,800}?${RU_SPEECH})\\s*:\\s*\\n?\\s*(${QUOTE_START}[\\s\\S]+)$`,
    'iu',
  )
  const sq = cleaned.match(speechQuote)
  if (sq) {
    const hit = splitAt(`${sq[1]}:`, sq[2])
    if (hit) return hit
  }

  // 3) "Сообщается/Передают со слов …, что матн" — only before any colon.
  const soSlov = cleaned.match(
    /^((?:сообщается|передают)\s+со\s+слов[^:]{3,400}?,\s*что)\s*([\s\S].+)$/iu,
  )
  if (soSlov && soSlov[2].trim().length > 8) {
    return { lead: soSlov[1].trim(), body: soSlov[2].trim() }
  }

  // 4) Long isnad: "…, о том, что матн"
  const otom = splitAtRuOtomChto(cleaned)
  if (otom) return otom

  // 5) "Сообщается от X, что матн" — only before any colon.
  const ruThat = cleaned.match(
    /^(сообщается\s+от[^:]{3,280}?,\s*что)\s*([\s\S].+)$/iu,
  )
  if (ruThat && ruThat[2].trim().length > 8) {
    return { lead: ruThat[1].trim(), body: ruThat[2].trim() }
  }

  // 6) EN: "It was narrated from … that matn"
  const enThat = cleaned.match(
    /^((?:it was )?narrated[\s\S]{8,220}?)\s+that\s+([\s\S].+)$/i,
  )
  if (enThat) {
    return { lead: enThat[1].trim(), body: enThat[2].trim() }
  }

  return null
}
