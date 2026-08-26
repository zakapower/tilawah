'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { SiGithub } from '@icons-pack/react-simple-icons'
import { BookOpen, Bookmark, Menu, Moon, Sun, X } from 'lucide-react'
import { warmHadithCatalog } from '@/api/hadith'
import { useApp } from '../context/AppContext'
import { SettingsPopover } from './SettingsPopover'
import './Header.css'

const GITHUB_URL = 'https://github.com/zakapower'

const MAIN_ROUTES = ['/', '/quran', '/hadith', '/about', '/favorites'] as const

export function Header() {
  const { lang, theme, themeReady, toggleLang, toggleTheme, t } = useApp()
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()

  function navClass(href: string, end = false) {
    const active = end
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)
    return active ? 'active' : undefined
  }

  const favoritesActive =
    pathname === '/favorites' || pathname.startsWith('/favorites/')

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.documentElement.classList.add('menu-open')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('menu-open')
    }
  }, [menuOpen])

  // Prefetch main tabs + warm hadith catalog while the browser is idle.
  useEffect(() => {
    let cancelled = false
    const warm = () => {
      if (cancelled) return
      for (const href of MAIN_ROUTES) router.prefetch(href)
      warmHadithCatalog()
    }
    const ric = (
      window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number
        cancelIdleCallback?: (id: number) => void
      }
    ).requestIdleCallback
    const cic = (
      window as Window & { cancelIdleCallback?: (id: number) => void }
    ).cancelIdleCallback
    let idleId: number | undefined
    let timeoutId: number | undefined
    if (typeof ric === 'function') {
      idleId = ric(warm, { timeout: 2000 })
    } else {
      timeoutId = window.setTimeout(warm, 200)
    }
    return () => {
      cancelled = true
      if (idleId != null && typeof cic === 'function') cic(idleId)
      if (timeoutId != null) window.clearTimeout(timeoutId)
    }
  }, [router])

  function prefetchRoute(href: string) {
    router.prefetch(href)
    if (href === '/hadith') warmHadithCatalog()
  }

  const toolControls = (
    <>
      <Link
        href="/favorites"
        className={`ctrl${favoritesActive ? ' ctrl--active' : ''}`}
        aria-label={t('Избранное', 'Favorites')}
        title={t('Избранное', 'Favorites')}
        onPointerEnter={() => prefetchRoute('/favorites')}
        onClick={() => setMenuOpen(false)}
      >
        <Bookmark className="ctrl__icon" strokeWidth={2} aria-hidden />
      </Link>
      <a
        className="ctrl"
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('GitHub', 'GitHub')}
      >
        <SiGithub
          className="ctrl__icon"
          color="currentColor"
          size={18}
          title=""
          aria-hidden
        />
      </a>
      <button
        type="button"
        className={`ctrl${lang === 'en' ? ' ctrl--lang-en' : ''}`}
        onClick={toggleLang}
        aria-label={t('Switch to English', 'Переключить на русский')}
      >
        <span className="ctrl__stack" aria-hidden>
          <span className="ctrl__face ctrl__face--en">EN</span>
          <span className="ctrl__face ctrl__face--ru">RU</span>
        </span>
      </button>
      <button
        type="button"
        className={`ctrl${theme === 'dark' ? ' ctrl--theme-dark' : ''}${themeReady ? '' : ' ctrl--theme-boot'}`}
        onClick={toggleTheme}
        aria-label={
          theme === 'light'
            ? t('Тёмная тема', 'Dark theme')
            : t('Светлая тема', 'Light theme')
        }
      >
        <span className="ctrl__stack" aria-hidden>
          <Moon className="ctrl__face ctrl__face--moon" strokeWidth={2} />
          <Sun className="ctrl__face ctrl__face--sun" strokeWidth={2} />
        </span>
      </button>
      <SettingsPopover />
    </>
  )

  return (
    <header className={`site-header${menuOpen ? ' site-header--menu-open' : ''}`}>
      <div className="site-header__inner">
        <div className="site-header__bar">
          <Link href="/" className="brand" aria-label="Tilāwah home">
            <BookOpen className="brand__mark" strokeWidth={2.25} aria-hidden />
            <span className="brand__name">Tilāwah</span>
          </Link>

          <nav className="site-nav" aria-label={t('Меню', 'Menu')} spellCheck={false}>
            <Link
              href="/"
              className={navClass('/', true)}
              onPointerEnter={() => prefetchRoute('/')}
            >
              {t('Главная', 'Home')}
            </Link>
            <Link
              href="/quran"
              className={navClass('/quran')}
              onPointerEnter={() => prefetchRoute('/quran')}
            >
              {t('Коран', 'Qur’an')}
            </Link>
            <Link
              href="/hadith"
              className={navClass('/hadith')}
              onPointerEnter={() => prefetchRoute('/hadith')}
            >
              {t('Хадисы', 'Hadith')}
            </Link>
            <Link
              href="/about"
              className={navClass('/about')}
              onPointerEnter={() => prefetchRoute('/about')}
            >
              {t('О проекте', 'About')}
            </Link>
          </nav>

          <div className="site-controls">
            <button
              type="button"
              className={`ctrl site-controls__burger${menuOpen ? ' ctrl--menu-open' : ''}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={
                menuOpen
                  ? t('Закрыть меню', 'Close menu')
                  : t('Открыть меню', 'Open menu')
              }
            >
              <span className="ctrl__stack" aria-hidden>
                <Menu className="ctrl__face ctrl__face--menu" strokeWidth={2} />
                <X className="ctrl__face ctrl__face--close" strokeWidth={2} />
              </span>
            </button>
            <div className="site-controls__tools">{toolControls}</div>
          </div>

          {menuOpen && (
            <div
              className="site-menu"
              id={menuId}
              aria-label={t('Действия', 'Actions')}
            >
              <div className="site-menu__actions">
                <Link
                  href="/favorites"
                  className={`site-menu__action${favoritesActive ? ' is-active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <Bookmark
                    className="site-menu__action-icon"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span>{t('Избранное', 'Favorites')}</span>
                </Link>
                <button type="button" className="site-menu__action" onClick={toggleLang}>
                  <span className="site-menu__action-badge" aria-hidden>
                    {lang === 'ru' ? 'EN' : 'RU'}
                  </span>
                  <span>
                    {lang === 'ru'
                      ? t('English', 'English')
                      : t('Русский', 'Russian')}
                  </span>
                </button>
                <button type="button" className="site-menu__action" onClick={toggleTheme}>
                  {theme === 'light' ? (
                    <Moon className="site-menu__action-icon" strokeWidth={2} aria-hidden />
                  ) : (
                    <Sun className="site-menu__action-icon" strokeWidth={2} aria-hidden />
                  )}
                  <span>
                    {theme === 'light'
                      ? t('Тёмная тема', 'Dark theme')
                      : t('Светлая тема', 'Light theme')}
                  </span>
                </button>
                <a
                  className="site-menu__action"
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <SiGithub
                    className="site-menu__action-icon"
                    color="currentColor"
                    size={18}
                    title=""
                    aria-hidden
                  />
                  <span>GitHub</span>
                </a>
                <SettingsPopover variant="menu" />
              </div>
            </div>
          )}
        </div>
      </div>

      {menuOpen && (
        <button
          type="button"
          className="site-menu__backdrop"
          aria-label={t('Закрыть меню', 'Close menu')}
          onClick={() => setMenuOpen(false)}
        />
      )}
    </header>
  )
}
