# Hadith grade background colors

**Date:** 2026-09-20  
**Project:** Tilāwah  
**Status:** Approved for planning

## Goal

Color each hadith card background by authenticity grade so readers can tell sahih / hasan / da'if at a glance while reading a section.

## Non-goals

- Filtering or hiding weak hadiths
- Per-scholar grade picker in UI
- Changing book list / section list styling
- Showing grade labels on the card (color only)

## Data source

`fawazahmed0/hadith-api` already exposes `grades: { name, grade }[]` on many editions (confirmed on Sunan books). Bukhari and Muslim typically have an empty `grades` array.

## Grade resolution

1. **Bukhari / Muslim** → always treat as `sahih` (whole collections are sahih by compiler intent; API grades are empty).
2. For other books:
   - Prefer grade whose `name` matches Al-Albani (case-insensitive contains `albani`).
   - Else use the first grade in the array.
   - Else `unknown` (keep default card surface).
3. Map the chosen grade string (case-insensitive) into one of three buckets:
   - **sahih** — contains `sahih` (including `Hasan Sahih`, `Isnaad Sahih`, `Sahih Lighairihi`, cross-refs to Bukhari/Muslim, etc.)
   - **hasan** — contains `hasan` and not already classified as sahih
   - **daif** — contains `daif` / `da'if` / `weak`, or clearly weaker labels (`munkar`, `shadh`, `mawdu`, etc.)
   - **unknown** — anything else / empty

Priority when a string could match more than one: **sahih > hasan > daif** (so `Hasan Sahih` → sahih).

## Visual design

- Full card background tint (user choice B), not only a left rail.
- Soft color-mix against `--surface` so light/dark themes stay readable:
  - sahih → subtle green
  - hasan → subtle amber/yellow
  - daif → subtle red
  - unknown → unchanged current surface
- No grade text badge on the card.

## Implementation sketch

1. Extend API parse in `src/api/hadith.ts` to keep `grades` from JSON.
2. Add `grade?: 'sahih' | 'hasan' | 'daif'` (or derive at render) on `HadithItem`.
3. Pure helper `resolveHadithGrade(bookId, grades) → bucket`.
4. In `HadithSectionView`, add modifier class on `.ayah--hadith` (e.g. `ayah--grade-sahih`).
5. CSS in `Reader.css` for the three tint classes.
6. Unit tests for the resolver (Albani preference, Hasan Sahih → sahih, Bukhari force-sahih, empty → unknown).

## Risks / notes

- Grade strings in the CDN are free-form English; the mapper must be tolerant, not exact-match only.
- Multiple scholars can disagree; we intentionally follow Albani-first for predictability (user choice A).
- Soft tints only — strong full fills would hurt long reading sessions.

## Success criteria

- Opening Abu Dawud / Tirmidhi section shows mixed card colors matching resolved grades.
- Bukhari / Muslim cards are all green-tinted sahih.
- Cards without usable grades look like today.
- Light and dark themes remain readable.
