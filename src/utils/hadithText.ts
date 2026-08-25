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

/** Isnad/matn boundary search stays in the opening stretch only. */
const LEAD_WINDOW = 480
const LEAD_MAX = 450

function looksLikeIsnadLead(lead: string): boolean {
  const t = lead.trim()
  if (t.length < 6 || t.length > LEAD_MAX) return false
  // Matn already started inside the "lead" → wrong (too-late) split.
  if (/[«"“]/.test(t)) return false
  return (
    /^(it was )?narrated(?:\s|:|$)/i.test(t) ||
    /^reported(?:\s|:|$)/i.test(t) ||
    /^нам\s+(?:рассказал|сообщил)/i.test(t) ||
    /^сообщается/i.test(t) ||
    /^передают/i.test(t) ||
    /^передал/i.test(t) ||
    /^передали/i.test(t) ||
    /^рассказал/i.test(t) ||
    /^рассказали/i.test(t) ||
    /^сообщил/i.test(t) ||
    /^передается/i.test(t) ||
    /^от\s+/i.test(t) ||
    /narrat/i.test(t) ||
    new RegExp(`${RU_SPEECH}\\s*:?\\s*$`, 'i').test(t) ||
    /о том, что\s*$/i.test(t) ||
    /\b(said|asked|reported|narrated)\s*:?\s*$/i.test(t)
  )
}

/** Body still continuing the chain, not the matn yet. */
function bodyLooksLikeContinuedIsnad(body: string): boolean {
  const b = body.trim()
  return /^(?:передал(?:а|и)?\s+нам|рассказал(?:а|и)?\s+нам|сообщил(?:а|и)?\s+нам|передают\s+|рассказал(?:а|и)?\s+нам|от\s+[\p{L}'’‘\-])/iu.test(
    b,
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
  if (!b || b.length < 8) return null
  if (bodyLooksLikeContinuedIsnad(b)) return null
  if (!looksLikeIsnadLead(l)) return null
  return { lead: finishLead(l), body: b }
}

/** Prefer splitting right after the first colon when matn follows. */
function splitAtFirstColon(text: string): { lead: string; body: string } | null {
  const colon = text.indexOf(':')
  if (colon <= 0 || colon > LEAD_WINDOW) return null

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

/**
 * First "сказал/сообщил…: «…" inside the opening window.
 * Avoids late dialogue quotes deep in the matn (hadith 2488-style bug).
 */
function splitAtFirstSpeechQuote(
  text: string,
): { lead: string; body: string } | null {
  const window = text.slice(0, LEAD_WINDOW)
  const re = new RegExp(`${RU_SPEECH}\\s*:\\s*(${QUOTE_START})`, 'iu')
  const m = re.exec(window)
  if (!m || m.index == null) return null

  const quoteInMatch = m[0].search(new RegExp(QUOTE_START))
  if (quoteInMatch < 0) return null
  const quoteAt = m.index + quoteInMatch
  const lead = text.slice(0, quoteAt).replace(/\s*$/, '')
  const body = text.slice(quoteAt).trim()
  return splitAt(lead, body)
}

/**
 * Abu Dawud / long chains: "Передал нам …, он сказал: матн"
 * (matn often starts without a quotation mark).
 */
function splitAtChainSaid(text: string): { lead: string; body: string } | null {
  if (
    !/^(?:передал|передали|рассказал|рассказали|сообщил|сообщили)/i.test(text)
  ) {
    return null
  }

  const window = text.slice(0, LEAD_WINDOW)
  const re =
    /(?:^|,\s*|\s+)(?:он|она|они)\s+(?:сказал(?:а|и)?|сообщил(?:а|и)?|рассказал(?:а|и)?)\s*:/giu
  let m: RegExpExecArray | null
  while ((m = re.exec(window))) {
    const colonAt = m.index + m[0].lastIndexOf(':')
    const lead = text.slice(0, colonAt + 1)
    const body = text.slice(colonAt + 1).trim()
    const hit = splitAt(lead, body)
    if (hit) return hit
  }

  return null
}

/** Last "о том, что" in the isnad opening (long Bukhari-style chains). */
function splitAtRuOtomChto(text: string): { lead: string; body: string } | null {
  const window = text.slice(0, LEAD_WINDOW)
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

  // 2) First speech verb + colon + quote in the opening only.
  const speechQuote = splitAtFirstSpeechQuote(cleaned)
  if (speechQuote) return speechQuote

  // 3) "Передал нам …, он сказал: матн" (no quote required).
  const chainSaid = splitAtChainSaid(cleaned)
  if (chainSaid) return chainSaid

  // 4) "Сообщается/Передают со слов …, что матн" — only before any colon.
  const soSlov = cleaned.match(
    /^((?:сообщается|передают)\s+со\s+слов[^:]{3,400}?,\s*что)\s*([\s\S].+)$/iu,
  )
  if (soSlov && soSlov[2].trim().length > 8) {
    const hit = splitAt(soSlov[1], soSlov[2])
    if (hit) return hit
  }

  // 5) Long isnad: "…, о том, что матн"
  const otom = splitAtRuOtomChto(cleaned)
  if (otom) return otom

  // 6) "Сообщается от X, что матн" — only before any colon.
  const ruThat = cleaned.match(
    /^(сообщается\s+от[^:]{3,280}?,\s*что)\s*([\s\S].+)$/iu,
  )
  if (ruThat && ruThat[2].trim().length > 8) {
    const hit = splitAt(ruThat[1], ruThat[2])
    if (hit) return hit
  }

  // 7) EN: "It was narrated from … that matn"
  const enThat = cleaned.match(
    /^((?:it was )?narrated[\s\S]{8,220}?)\s+that\s+([\s\S].+)$/i,
  )
  if (enThat) {
    return splitAt(enThat[1], enThat[2])
  }

  return null
}
