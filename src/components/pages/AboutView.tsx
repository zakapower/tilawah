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

const GITHUB_URL = 'https://github.com/zakapower/quran-hadith'
const QURAN_API = 'https://github.com/fawazahmed0/quran-api'
const HADITH_API = 'https://github.com/fawazahmed0/hadith-api'
const QURAN_COM = 'https://quran.com'

export function AboutView() {
  const { t } = useApp()

  return (
    <article className="about">
      <header className="about__head">
        <p className="about__kicker">Tilāwah</p>
        <h1>{t('О проекте', 'About')}</h1>
        <p className="about__lead">
          {t(
            'Зачем нужен Tilāwah и чем он не является.',
            'What Tilāwah is for and what it is not.',
          )}
        </p>
      </header>

      <section className="about-card">
        <span className="about-card__icon" aria-hidden>
          <BookOpen strokeWidth={2} />
        </span>
        <div className="about-card__body">
          <h2>{t('Что это', 'What this is')}</h2>
          <p>
            {t(
              'Tilāwah - минималистичный ридер Корана и хадисов. Цель простая: спокойно читать арабский текст рядом с переводом, без лишнего шума, рекламы и сложных кабинетов.',
              'Tilāwah is a minimal Qur’an and Hadith reader. The goal is simple: read Arabic text beside a translation calmly - no noise, ads, or heavy accounts.',
            )}
          </p>
          <p>
            {t(
              'Это не официальное издание и не Quran.com. Удобный ридер для личного чтения.',
              'This is not an official print edition and not Quran.com. It is a convenient reader for personal study.',
            )}
          </p>
        </div>
      </section>

      <section className="about-card">
        <span className="about-card__icon" aria-hidden>
          <ScrollText strokeWidth={2} />
        </span>
        <div className="about-card__body">
          <h2>{t('Что внутри', 'What’s inside')}</h2>
          <ul>
            <li>
              {t(
                'Все 114 сур Корана с арабским текстом и переводом (русский / English).',
                'All 114 Qur’an surahs with Arabic text and translation (Russian / English).',
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
                'Озвучка суры целиком с подсветкой слов. Чтецы: Абу Бакр аш-Шатри и Мишари Аль-Афаси.',
                'Full-surah audio with word highlighting. Reciters: Abu Bakr ash-Shatri and Mishary Al-Afasy.',
              )}
            </li>
            <li>
              {t(
                'Избранное и копирование аятов и хадисов - на этом устройстве.',
                'Favorites and copy for ayahs and hadith - stored on this device.',
              )}
            </li>
            <li>
              {t(
                'Русский и English интерфейс, светлая и тёмная тема, размер шрифта.',
                'Russian and English interface, light and dark theme, font size.',
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
          <h2>{t('Источники', 'Sources')}</h2>
          <p>
            {t(
              'Тексты Корана и хадисов - из открытых quran-api и hadith-api (jsDelivr). Озвучка и тайминги слов - из API Quran.com.',
              'Qur’an and Hadith texts come from the open quran-api and hadith-api (jsDelivr). Audio and word timings come from the Quran.com API.',
            )}
          </p>
          <ul>
            <li>
              {t(
                'Коран: арабский Усмани (Хафс, Комплекс короля Фахда); RU - Эльмир Кулиев; EN - Umm Muhammad. Через ',
                'Qur’an: Uthmani Arabic (Hafs, King Fahd Complex); RU - Elmir Kuliev; EN - Umm Muhammad. Via ',
              )}
              <a href={QURAN_API} target="_blank" rel="noopener noreferrer">
                quran-api
              </a>
              .
            </li>
            <li>
              {t(
                'Озвучка: файлы чтения и тайминги слов - ',
                'Audio: recitation files and word timings - ',
              )}
              <a href={QURAN_COM} target="_blank" rel="noopener noreferrer">
                Quran.com
              </a>
              {t(
                ' API. Чтецы: Абу Бакр аш-Шатри и Мишари Аль-Афаси.',
                ' API. Reciters: Abu Bakr ash-Shatri and Mishary Al-Afasy.',
              )}
            </li>
            <li>
              {t(
                'Сахих аль-Бухари - RU: Abdullah Nirsha / редакторы Daura.com (',
                'Sahih al-Bukhari - RU: Abdullah Nirsha / Daura.com editors (',
              )}
              <a
                href="https://isnad.link/book/sahih-al-buhari"
                target="_blank"
                rel="noopener noreferrer"
              >
                isnad.link
              </a>
              {t('); EN: Muhsin Khan. Через ', '); EN: Muhsin Khan. Via ')}
              <a href={HADITH_API} target="_blank" rel="noopener noreferrer">
                hadith-api
              </a>
              .
            </li>
            <li>
              {t('Сахих Муслим - RU: издание с ', 'Sahih Muslim - RU: ')}
              <a
                href="https://isnad.link/book/sahih-muslim"
                target="_blank"
                rel="noopener noreferrer"
              >
                isnad.link
              </a>
              {t(
                ' (автор в источнике не указан); EN: Abdul Hamid Siddiqui.',
                ' edition (author not listed upstream); EN: Abdul Hamid Siddiqui.',
              )}
            </li>
            <li>
              {t('Сунан Абу Дауд - RU: издание с ', 'Sunan Abu Dawud - RU: ')}
              <a
                href="https://isnad.link/book/sunan-abu-dauda"
                target="_blank"
                rel="noopener noreferrer"
              >
                isnad.link
              </a>
              {t(
                ' (автор в источнике не указан); EN: hadith-api (автор не указан). Пропуски в RU заполняются автопереводом с английского.',
                ' edition (author not listed upstream); EN: hadith-api (author not listed). Missing RU lines are filled by auto-translation from English.',
              )}
            </li>
            <li>
              {t(
                'Сунан ат-Тирмизи, Сунан ан-Насаи, Сунан ибн Маджа и пропуски в других сборниках - RU: автоперевод с английского издания hadith-api; EN: hadith-api.',
                'Sunan at-Tirmidhi, Sunan an-Nasa’i, Sunan Ibn Majah, and gaps in other collections - RU: auto-translation from the English hadith-api edition; EN: hadith-api.',
              )}
            </li>
          </ul>
        </div>
      </section>

      <section className="about-alert">
        <span className="about-alert__icon" aria-hidden>
          <CircleAlert strokeWidth={2} />
        </span>
        <div>
          <h2>{t('Важно знать', 'Disclaimer')}</h2>
          <p>
            {t(
              'Это не фетва и не замена учёному. Тексты - для личного чтения. Автоперевод хадисов (где нет готового RU) может быть неточным. В сложных вопросах лучше обратиться к знающему человеку.',
              'This is not a fatwa and not a substitute for a scholar. The texts are for personal reading. Auto-translated hadith (where no RU edition exists) may be imprecise. For complex matters, ask a knowledgeable person.',
            )}
          </p>
        </div>
      </section>

      <section className="about-card">
        <span className="about-card__icon" aria-hidden>
          <ShieldCheck strokeWidth={2} />
        </span>
        <div className="about-card__body">
          <h2>{t('Приватность', 'Privacy')}</h2>
          <p>
            {t(
              'Нет регистрации и облачного аккаунта. Язык, тема, избранное, размер шрифта и прогресс чтения живут локально в браузере. Сайт можно поставить как приложение: уже открытые разделы и озвучка кэшируются на устройстве. Данные не продаются и не уходят в аналитику.',
              'No sign-up and no cloud account. Language, theme, favorites, font size, and reading progress stay locally in the browser. You can install it as an app: visited sections and recitation cache on the device. Nothing is sold or shipped to analytics.',
            )}
          </p>
        </div>
      </section>

      <section className="about-card">
        <span className="about-card__icon" aria-hidden>
          <SiGithub color="currentColor" size={20} title="" aria-hidden />
        </span>
        <div className="about-card__body">
          <h2>{t('Исходный код', 'Source')}</h2>
          <p>
            {t(
              'Tilāwah - свободная программа с открытым исходным кодом. Репозиторий, ошибки и предложения на GitHub.',
              'Tilāwah is free and open source. The repository, issues, and ideas are on GitHub.',
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
            <em>{t('Код, ошибки и идеи', 'Code, issues, and ideas')}</em>
          </span>
        </a>
        <Link href="/quran" className="about-cta">
          <BookOpen strokeWidth={2} aria-hidden />
          <span>
            <strong>{t('Коран', 'Qur’an')}</strong>
            <em>{t('Открыть суры и читать', 'Open the surahs and read')}</em>
          </span>
        </Link>
      </div>
    </article>
  )
}
