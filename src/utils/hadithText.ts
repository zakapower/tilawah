/** True when a hadith translation looks like finished Russian (not empty / English). */
export function ruTranslationLooksComplete(text: string): boolean {
  const t = normalizeHadithText(text)
  if (!t) return false
  if (!/[а-яё]/i.test(t)) return false
  // Reject failed MT that left mostly-Latin text in the RU slot.
  const cyr = (t.match(/[а-яё]/gi) || []).length
  const lat = (t.match(/[a-z]/gi) || []).length
  if (lat > 24 && lat > cyr * 2) return false
  return true
}

/** Fix literal `\n` / `\r\n` from hadith CDN JSON into real newlines. */
export function normalizeHadithText(text: string): string {
  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim()
}

/** Fold ё→е for regex matching; indices stay aligned with the original string. */
function foldRuYo(text: string): string {
  return text.replace(/ё/g, 'е').replace(/Ё/g, 'Е')
}

const RU_SPEECH =
  '(?:сказал(?:а|и|ший)?|сообщил(?:а|и|ший)?|спросил(?:а|и|ший)?|рассказал(?:а|и|ший)?|передал(?:а|и|ший)?|передавал(?:а|и)?|рассказывал(?:а|и)?)'

const QUOTE_START = '[—–\\-«"“]'

/** Isnad/matn boundary search stays in the opening stretch only. */
const LEAD_WINDOW = 480
const LEAD_MAX = 450

const RU_OPENER =
  '(?:сообща(?:ет|ют|ется)|переда(?:е|ё)тся|передают|передано|передается|повествуется|рассказано|было\\s+передано|рассказыва(?:ет|ют|ется))'

function looksLikeIsnadLead(lead: string): boolean {
  const t = foldRuYo(lead.trim())
  if (t.length < 6 || t.length > LEAD_MAX) return false
  // Matn already started inside the "lead" → wrong (too-late) split.
  if (/[«"“]/.test(t)) return false
  return (
    /^(it was )?narrated(?:\s|:|$)/i.test(t) ||
    /^(it (?:is|was) )?(?:narrated|reported)(?:\s|:|$)/i.test(t) ||
    /^reported(?:\s|:|$)/i.test(t) ||
    /^нам\s+(?:рассказал|сообщил)/i.test(t) ||
    /^сообща/i.test(t) ||
    /^переда/i.test(t) ||
    /^передал/i.test(t) ||
    /^передали/i.test(t) ||
    /^рассказ/i.test(t) ||
    /^рассказы/i.test(t) ||
    /^сообщил/i.test(t) ||
    /^передается/i.test(t) ||
    /^передано/i.test(t) ||
    /^повествуется/i.test(t) ||
    /^рассказано/i.test(t) ||
    /^было\s+передано/i.test(t) ||
    /^от\s+/i.test(t) ||
    /,\s*(?:передал(?:а|и)?|передавал(?:а|и)?|сообщил(?:а|и)?|рассказал(?:а|и)?)\s*$/i.test(t) ||
    /narrat/i.test(t) ||
    /\breported\b/i.test(t) ||
    new RegExp(`${RU_SPEECH}\\s*:?\\s*$`, 'i').test(t) ||
    /(?:о том,|,\s*)что\s*$/i.test(t) ||
    /\b(said|asked|reported|narrated)\s*:?\s*$/i.test(t)
  )
}

/** Body still continuing the chain, not the matn yet. */
function bodyLooksLikeContinuedIsnad(body: string): boolean {
  const b = body.trim()
  return /^(?:передал(?:а|и)?\s+нам|рассказал(?:а|и)?\s+нам|сообщил(?:а|и)?\s+нам|передают\s+|от\s+[\p{L}'’‘\-]|it (?:is|was) (?:narrated|reported)|narrated\s)/iu.test(
    b,
  )
}

function finishLead(lead: string): string {
  const l = lead.trim()
  if (l.endsWith(':') || /(?:о том,|,\s*)что$/i.test(foldRuYo(l))) return l
  return `${l}:`
}

function splitAt(
  lead: string,
  body: string,
): { lead: string; body: string } | null {
  const l = lead.trim()
  const b = body.trim().replace(/^,\s*/, '')
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

  const leadFold = foldRuYo(lead)
  // RU: wrong colon deep in matn after ", что" / "передал, что" — skip.
  if (
    /[а-яё]/i.test(lead) &&
    (/,?\s*что\b/i.test(leadFold) ||
      /(?:передал(?:а|и)?|передавал(?:а|и)?|рассказал(?:а|и)?|сообщил(?:а|и)?),\s*что/i.test(
        leadFold,
      ))
  ) {
    return null
  }

  // Usual case: "…: «матн»" / "…: — матн" / "Narrated X: matn"
  if (new RegExp(`^${QUOTE_START}`).test(body)) {
    return splitAt(lead, body)
  }

  if (
    /^(it was )?narrated(?:\s|:|$)/i.test(lead) ||
    /^(it (?:is|was) )?(?:narrated|reported)/i.test(lead) ||
    /^reported(?:\s|:|$)/i.test(lead) ||
    /\bnarrated\b/i.test(lead) ||
    /\breported\b/i.test(lead)
  ) {
    return splitAt(lead, body)
  }

  // Short RU openers / MT openers
  if (
    /^(?:переда(?:е|ё)тся|передают\s+со\s+слов|сообща(?:ет|ют|ется)(?:,\s*что|\s+от|\s+со\s+слов)?|сообщается,\s*что|сообщается\s+от|передано\s+от|передается\s+от|повествуется\s+от|рассказано\s+от|было\s+передано\s+от)/i.test(
      leadFold,
    ) &&
    !lead.slice(20).includes(':')
  ) {
    return splitAt(lead, body)
  }

  // "Имя сказал:" / "Name said:"
  if (new RegExp(`${RU_SPEECH}\\s*$`, 'i').test(leadFold) || /\b(?:said|asked)\s*$/i.test(leadFold)) {
    return splitAt(lead, body)
  }

  return null
}

/**
 * First "сказал/сообщил…: «…" inside the opening window.
 * Avoids late dialogue quotes deep in the matn.
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
    !/^(?:передал|передали|рассказал|рассказали|сообщил|сообщили|нам\s+(?:рассказал|сообщил)|рассказал\s+нам)/i.test(
      foldRuYo(text),
    )
  ) {
    return null
  }

  const window = text.slice(0, LEAD_WINDOW)
  const re =
    /(?:^|,\s*|\s+)(?:(?:он|она|они)|(?:\([^)]*сказал[^)]*\))|(?:[\p{L}''\-\.]+(?:\s+[\p{L}''\-\.]+){0,4}))\s*(?:сказал(?:а|и|авший)?|сказавший|сообщил(?:а|и|авший)?|сообщивший|рассказал(?:а|и|авший)?|рассказавший)\s*:/giu
  let m: RegExpExecArray | null
  let lastHit: { lead: string; body: string } | null = null
  while ((m = re.exec(window))) {
    const colonAt = m.index + m[0].lastIndexOf(':')
    const lead = text.slice(0, colonAt + 1)
    const body = text.slice(colonAt + 1).trim()
    const hit = splitAt(lead, body)
    if (hit) lastHit = hit
  }

  return lastHit
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

/** EN: "It was narrated from X that …" / "on the authority of X that …" */
function splitAtEnThat(text: string): { lead: string; body: string } | null {
  const patterns = [
    /^((?:it (?:is|was) )?(?:narrated|reported) on the authority of[\s\S]{3,200}?)\s+that\s+/i,
    /^((?:it was )?narrated from[\s\S]{3,200}?)\s+that\s+/i,
    /^((?:it was )?narrated that[\s\S]{3,160}?)\s+(?=["“«—–])/i,
    /^((?:it was )?narrated[\s\S]{8,220}?)\s+that\s+/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (!m) continue
    const lead = m[1]
    const body = text.slice(m[0].length).trim()
    const hit = splitAt(lead, body)
    if (hit) return hit
  }
  return null
}

/** EN: "Abu Hurairah narrated that …" / "Anas said: …" */
function splitAtNameNarrated(text: string): { lead: string; body: string } | null {
  const narratedThat = text.match(
    /^([\p{L}][\p{L}\d\s.'’‘\-]{2,100}?)\s+narrated\s+that\s+([\s\S]+)$/iu,
  )
  if (narratedThat) {
    const hit = splitAt(`${narratedThat[1]} narrated that`, narratedThat[2])
    if (hit) return hit
  }

  const reported = text.match(
    /^([\p{L}][\p{L}\d\s.'’‘\-]{2,100}?)\s+reported\s*:?\s+([\s\S]+)$/iu,
  )
  if (reported) {
    const hit = splitAt(`${reported[1]} reported`, reported[2])
    if (hit) return hit
  }

  return null
}

/** RU: "Передаётся от X, что матн" / "Сообщается, что …" (no colon). */
function splitAtRuCommaChto(
  cleaned: string,
  folded: string,
): { lead: string; body: string } | null {
  const patterns = [
    new RegExp(
      `^((?:${RU_OPENER})\\s+от[^:]{3,280}?,\\s*что)\\s*([\\s\\S]+)$`,
      'iu',
    ),
    new RegExp(
      `^((?:${RU_OPENER})(?:,\\s*от|\\s+от|\\s+со\\s+слов|\\s*)[^:]{3,320}?,\\s*что)\\s*([\\s\\S]+)$`,
      'iu',
    ),
    new RegExp(
      `^((?:${RU_OPENER})\\s+со\\s+слов[^:]{3,400}?,\\s*что)\\s*([\\s\\S]+)$`,
      'iu',
    ),
    new RegExp(`^((?:${RU_OPENER})\\s+что)\\s*([\\s\\S]+)$`, 'iu'),
    new RegExp(`^((?:${RU_OPENER}),\\s*что)\\s*([\\s\\S]+)$`, 'iu'),
  ]

  for (const re of patterns) {
    const m = folded.match(re)
    if (!m || m[2].trim().length < 8) continue
    const gap = m[0].length - m[1].length - m[2].length
    const hit = splitAt(cleaned.slice(0, m[1].length), cleaned.slice(m[1].length + gap))
    if (hit) return hit
  }

  return null
}

/** RU: "Имя …, передал, что матн" / "… передавал со слов X, что …". */
function splitAtRuPeredalChto(
  cleaned: string,
  folded: string,
): { lead: string; body: string } | null {
  const patterns = [
    /^(.{3,280}?\s+(?:передал(?:а|и)?|передавал(?:а|и)?|сообщил(?:а|и)?|рассказал(?:а|и)?)),\s*что\s*([\s\S]+)$/iu,
    /^(.{10,280}?,\s*(?:передал(?:а|и)?|передавал(?:а|и)?|сообщил(?:а|и)?|рассказал(?:а|и)?)),\s*что\s*([\s\S]+)$/iu,
    /^(.{10,320}?передавал(?:а|и)?\s+со\s+слов[^:]{3,220}?,\s*что)\s*([\s\S]+)$/iu,
    /^((?:рассказывал(?:а|и)?|рассказал(?:а|и)?)\s+[^:]{3,280}?)(?::|,\s*что)\s*([\s\S]+)$/iu,
    /^((?:от)\s+[^:]{3,220}?,\s*(?:передавш(?:его|ая|ий|ем)|со\s+слов)[^:]{0,160}?,\s*что)\s*([\s\S]+)$/iu,
    /^((?:от)\s+[^:]{3,220}?)\s+(?:приводится|переда(?:е|ё)тся)\s+([\s\S]+)$/iu,
  ]

  for (const re of patterns) {
    const m = folded.match(re)
    if (!m || m[2].trim().length < 8) continue
    const gap = m[0].length - m[1].length - m[2].length
    const hit = splitAt(cleaned.slice(0, m[1].length), cleaned.slice(m[1].length + gap))
    if (hit) return hit
  }

  return null
}

function splitAtRuQuoteMatn(text: string): { lead: string; body: string } | null {
  const fold = foldRuYo(text)
  if (!/^(?:рассказ|переда|сообщ|передал|нам\s+(?:рассказ|сообщ))/i.test(fold)) return null

  const window = text.slice(0, LEAD_WINDOW)
  const qIdx = window.indexOf('«')
  if (qIdx < 24) return null

  const lead = window.slice(0, qIdx).replace(/[\s,;]+$/, '')
  const tail = foldRuYo(lead.slice(-48))
  if (
    !/[:;]$/.test(lead) &&
    !/(?:,\s*что|о том, что|сказал(?:а|и)?|сказавший|дополнив|сообщил(?:а|и)?)$/.test(tail)
  ) {
    return null
  }

  const body = text.slice(text.indexOf('«', qIdx)).trim()
  return splitAt(lead, body)
}

function splitFromFoldedMatch(
  cleaned: string,
  m: RegExpMatchArray,
): { lead: string; body: string } | null {
  const gap = m[0].length - m[1].length - m[2].length
  return splitAt(cleaned.slice(0, m[1].length), cleaned.slice(m[1].length + gap))
}

/** Split isnad opener ("Narrated…" / "Сообщается…") from the hadith matn. */
export function splitHadithLead(
  text: string,
): { lead: string; body: string } | null {
  const cleaned = normalizeHadithText(text)
  if (!cleaned) return null
  const folded = foldRuYo(cleaned)

  // 1) RU "… от X, что матн" / "Сообщают со слов …, что" (CDN + MT; often with ё).
  const ruComma = splitAtRuCommaChto(cleaned, folded)
  if (ruComma) return ruComma

  // 2) RU "Имя …, передал, что" / "передавал со слов …, что".
  const ruPeredal = splitAtRuPeredalChto(cleaned, folded)
  if (ruPeredal) return ruPeredal

  // 3) Long isnad: "…, о том, что матн"
  const otom = splitAtRuOtomChto(cleaned)
  if (otom) return otom

  // 4) First colon — "Narrated X: …" / "Передают со слов X: «…»".
  const colonSplit = splitAtFirstColon(cleaned)
  if (colonSplit) return colonSplit

  // 5) First speech verb + colon + quote in the opening only.
  const speechQuote = splitAtFirstSpeechQuote(cleaned)
  if (speechQuote) return speechQuote

  // 6) "Передал нам …, он сказал: матн" (no quote required).
  const chainSaid = splitAtChainSaid(cleaned)
  if (chainSaid) return chainSaid

  // 7) EN "… that matn" / "on the authority of … that"
  const enThat = splitAtEnThat(cleaned)
  if (enThat) return enThat

  // 8) EN "Name narrated that …"
  const nameNar = splitAtNameNarrated(cleaned)
  if (nameNar) return nameNar

  // 9) Long Muslim/Bukhari chains ending before «…» matn.
  const ruQuote = splitAtRuQuoteMatn(cleaned)
  if (ruQuote) return ruQuote

  // 10) Legacy fallback: "Сообщается/Передают со слов …, что матн"
  const soSlov = folded.match(
    /^((?:сообща(?:ет|ют|ется)|передают)\s+со\s+слов[^:]{3,400}?,\s*что)\s*([\s\S]+)$/iu,
  )
  if (soSlov && soSlov[2].trim().length > 8) {
    const hit = splitFromFoldedMatch(cleaned, soSlov)
    if (hit) return hit
  }

  return null
}
