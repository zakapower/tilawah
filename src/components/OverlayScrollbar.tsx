'use client'

import { useEffect, useRef, useState } from 'react'
import './OverlayScrollbar.css'

const HIDE_DELAY_MS = 900
const MIN_THUMB = 36
const EDGE = 2
/** Ignore ResizeObserver noise smaller than this (px) to avoid thumb jitter. */
const SIZE_EPS = 8

export function OverlayScrollbar() {
  const [needed, setNeeded] = useState(false)
  const [active, setActive] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLButtonElement>(null)
  const hideTimer = useRef(0)
  const raf = useRef(0)
  const resizeRaf = useRef(0)
  const drag = useRef<{ startY: number; startTop: number } | null>(null)
  const hovering = useRef(false)
  const lastSize = useRef({ view: 0, total: 0 })
  const metrics = useRef({
    view: 0,
    total: 0,
    thumbHeight: MIN_THUMB,
    thumbTop: EDGE,
    track: 0,
  })

  useEffect(() => {
    const root = document.documentElement

    function applyThumb(top: number, height: number) {
      const thumb = thumbRef.current
      if (!thumb) return
      // Skip no-op style writes (common source of visual flicker).
      if (
        thumb.style.top === `${top}px` &&
        thumb.style.height === `${height}px`
      ) {
        return
      }
      thumb.style.top = `${top}px`
      thumb.style.height = `${height}px`
    }

    function syncHeaderOffset() {
      const header = document.querySelector('.site-header')
      const headerH =
        header instanceof HTMLElement
          ? Math.round(header.getBoundingClientRect().height)
          : 0
      root.style.setProperty('--header-h', `${headerH}px`)
      return headerH
    }

    function measure() {
      const headerH = syncHeaderOffset()
      const view = root.clientHeight
      const total = root.scrollHeight
      const canScroll = total > view + 1
      metrics.current.view = view
      metrics.current.total = total
      lastSize.current = { view, total }
      setNeeded((prev) => (prev === canScroll ? prev : canScroll))

      if (!canScroll) {
        setActive(false)
        return
      }

      const railH =
        railRef.current?.clientHeight || Math.max(0, view - headerH)
      const track = Math.max(0, railH - EDGE * 2)
      const ratio = view / total
      const rawHeight = Math.max(MIN_THUMB, Math.round(track * ratio))
      // Hysteresis: ignore 1–2px thumb height flicker from layout noise.
      const prevHeight = metrics.current.thumbHeight
      const height =
        Math.abs(rawHeight - prevHeight) <= 2 ? prevHeight : rawHeight
      const maxTop = Math.max(0, track - height)
      const top =
        total === view
          ? EDGE
          : EDGE + Math.round((root.scrollTop / (total - view)) * maxTop)

      metrics.current.track = track
      metrics.current.thumbHeight = height
      metrics.current.thumbTop = Math.min(EDGE + maxTop, Math.max(EDGE, top))
      applyThumb(metrics.current.thumbTop, height)
    }

    function scheduleHide() {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = window.setTimeout(() => {
        if (!drag.current && !hovering.current) setActive(false)
      }, HIDE_DELAY_MS)
    }

    function show() {
      setActive((v) => (v ? v : true))
      scheduleHide()
    }

    function onScroll() {
      if (raf.current) return
      raf.current = window.requestAnimationFrame(() => {
        raf.current = 0
        measure()
        show()
      })
    }

    measure()

    function onResize() {
      if (resizeRaf.current) return
      resizeRaf.current = window.requestAnimationFrame(() => {
        resizeRaf.current = 0
        const view = root.clientHeight
        const total = root.scrollHeight
        if (
          lastSize.current.view !== 0 &&
          Math.abs(view - lastSize.current.view) < SIZE_EPS &&
          Math.abs(total - lastSize.current.total) < SIZE_EPS
        ) {
          return
        }
        measure()
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(document.documentElement)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      window.cancelAnimationFrame(raf.current)
      window.cancelAnimationFrame(resizeRaf.current)
      window.clearTimeout(hideTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!needed) return
    const root = document.documentElement
    const thumb = thumbRef.current
    if (thumb) {
      thumb.style.top = `${metrics.current.thumbTop}px`
      thumb.style.height = `${metrics.current.thumbHeight}px`
    }

    function onMove(e: PointerEvent) {
      if (!drag.current) return
      const { view, total, thumbHeight, track } = metrics.current
      const maxTop = Math.max(0, track - thumbHeight)
      const nextTop = Math.min(
        EDGE + maxTop,
        Math.max(
          EDGE,
          drag.current.startTop + (e.clientY - drag.current.startY),
        ),
      )
      metrics.current.thumbTop = nextTop
      if (thumbRef.current) thumbRef.current.style.top = `${nextTop}px`
      const maxScroll = total - view
      root.scrollTop =
        maxTop === 0 ? 0 : ((nextTop - EDGE) / maxTop) * maxScroll
    }

    function onUp() {
      if (!drag.current) return
      drag.current = null
      document.body.classList.remove('is-overlay-dragging')
      window.clearTimeout(hideTimer.current)
      hideTimer.current = window.setTimeout(() => {
        if (!hovering.current) setActive(false)
      }, HIDE_DELAY_MS)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [needed])

  if (!needed) return null

  return (
    <div
      ref={railRef}
      className={
        active
          ? 'overlay-scrollbar overlay-scrollbar--active'
          : 'overlay-scrollbar'
      }
      aria-hidden="true"
      onPointerEnter={() => {
        hovering.current = true
        setActive(true)
        window.clearTimeout(hideTimer.current)
      }}
      onPointerLeave={() => {
        hovering.current = false
        if (drag.current) return
        window.clearTimeout(hideTimer.current)
        hideTimer.current = window.setTimeout(() => setActive(false), HIDE_DELAY_MS)
      }}
    >
      <button
        ref={thumbRef}
        type="button"
        className="overlay-scrollbar__thumb"
        tabIndex={-1}
        onPointerDown={(e) => {
          e.preventDefault()
          drag.current = {
            startY: e.clientY,
            startTop: metrics.current.thumbTop,
          }
          document.body.classList.add('is-overlay-dragging')
          setActive(true)
          window.clearTimeout(hideTimer.current)
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
      />
    </div>
  )
}
