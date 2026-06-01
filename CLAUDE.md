# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # Type-check (tsc -b) then Vite build
npm run lint       # ESLint
npm run preview    # Preview production build
```

## Architecture

ClusterRoute is a React 19 + TypeScript SPA built with Vite. It lets users describe a multi-stop errand run in plain text (e.g. "TD bank, Starbucks, pharmacy"), then finds real nearby places via OpenStreetMap and computes the shortest route between them.

**Core data flow (all triggered from `src/pages/Home.tsx`):**

1. **Intent parsing** — user's free-text query → `Intent[]` (type + optional brand)
   - `src/utils/parser.ts`: local keyword parser (no API needed)
   - `src/services/gemini.ts`: Gemini 2.5 Flash Lite fallback for richer NL understanding
   - Mode controlled by `parsingMode` setting: `auto` (Gemini if key present, else local), `gemini`, or `local`

2. **OSM data fetch** — `src/services/overpass.ts` builds an Overpass QL query from intents and POSTs to `overpass-api.de`. Supported categories: `atm`, `cafe`, `bank`, `supermarket`, `restaurant`, `fuel`, `pharmacy`, `park`, `library`, `hospital`.

3. **Route optimization** — `src/utils/optimizer.ts` takes all OSM candidates, filters by brand (`src/utils/brandMatcher.ts`), then uses Cartesian product of top candidates per intent and brute-force permutation to find the 5 shortest routes (Haversine distance, `src/utils/haversine.ts`). Candidate count caps at 10 (or 5 for 4+ intents) to bound complexity.

4. **Map rendering** — `src/components/Map.tsx` uses React Leaflet to display the user's location and the selected route's stop markers.

**State management:** Zustand store (`src/store/appStore.ts`) persists user settings (theme, language, Gemini API key, parsing mode) to `localStorage` under key `clusterroute-settings`.

**i18n:** `react-i18next` with locale files in `src/locales/` (en, fr, ar). Arabic triggers RTL layout (`dir="rtl"` on `<html>`). Language sync is handled in `src/App.tsx`.

**UI:** shadcn/ui components in `src/components/ui/`, Tailwind CSS v4, lucide-react icons.

## Key constraints

- The Gemini API key is stored client-side in localStorage — never log or expose it server-side.
- Route optimization is O(candidates^intents × intents!) — the candidate caps in `optimizer.ts` are load-bearing for performance; don't remove them without adding a smarter algorithm.
- Geolocation falls back to Paris (48.8566, 2.3522) if the browser denies permission.
