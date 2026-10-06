import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import withSerwistInit from '@serwist/next'
import type { NextConfig } from 'next'

const revision =
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim() ||
  randomUUID()

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  cacheOnNavigation: true,
  reloadOnOnline: false,
  additionalPrecacheEntries: [
    { url: '/offline', revision },
    { url: '/fonts/UthmanicHafs1Ver18.woff2', revision },
    { url: '/icons/icon-192.png', revision },
    { url: '/icons/icon-512.png', revision },
    { url: '/icons/icon-maskable-512.png', revision },
  ],
})

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    // Dynamic pages (lang cookie) stay in the client router cache so tab
    // switches, including back to the page you landed on, do not refetch.
    staleTimes: {
      dynamic: 300,
      static: 300,
    },
  },
  async headers() {
    return [
      {
        source: '/fonts/:path(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/favicon.svg',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
      {
        source: '/icons/:path(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/api/quran-audio',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, immutable',
          },
        ],
      },
    ]
  },
}

export default withSerwist(nextConfig)
