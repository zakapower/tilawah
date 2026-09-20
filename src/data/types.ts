export type Lang = 'ru' | 'en'

export interface SurahMeta {
  number: number
  name: string
  englishName: string
  englishNameTranslation: string
  numberOfAyahs: number
  revelationType: string
}

export interface Ayah {
  number: number
  numberInSurah: number
  text: string
}

export interface SurahContent {
  number: number
  name: string
  englishName: string
  englishNameTranslation: string
  ayahsArabic: Ayah[]
  ayahsTranslation: Ayah[]
}

export interface HadithCollectionMeta {
  id: string
  title: { ru: string; en: string }
  narrator: { ru: string; en: string }
  /** CDN book key in fawazahmed0/hadith-api */
  apiBook: 'bukhari' | 'muslim' | 'abudawud' | 'tirmidhi' | 'nasai' | 'ibnmajah'
  /** Число хадисов в издании CDN (для списка без лишнего запроса) */
  hadithCount: number
  editions: {
    ar: string
    en: string
    ru?: string
  }
}

export interface HadithSectionMeta {
  id: string
  number: number
  name: string
  hadithFirst: number
  hadithLast: number
  count: number
}

export interface HadithItem {
  id: string
  number: number
  arabic?: string
  text: string
  reference?: { book: number; hadith: number }
}
