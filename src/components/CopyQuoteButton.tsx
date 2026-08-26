'use client'

import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'

type Props = {
  heading: string
  body: string
  label?: string
}

async function writeClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    /* fall through to legacy copy */
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  if (!ok) throw new Error('copy failed')
}

export function CopyQuoteButton({ heading, body, label }: Props) {
  const { t } = useApp()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(id)
  }, [copied])

  async function onCopy() {
    const text = `${heading.trim()}\n${body.trim()}`
    try {
      await writeClipboard(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const copyLabel = label ?? t('Копировать', 'Copy')

  return (
    <button
      type="button"
      className={copied ? 'ayah__copy ayah__copy--done' : 'ayah__copy'}
      onClick={onCopy}
      aria-label={
        copied ? t('Скопировано', 'Copied') : copyLabel
      }
      title={copied ? t('Скопировано', 'Copied') : copyLabel}
    >
      <span className="ayah__copy-stack" aria-hidden="true">
        <span className="ayah__copy-icon ayah__copy-icon--copy" />
        <span className="ayah__copy-icon ayah__copy-icon--check" />
      </span>
    </button>
  )
}
