# Builds (v1.0 — agreed 2026-10-29)

Games: **PoE 2** and **PoE 1**. Decisions are logged in `open-questions.md` § "Builds"
(B-numbered).

## 1. Goal

A simple personal list of builds: a **name**, an **ascendancy** and **links** to guides,
videos and planners (YouTube, Mobalytics, poe.ninja, PoB, Maxroll or any other site). No
prices, no external data.

## 2. Model

Schema: `packages/shared/src/builds/build.ts` (zod; validated on load).

```ts
interface Build {
  id: string; // uuid
  name: string;
  game: 'poe2' | 'poe1';
  ascendancy: string; // free text, suggestions from ASCENDANCIES[game]
  links: { url: string; label?: string }[]; // http(s) only
  updatedAt: string; // ISO
}
```

## 3. Page

- List of build cards sorted by name, filtered by a search (`q`, name + ascendancy).
- Each link shows a site badge recognised from its host and opens in a new tab.
- Add / edit inline (name required; a link without scheme gets `https://`), delete with a
  confirmation.
- Stored in `localStorage` under `poe-tools:builds:<game>`, carried by the app-wide backup
  (R10).
