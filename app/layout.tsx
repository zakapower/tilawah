import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, Literata } from 'next/font/google'
import { AppProvider } from '@/context/AppContext'
import { QuranAudioProvider } from '@/context/QuranAudioContext'
import { Header } from '@/components/Header'
import { OverlayScrollbar } from '@/components/OverlayScrollbar'
import { QuranPlayerBar } from '@/components/QuranPlayerBar'
import { ScrollToTop } from '@/components/ScrollToTop'
import { getRequestLang } from '@/lib/request-lang'
import { getSiteOrigin, SITE_NAME } from '@/lib/site'
import './globals.css'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
})

const literata = Literata({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display-face',
})

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `${SITE_NAME} - %s`,
  },
  appleWebApp: {
    capable: true,
    title: 'Tilāwah',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f5f2' },
    { media: '(prefers-color-scheme: dark)', color: '#101512' },
  ],
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await getRequestLang()
  return (
    <html
      lang={lang}
      className={`${ibmPlexSans.variable} ${literata.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="preload"
          href="/fonts/UthmanicHafs1Ver18.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var th=localStorage.getItem('qh-theme');if(th!=='dark'&&th!=='light'){th='dark'}document.documentElement.setAttribute('data-theme',th);document.documentElement.style.colorScheme=th;var coarse=window.matchMedia&&window.matchMedia('(pointer: coarse)').matches;var touch=('ontouchstart' in window)||navigator.maxTouchPoints>0;if(coarse||touch){document.documentElement.setAttribute('data-touch','1')}var mark=function(){document.documentElement.setAttribute('data-touch','1')};window.addEventListener('touchstart',mark,{once:true,passive:true});window.addEventListener('pointerdown',function(e){if(e.pointerType==='touch'||e.pointerType==='pen')mark()},{once:true,passive:true})}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <AppProvider initialLang={lang}>
          <QuranAudioProvider>
            <ScrollToTop />
            <OverlayScrollbar />
            <div className="app-shell">
              <Header />
              <main>{children}</main>
            </div>
            <QuranPlayerBar />
          </QuranAudioProvider>
        </AppProvider>
      </body>
    </html>
  )
}
