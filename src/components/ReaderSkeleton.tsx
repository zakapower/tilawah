'use client'

import './ReaderSkeleton.css'

type ReaderSkeletonVariant = 'surah' | 'hadith' | 'chapters'

const LINE_WIDTHS = ['92%', '78%', '88%', '70%', '84%'] as const
const AR_WIDTHS = ['100%', '94%', '100%', '86%', '98%'] as const
const CHAPTER_WIDTHS = ['72%', '64%', '80%', '58%', '76%', '68%', '74%', '62%'] as const

type Props = {
  variant?: ReaderSkeletonVariant
  /** Surah 1–114: hide edge arrows like real SurahNav (no prev on 1, no next on 114). */
  number?: number
  /** Parent already rendered the real page header. */
  hideHead?: boolean
  /** Parent already rendered the real chapter/surah nav. */
  hideNav?: boolean
  /** Hadith chapter edges (when known from sections list). */
  hidePrev?: boolean
  hideNext?: boolean
}

function navBtnClass(ghost: boolean) {
  return `reader-skel__bone reader-skel__nav-btn${
    ghost ? ' reader-skel__nav-btn--ghost' : ''
  }`
}

export function ReaderSkeleton({
  variant = 'hadith',
  number,
  hideHead = false,
  hideNav = false,
  hidePrev: hidePrevProp,
  hideNext: hideNextProp,
}: Props) {
  const isChapters = variant === 'chapters'
  const isSurah = variant === 'surah'
  const isHadith = variant === 'hadith'
  const showNav = (isSurah || isHadith) && !hideNav
  const showHead = !isChapters && !hideHead
  const count = isChapters ? 8 : 5
  const hidePrev =
    hidePrevProp ?? (isSurah && number != null && number <= 1)
  const hideNext =
    hideNextProp ?? (isSurah && number != null && number >= 114)

  return (
    <div
      className={`reader-skel reader-skel--${variant}`}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading"
    >
      {showHead && (
        <header className="reader-skel__head">
          {isSurah && <div className="reader-skel__bone reader-skel__ar-title" />}
          <div className="reader-skel__bone reader-skel__title" />
          {(isSurah || isHadith) && (
            <div className="reader-skel__bone reader-skel__sub" />
          )}
        </header>
      )}

      {showNav && (
        <div className="reader-skel__nav">
          {isSurah ? (
            <>
              <div className="reader-skel__bone reader-skel__nav-meta" />
              <div className="reader-skel__nav-row">
                <div className={navBtnClass(Boolean(hidePrev))} />
                <div className="reader-skel__bone reader-skel__nav-btn reader-skel__nav-btn--play" />
                <div className={navBtnClass(Boolean(hideNext))} />
              </div>
            </>
          ) : (
            <>
              <div className={navBtnClass(Boolean(hidePrev))} />
              <div className="reader-skel__bone reader-skel__nav-meta" />
              <div className={navBtnClass(Boolean(hideNext))} />
            </>
          )}
        </div>
      )}

      <div className="reader-skel__list">
        {Array.from({ length: count }, (_, i) =>
          isChapters ? (
            <div key={i} className="reader-skel__chapter">
              <div className="reader-skel__bone reader-skel__num" />
              <div className="reader-skel__chapter-body">
                <div
                  className="reader-skel__bone reader-skel__line"
                  style={{ width: CHAPTER_WIDTHS[i % CHAPTER_WIDTHS.length] }}
                />
                <div
                  className="reader-skel__bone reader-skel__line reader-skel__line--sm"
                  style={{ width: '42%' }}
                />
              </div>
            </div>
          ) : isSurah ? (
            <div key={i} className="reader-skel__card reader-skel__card--ayah">
              <div className="reader-skel__card-top">
                <div className="reader-skel__bone reader-skel__badge" />
                <div className="reader-skel__actions">
                  <div className="reader-skel__bone reader-skel__icon" />
                  <div className="reader-skel__bone reader-skel__icon" />
                  <div className="reader-skel__bone reader-skel__icon" />
                </div>
              </div>
              <div className="reader-skel__ayah-ar">
                <div
                  className="reader-skel__bone reader-skel__line reader-skel__line--ar"
                  style={{ width: AR_WIDTHS[i % AR_WIDTHS.length] }}
                />
                <div
                  className="reader-skel__bone reader-skel__line reader-skel__line--ar"
                  style={{ width: AR_WIDTHS[(i + 2) % AR_WIDTHS.length] }}
                />
              </div>
              <div
                className="reader-skel__bone reader-skel__line reader-skel__line--tr"
                style={{ width: LINE_WIDTHS[i % LINE_WIDTHS.length] }}
              />
            </div>
          ) : (
            <div key={i} className="reader-skel__card reader-skel__card--hadith">
              <div className="reader-skel__card-top">
                <div className="reader-skel__bone reader-skel__badge reader-skel__badge--hadith" />
                <div className="reader-skel__actions">
                  <div className="reader-skel__bone reader-skel__icon" />
                  <div className="reader-skel__bone reader-skel__icon" />
                </div>
              </div>
              <div className="reader-skel__hadith-bilingual">
                <div className="reader-skel__hadith-tr">
                  <div
                    className="reader-skel__bone reader-skel__line reader-skel__line--tr"
                    style={{ width: LINE_WIDTHS[i % LINE_WIDTHS.length] }}
                  />
                  <div
                    className="reader-skel__bone reader-skel__line reader-skel__line--tr"
                    style={{
                      width: LINE_WIDTHS[(i + 1) % LINE_WIDTHS.length],
                    }}
                  />
                  <div
                    className="reader-skel__bone reader-skel__line reader-skel__line--tr reader-skel__line--sm"
                    style={{
                      width: LINE_WIDTHS[(i + 2) % LINE_WIDTHS.length],
                    }}
                  />
                </div>
                <div className="reader-skel__hadith-ar">
                  <div
                    className="reader-skel__bone reader-skel__line reader-skel__line--ar"
                    style={{ width: AR_WIDTHS[i % AR_WIDTHS.length] }}
                  />
                  <div
                    className="reader-skel__bone reader-skel__line reader-skel__line--ar"
                    style={{
                      width: AR_WIDTHS[(i + 3) % AR_WIDTHS.length],
                    }}
                  />
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      {showNav && (
        <div className="reader-skel__nav reader-skel__nav--bottom">
          <div className={navBtnClass(Boolean(hidePrev))} />
          {isSurah ? (
            <span className="reader-skel__nav-spacer" aria-hidden="true" />
          ) : (
            <div className="reader-skel__bone reader-skel__nav-meta" />
          )}
          <div className={navBtnClass(Boolean(hideNext))} />
        </div>
      )}
    </div>
  )
}
