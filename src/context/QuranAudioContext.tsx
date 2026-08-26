'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import {
  fetchChapterAudioPack,
  fetchChapterWords,
} from '@/api/quranAudio'
import { DEFAULT_RECITER_ID, getReciter } from '@/data/reciters'
import {
  findActiveWordIndex,
  findAyahIndexByTime,
  type AyahTiming,
} from '@/utils/audioSegments'
import {
  readLastAyah,
  readReciterId,
  writeLastAyah,
  writeReciterId,
} from '@/utils/audioStorage'

type PlayTarget = { surah: number; ayah: number }

type QuranAudioApi = {
  visible: boolean
  playing: boolean
  loading: boolean
  error: string | null
  reciterId: number
  surah: number | null
  ayah: number | null
  activeWordIndex: number | null
  progress: number
  wordsByAyah: Map<number, string[]> | null
  wordsChapter: number | null
  openAndPlay: (opts: { surah: number; ayah?: number }) => void
  togglePause: () => void
  pause: () => void
  close: () => void
  nextAyah: () => void
  prevAyah: () => void
  setReciter: (id: number) => void
  ensureWords: (chapter: number) => void
  retry: () => void
}

const QuranAudioContext = createContext<QuranAudioApi | null>(null)

function clampAyah(ayah: number, timestamps: AyahTiming[]) {
  if (timestamps.length === 0) return Math.max(1, ayah)
  const max = timestamps[timestamps.length - 1].ayah
  return Math.min(max, Math.max(1, ayah))
}

function sameAudioUrl(current: string, next: string) {
  if (!current) return false
  try {
    const a = new URL(current, window.location.origin)
    const b = new URL(next, window.location.origin)
    return a.pathname + a.search === b.pathname + b.search
  } catch {
    return current === next || current.endsWith(next)
  }
}

function scrollAyahIntoView(ayah: number, behavior: ScrollBehavior = 'smooth') {
  const el = document.getElementById(`a${ayah}`)
  if (!el) return
  const rect = el.getBoundingClientRect()
  const topPad = 96
  const bottomPad = 120
  const inView =
    rect.top >= topPad && rect.bottom <= window.innerHeight - bottomPad
  if (inView) return
  el.scrollIntoView({ behavior, block: 'center' })
}

function loadAudioSrc(audio: HTMLAudioElement, url: string) {
  if (sameAudioUrl(audio.src, url) && audio.readyState >= 1) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    const onMeta = () => {
      cleanup()
      resolve()
    }
    const onErr = () => {
      cleanup()
      reject(new Error('audio-error'))
    }
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('audio-timeout'))
    }, 25000)
    const cleanup = () => {
      window.clearTimeout(timer)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('error', onErr)
    }

    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('error', onErr)
    audio.src = url
    audio.load()
  })
}

export function QuranAudioProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timestampsRef = useRef<AyahTiming[]>([])
  const audioUrlRef = useRef<string>('')
  const targetRef = useRef<PlayTarget | null>(null)
  const loadGenRef = useRef(0)
  const ignoreErrorRef = useRef(false)
  const finishingRef = useRef(false)
  const syncLockRef = useRef(0)

  const [visible, setVisible] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reciterId, setReciterIdState] = useState(DEFAULT_RECITER_ID)
  const [surah, setSurah] = useState<number | null>(null)
  const [ayah, setAyah] = useState<number | null>(null)
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [wordsByAyah, setWordsByAyah] = useState<Map<number, string[]> | null>(
    null,
  )
  const [wordsChapter, setWordsChapter] = useState<number | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const saved = readReciterId(DEFAULT_RECITER_ID)
    const reciter = getReciter(saved)
    setReciterIdState(reciter.id)
    if (reciter.id !== saved) writeReciterId(reciter.id)
    setHydrated(true)
  }, [])

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (audio) audio.pause()
    setPlaying(false)
  }, [])

  const close = useCallback(() => {
    const audio = audioRef.current
    if (audio) audio.pause()
    setPlaying(false)
    setVisible(false)
    setActiveWordIndex(null)
    setProgress(0)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!visible || surah == null) return
    if (
      pathname !== `/quran/${surah}` &&
      !pathname.startsWith(`/quran/${surah}:`)
    ) {
      close()
    }
  }, [pathname, surah, visible, close])

  const finishSurah = useCallback(() => {
    if (finishingRef.current) return
    finishingRef.current = true
    const audio = audioRef.current
    if (audio && !audio.paused) audio.pause()
    setPlaying(false)
    setProgress(1)
    setActiveWordIndex(null)
    window.setTimeout(() => {
      finishingRef.current = false
    }, 200)
  }, [])

  const playAyah = useCallback(async (ayahNumber: number, autoplay: boolean) => {
    const audio = audioRef.current
    const timestamps = timestampsRef.current
    const url = audioUrlRef.current
    if (!audio || !url || timestamps.length === 0) return

    const clamped = clampAyah(ayahNumber, timestamps)
    const row = timestamps.find((t) => t.ayah === clamped) ?? timestamps[0]

    const surahNum = targetRef.current?.surah
    if (surahNum != null) {
      targetRef.current = { surah: surahNum, ayah: row.ayah }
      writeLastAyah(surahNum, row.ayah)
    }
    setAyah(row.ayah)
    setActiveWordIndex(null)
    setProgress(0)
    finishingRef.current = false
    scrollAyahIntoView(row.ayah)

    syncLockRef.current += 1
    ignoreErrorRef.current = true
    try {
      const needsLoad = !sameAudioUrl(audio.src, url)
      if (needsLoad) {
        await loadAudioSrc(audio, url)
      }

      const targetSec = row.fromMs / 1000
      try {
        if (Math.abs(audio.currentTime - targetSec) > 0.04) {
          await new Promise<void>((resolve) => {
            let done = false
            const finish = () => {
              if (done) return
              done = true
              audio.removeEventListener('seeked', finish)
              window.clearTimeout(timer)
              resolve()
            }
            const timer = window.setTimeout(finish, 400)
            audio.addEventListener('seeked', finish)
            try {
              audio.currentTime = targetSec
            } catch {
              finish()
            }
          })
        }
      } catch {
        /* ignore */
      }

      if (autoplay) {
        await audio.play()
        setPlaying(true)
        setError(null)
        setActiveWordIndex(
          findActiveWordIndex(row.segments, audio.currentTime * 1000),
        )
      } else {
        setActiveWordIndex(
          findActiveWordIndex(row.segments, audio.currentTime * 1000),
        )
      }
    } catch {
      setPlaying(false)
      setError('play-failed')
    } finally {
      ignoreErrorRef.current = false
      syncLockRef.current = Math.max(0, syncLockRef.current - 1)
    }
  }, [])

  const ensureWords = useCallback((chapter: number) => {
    if (!Number.isFinite(chapter) || chapter < 1 || chapter > 114) return
    void fetchChapterWords(chapter)
      .then((words) => {
        setWordsChapter(chapter)
        setWordsByAyah(words)
      })
      .catch(() => {
        /* ignore */
      })
  }, [])

  const loadAndPlay = useCallback(
    async (opts: { surah: number; ayah: number; reciter: number }) => {
      const gen = ++loadGenRef.current
      setVisible(true)
      setLoading(true)
      setError(null)
      setSurah(opts.surah)
      setAyah(opts.ayah)
      targetRef.current = { surah: opts.surah, ayah: opts.ayah }
      writeLastAyah(opts.surah, opts.ayah)
      ensureWords(opts.surah)

      try {
        const pack = await fetchChapterAudioPack(opts.reciter, opts.surah)
        if (gen !== loadGenRef.current) return

        timestampsRef.current = pack.timestamps
        audioUrlRef.current = pack.audioUrl

        await playAyah(opts.ayah, true)
      } catch {
        if (gen !== loadGenRef.current) return
        setPlaying(false)
        setError('load-failed')
      } finally {
        if (gen === loadGenRef.current) setLoading(false)
      }
    },
    [ensureWords, playAyah],
  )

  const openAndPlay = useCallback(
    (opts: { surah: number; ayah?: number }) => {
      const start =
        opts.ayah ??
        readLastAyah(opts.surah) ??
        (surah === opts.surah && ayah != null ? ayah : null) ??
        1

      if (
        surah === opts.surah &&
        timestampsRef.current.length > 0 &&
        audioUrlRef.current
      ) {
        setVisible(true)
        setError(null)
        void playAyah(start, true)
        return
      }

      void loadAndPlay({
        surah: opts.surah,
        ayah: start,
        reciter: reciterId,
      })
    },
    [ayah, loadAndPlay, playAyah, reciterId, surah],
  )

  const retry = useCallback(() => {
    const t = targetRef.current
    if (!t) return
    void loadAndPlay({ surah: t.surah, ayah: t.ayah, reciter: reciterId })
  }, [loadAndPlay, reciterId])

  const togglePause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !visible) return
    if (audio.paused) {
      void audio
        .play()
        .then(() => {
          setPlaying(true)
          setError(null)
        })
        .catch(() => {
          setPlaying(false)
          setError('play-failed')
        })
    } else {
      audio.pause()
      setPlaying(false)
    }
  }, [visible])

  const nextAyah = useCallback(() => {
    const timestamps = timestampsRef.current
    const audio = audioRef.current
    if (!ayah || timestamps.length === 0) return
    const idx = timestamps.findIndex((t) => t.ayah === ayah)
    if (idx < 0 || idx >= timestamps.length - 1) return
    const shouldPlay = Boolean(audio && !audio.paused)
    void playAyah(timestamps[idx + 1].ayah, shouldPlay)
  }, [ayah, playAyah])

  const prevAyah = useCallback(() => {
    const timestamps = timestampsRef.current
    const audio = audioRef.current
    if (!ayah || timestamps.length === 0) return
    const idx = timestamps.findIndex((t) => t.ayah === ayah)
    if (idx <= 0) return
    const shouldPlay = Boolean(audio && !audio.paused)
    void playAyah(timestamps[idx - 1].ayah, shouldPlay)
  }, [ayah, playAyah])

  useEffect(() => {
    if (!visible) return

    const onKey = (e: KeyboardEvent) => {
      const isSpace = e.code === 'Space' || e.key === ' '
      const isPrev = e.code === 'ArrowLeft' || e.key === 'ArrowLeft'
      const isNext = e.code === 'ArrowRight' || e.key === 'ArrowRight'
      if (!isSpace && !isPrev && !isNext) return

      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.closest('input, textarea, select, [contenteditable="true"]') ||
          target.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      if (isSpace) togglePause()
      else if (isPrev) prevAyah()
      else nextAyah()
    }

    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [visible, togglePause, prevAyah, nextAyah])

  const setReciter = useCallback(
    (id: number) => {
      const reciter = getReciter(id)
      setReciterIdState(reciter.id)
      writeReciterId(reciter.id)
      const t = targetRef.current
      if (visible && t) {
        void loadAndPlay({ surah: t.surah, ayah: t.ayah, reciter: reciter.id })
      }
    },
    [loadAndPlay, visible],
  )

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const syncFromClock = () => {
      if (syncLockRef.current > 0) return

      const timestamps = timestampsRef.current
      if (timestamps.length === 0) return

      const tMs = audio.currentTime * 1000
      const idx = findAyahIndexByTime(timestamps, tMs)
      const row = timestamps[idx]
      if (!row) return

      const prevAyah = targetRef.current?.ayah
      if (prevAyah !== row.ayah) {
        const surahNum = targetRef.current?.surah
        if (surahNum != null) {
          targetRef.current = { surah: surahNum, ayah: row.ayah }
          writeLastAyah(surahNum, row.ayah)
        }
        setAyah(row.ayah)
        scrollAyahIntoView(row.ayah)
      }

      setActiveWordIndex(findActiveWordIndex(row.segments, tMs))

      const span = row.toMs - row.fromMs
      if (span > 0) {
        setProgress(Math.min(1, Math.max(0, (tMs - row.fromMs) / span)))
      }

      const last = timestamps[timestamps.length - 1]
      if (tMs >= last.toMs - 40 && !audio.paused) {
        finishSurah()
      }
    }

    let raf = 0
    const tick = () => {
      syncFromClock()
      raf = requestAnimationFrame(tick)
    }

    const onPlay = () => {
      setPlaying(true)
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(tick)
    }
    const onPause = () => {
      setPlaying(false)
      cancelAnimationFrame(raf)
      syncFromClock()
    }
    const onEnded = () => {
      finishSurah()
    }
    const onError = () => {
      if (ignoreErrorRef.current) return
      setPlaying(false)
      setError('load-failed')
    }

    if (!audio.paused) {
      raf = requestAnimationFrame(tick)
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      cancelAnimationFrame(raf)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [finishSurah])

  const value = useMemo<QuranAudioApi>(
    () => ({
      visible,
      playing,
      loading,
      error,
      reciterId: hydrated ? reciterId : DEFAULT_RECITER_ID,
      surah,
      ayah,
      activeWordIndex,
      progress,
      wordsByAyah,
      wordsChapter,
      openAndPlay,
      togglePause,
      pause,
      close,
      nextAyah,
      prevAyah,
      setReciter,
      ensureWords,
      retry,
    }),
    [
      visible,
      playing,
      loading,
      error,
      hydrated,
      reciterId,
      surah,
      ayah,
      activeWordIndex,
      progress,
      wordsByAyah,
      wordsChapter,
      openAndPlay,
      togglePause,
      pause,
      close,
      nextAyah,
      prevAyah,
      setReciter,
      ensureWords,
      retry,
    ],
  )

  return (
    <QuranAudioContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" playsInline />
    </QuranAudioContext.Provider>
  )
}

export function useQuranAudio(): QuranAudioApi {
  const ctx = useContext(QuranAudioContext)
  if (!ctx) {
    throw new Error('useQuranAudio must be used within QuranAudioProvider')
  }
  return ctx
}
