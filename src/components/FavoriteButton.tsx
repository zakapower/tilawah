'use client'

import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useAyahFavorite, useHadithFavorite } from '@/hooks/useFavorites'

type AyahProps = {
  kind: 'ayah'
  surah: number
  ayah: number
  snippet: string
}

type HadithProps = {
  kind: 'hadith'
  bookId: string
  sectionId: string
  number: number
  bookTitle: string
  snippet: string
}

type Props = AyahProps | HadithProps

export function FavoriteButton(props: Props) {
  const { t } = useApp()

  if (props.kind === 'ayah') {
    return <AyahFavoriteButton {...props} t={t} />
  }
  return <HadithFavoriteButton {...props} t={t} />
}

function AyahFavoriteButton({
  surah,
  ayah,
  snippet,
  t,
}: AyahProps & { t: (ru: string, en: string) => string }) {
  const { active, toggle } = useAyahFavorite(surah, ayah)
  const label = active
    ? t('Убрать из избранного', 'Remove from favorites')
    : t('В избранное', 'Add to favorites')

  return (
    <button
      type="button"
      className={`ayah__fav${active ? ' ayah__fav--on' : ''}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(snippet)
      }}
      aria-label={label}
      title={label}
      aria-pressed={active}
    >
      {active ? (
        <BookmarkCheck strokeWidth={2.25} fill="currentColor" aria-hidden="true" />
      ) : (
        <Bookmark strokeWidth={2.25} aria-hidden="true" />
      )}
    </button>
  )
}

function HadithFavoriteButton({
  bookId,
  sectionId,
  number,
  bookTitle,
  snippet,
  t,
}: HadithProps & { t: (ru: string, en: string) => string }) {
  const { active, toggle } = useHadithFavorite(bookId, sectionId, number)
  const label = active
    ? t('Убрать из избранного', 'Remove from favorites')
    : t('В избранное', 'Add to favorites')

  return (
    <button
      type="button"
      className={`ayah__fav${active ? ' ayah__fav--on' : ''}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(bookTitle, snippet)
      }}
      aria-label={label}
      title={label}
      aria-pressed={active}
    >
      {active ? (
        <BookmarkCheck strokeWidth={2.25} fill="currentColor" aria-hidden="true" />
      ) : (
        <Bookmark strokeWidth={2.25} aria-hidden="true" />
      )}
    </button>
  )
}
