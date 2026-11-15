'use client'

import Link from 'next/link'
import {
  BookOpen,
  CircleAlert,
  Library,
  ScrollText,
  ShieldCheck,
} from 'lucide-react'
import { SiGithub } from '@icons-pack/react-simple-icons'
import { useApp } from '@/context/AppContext'
import './About.css'

const GITHUB_URL = 'https://github.com/zakapower/tilawah'
const QURAN_API = 'https://github.com/fawazahmed0/quran-api'
const HADITH_API = 'https://github.com/fawazahmed0/hadith-api'
const QURAN_COM = 'https://quran.com'

export function AboutView() {
  const { t } = useApp()

  return (
    <article className="about">
      <section className="about-card">
        <span className="about-card__icon" aria-hidden>
          <BookOpen strokeWidth={2} />
        </span>
        <div className="about-card__body">
          <h1>{t('О Tilāwah', 'About Tilāwah')}</h1>
          <p>
            {t(
              'Tilāwah — сайт для чтения Корана и хадисов. Арабский текст и перевод можно читать рядом, а размер шрифта и тему настроить под себя.',
              'Tilāwah is a site for reading the Qur’an and Hadith. You can read the Arabic text alongside a translation and choose the font size and theme that suit you.',
            )}
          </p>
        </div>
      </section>

      <section className="about-card">
        <span className="about-card__icon" aria-hidden>
          <ScrollText strokeWidth={2} />
        </span>
        <div className="about-card__body">
          <h2>{t('Чтение и аудио', 'Reading and audio')}</h2>
          <ul>
            <li>
              {t(
                'Все 114 сур Корана с арабским текстом и переводами на русский и английский.',
                'All 114 surahs in Arabic, with Russian and English translations.',
              )}
            </li>
            <li>
              {t(
                'Хадисы из Сахих аль-Бухари, Сахих Муслим, Сунан Абу Дауд, Сунан ат-Тирмизи, Сунан ан-Насаи и Сунан ибн Маджа.',
                'Hadith from Sahih al-Bukhari, Sahih Muslim, Sunan Abu Dawud, Sunan at-Tirmidhi, Sunan an-Nasa’i, and Sunan Ibn Majah.',
              )}
            </li>
            <li>
              {t(
                'Можно слушать суры и следить за словами, которые подсвечиваются во время чтения.',
                'Listen to surah recitations and follow along as the words are highlighted.',
              )}
            </li>
            <li>
              {t(
                'Аяты и хадисы можно скопировать или добавить в избранное.',
                'You can copy ayahs and hadith or save them to your favorites.',
              )}
            </li>
          </ul>
        </div>
      </section>

      <section className="about-card">
        <span className="about-card__icon" aria-hidden>
          <Library strokeWidth={2} />
        </span>
        <div className="about-card__body">
          <h2>{t('Источники текстов и аудио', 'Text and audio sources')}</h2>
          <div className="about-source">
            <h3>{t('Коран', 'Qur’an')}</h3>
            <p>
              {t(
                'Арабский текст в письме Усмани, чтение Хафса (Комплекс короля Фахда). Русский перевод — Эльмир Кулиев, английский — Umm Muhammad. Тексты доступны через ',
                'The Arabic text uses Uthmani script and the Hafs reading (King Fahd Complex). The Russian translation is by Elmir Kuliev and the English translation is by Umm Muhammad. The texts come from ',
              )}
              <a href={QURAN_API} target="_blank" rel="noopener noreferrer">
                quran-api
              </a>
              .
            </p>
          </div>
          <div className="about-source">
            <h3>{t('Аудио', 'Audio')}</h3>
            <p>
              {t(
                'Записи чтения и данные для подсветки слов берём из API ',
                'Recitation audio and word timings come from the API provided by ',
              )}
              <a href={QURAN_COM} target="_blank" rel="noopener noreferrer">
                Quran.com
              </a>
              {t(
                '. Можно выбрать Абу Бакра аш-Шатри или Мишари Аль-Афаси.',
                '. You can choose Abu Bakr ash-Shatri or Mishary Al-Afasy.',
              )}
            </p>
          </div>
          <div className="about-source">
            <h3>{t('Хадисы', 'Hadith')}</h3>
            <ul>
              <li>
                {t(
                  'Для «Сахиха аль-Бухари» используем русский перевод Абдуллы Нирши в редакции Daura.com (',
                  'For Sahih al-Bukhari, we use the Russian translation by Abdullah Nirsha, edited by Daura.com (',
                )}
                <a
                  href="https://isnad.link/book/sahih-al-buhari"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  isnad.link
                </a>
                {t('). Английский перевод Мухсина Хана берём из ', '). Muhsin Khan’s English translation comes from ')}
                <a href={HADITH_API} target="_blank" rel="noopener noreferrer">
                  hadith-api
                </a>
                .
              </li>
              <li>
                {t('Русский текст «Сахиха Муслима» берём с ', 'The Russian edition of Sahih Muslim comes from ')}
                <a
                  href="https://isnad.link/book/sahih-muslim"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  isnad.link
                </a>
                {t(
                  '. В этом издании имя переводчика не указано. Английский перевод — Абдул Хамид Сиддики.',
                  '. That edition does not name a translator. The English translation is by Abdul Hamid Siddiqui.',
                )}
              </li>
              <li>
                {t('Русский текст «Сунана Абу Дауда» берём с ', 'The Russian edition of Sunan Abu Dawud comes from ')}
                <a
                  href="https://isnad.link/book/sunan-abu-dauda"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  isnad.link
                </a>
                {t(
                  ', английский — из hadith-api. В этих источниках имена переводчиков не указаны.',
                  ', and the English translation comes from hadith-api. These sources do not name the translators.',
                )}
              </li>
              <li>
                {t(
                  'Для сборников ат-Тирмизи, ан-Насаи и Ибн Маджи пока доступен английский перевод из hadith-api. Если русского перевода нет, об этом есть пометка.',
                  'Sunan at-Tirmidhi, Sunan an-Nasa’i, and Sunan Ibn Majah are available in English through hadith-api. The reader shows a note where a Russian translation is unavailable.',
                )}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="about-alert">
        <span className="about-alert__icon" aria-hidden>
          <CircleAlert strokeWidth={2} />
        </span>
        <div>
          <h2>{t('О переводах', 'About the translations')}</h2>
          <p>
            {t(
              'Переводы помогают понять общий смысл текста. Для более подробного разбора аятов можно обратиться к тафсирам, а для хадисов — к комментариям к сборникам.',
              'Translations help you understand the general meaning of the text. For more context, you can refer to tafsir for Qur’an verses and to commentaries on the Hadith collections.',
            )}
          </p>
        </div>
      </section>

      <section className="about-card">
        <span className="about-card__icon" aria-hidden>
          <ShieldCheck strokeWidth={2} />
        </span>
        <div className="about-card__body">
          <h2>{t('Настройки и чтение офлайн', 'Settings and offline reading')}</h2>
          <p>
            {t(
              'Браузер запоминает избранное и настройки чтения. Tilāwah можно установить как приложение. Если браузер уже сохранил раздел или запись на устройстве, их можно открыть без интернета.',
              'Your browser remembers your favorites and reading settings. You can install Tilāwah as an app and open sections and recordings offline once your browser has saved them.',
            )}
          </p>
        </div>
      </section>

      <div className="about-cta-row">
        <a
          className="about-cta"
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <SiGithub color="currentColor" size={20} title="" aria-hidden />
          <span>
            <strong>GitHub</strong>
            <em>{t('Код проекта и сообщения об ошибках', 'Project code and issue reports')}</em>
          </span>
        </a>
        <Link href="/quran" className="about-cta">
          <BookOpen strokeWidth={2} aria-hidden />
          <span>
            <strong>{t('Коран', 'Qur’an')}</strong>
            <em>{t('Открыть список сур', 'Browse the surahs')}</em>
          </span>
        </Link>
      </div>
    </article>
  )
}
