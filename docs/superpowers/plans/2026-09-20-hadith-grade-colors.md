# Hadith Grade Colors Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Tint each hadith card background by resolved authenticity grade (sahih green, hasan blue, daif yellow, mawdu red).

**Architecture:** Pure `resolveHadithGrade` helper; API keeps `grades` from CDN and attaches `grade` on `HadithItem`; CSS modifiers on `.ayah--hadith`.

**Tech Stack:** TypeScript, existing hadith-api CDN loader, Reader.css.

## Global Constraints

- Albani-first grade pick; Bukhari/Muslim always sahih.
- Four buckets: sahih / hasan / daif / mawdu (+ unknown = default).
- Soft color-mix tints only; no badges.
- Bump section cache key so old cached items without grades refresh.

---

### Task 1: Resolver

**Files:** `src/utils/hadithGrade.ts`, `src/utils/hadithGrade.test.ts`

- [ ] Implement `HadithGradeBucket` + `resolveHadithGrade(bookId, grades)`.
- [ ] Run `node --experimental-strip-types --test src/utils/hadithGrade.test.ts`.

### Task 2: Wire data

**Files:** `src/data/types.ts`, `src/api/hadith.ts`

- [ ] Extend `ApiHadith` + `HadithItem` with grades/grade.
- [ ] Map grades in `mapHadiths`; bump cache key (`grade1`).

### Task 3: UI

**Files:** `src/components/pages/HadithSectionView.tsx`, `src/components/pages/Reader.css`

- [ ] Add `ayah--grade-*` class from `h.grade`.
- [ ] Soft green / blue / yellow / red backgrounds for light+dark.

### Task 4: Ship

- [ ] Commit italic fix if still pending + grade feature; push.
