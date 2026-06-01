# Photon Free-Text Geocoding — Design

**Date:** 2026-06-01
**Status:** Approved (pending spec review)

## Problem

The current pipeline is **free text → fixed category (one of ~20 amenities) → exact Overpass tag query**. This has two lossy chokepoints:

1. The parser (local or Gemini) must squeeze any query into one of a predefined category list.
2. Overpass then needs exact OSM tag matches.

Result: anything outside the known categories (e.g. "Renault dealership", a specific local restaurant) falls through and finds nothing.

## Solution

Replace category-based Overpass lookups with **free-text fuzzy geocoding via Photon (komoot)**. Each phrase the user types is searched directly against Photon, which is proximity-biased and typo-tolerant, so "find things near me by name" works without any category mapping.

### Decisions (from brainstorming)

- **Full replacement** — remove the fixed category list, the Overpass tag builder, the `Intent.type`/`brand` abstraction, and brand matching entirely.
- **Photon** as the geocoder — native `lat`/`lon` proximity bias, fuzzy search, lenient fair-use limits (parallel multi-stop requests OK).
- **Local splitter + Gemini fallback** — split queries into per-stop phrases locally; use Gemini only for messy prose. Keep the existing `parsingMode` setting (auto / gemini / local).

## New Data Flow

```
free text
  → splitQuery()        local: split on , ; & "and" "then"; Gemini fallback for prose
  → string[] phrases    e.g. ["TD bank", "Starbucks", "pharmacy"]
  → searchPlaces()      Photon: one request per phrase, run in parallel
  → Place[][]           one candidate array per phrase, each filtered to radius + sorted by distance
  → optimizeRoutes()    unchanged core math, now takes pre-grouped candidates
  → routes
```

A "stop" is now **a search phrase + its candidate places**. There is no `Intent` anymore.

## Components

### `src/services/photon.ts` (replaces `overpass.ts`)

- `searchPlaces(phrases: string[], lat: number, lon: number, radiusKm: number): Promise<Place[][]>`
- Per phrase: `GET https://photon.komoot.io/api?q=<phrase>&lat=<lat>&lon=<lon>&limit=15`
- Base URL held in a single swappable constant (`PHOTON_BASE_URL`) to allow self-hosting later.
- Map each GeoJSON feature → `Place`:
  - `name` ← `properties.name`, optionally suffixed with `properties.street` / `properties.city` for disambiguation
  - `lat`/`lon` ← `geometry.coordinates` — **note Photon returns `[lon, lat]`**
  - `type` ← `properties.osm_value` (e.g. `"cafe"`, `"bank"`) as a display hint; fallback to the phrase
  - `id` ← `${properties.osm_type}/${properties.osm_id}`
  - `tags` ← relevant `properties` (best-effort; no longer used for filtering)
- Filter out results beyond `radiusKm` (haversine), then sort ascending by distance to user.
- Requests fire in parallel via `Promise.all`.
- Internally, a single `geocode(phrase, lat, lon, radiusKm)` function owns the provider choice (Photon primary, Nominatim fallback) and the timeout/retry logic; `searchPlaces` just maps `phrases` over it. Adding/swapping a provider is isolated to this file.

### `src/services/queryParser.ts` (reworked from `parser.ts` + `gemini.ts`)

- `splitQueryLocal(q: string): string[]` — split on `,` `;` `&` `and` `then`, trim, drop empties.
- `splitQueryGemini(q: string, apiKey: string): Promise<string[]>` — new prompt: *"Return ONLY a JSON array of short place-search phrases, one per stop."* No fixed category enum.
- `Home.tsx` keeps the same `parsingMode` branching (auto / gemini / local), calling the splitters instead of the old intent parsers.

### `src/utils/optimizer.ts` (minor change)

- New signature: takes `candidatesPerStop: Place[][]` (already grouped, radius-filtered, distance-sorted) instead of a flat `Place[]` + `Intent[]`.
- Drops `type`/`brand` filtering and the `matchBrand` call.
- Candidate map keys become index-based (`stop-0`, `stop-1`, ...) since there is no `type` to key on.
- **Unchanged and still load-bearing:** the per-stop candidate caps (`MAX_CANDIDATES_PER_INTENT`), the Cartesian product, the permutation/brute-force route search, and the top-5 return.

### Types (`src/types/index.ts`)

- Remove `Intent`.
- `SearchResult`: replace `intents: Intent[]` with `phrases: string[]`.
- `Place` keeps `id/name/lat/lon/type/tags`; `type` is now only a display hint.

### UI (`src/pages/Home.tsx`)

- "Detected intents" chips now render the `phrases` strings.
- Candidate grouping / swap UI keys on stop index instead of `${type}-${i}`.
- No other layout changes.

## Error Handling

- Photon HTTP errors reuse the existing mapping: `RATE_LIMITED` (429), `TIMEOUT` (504), and a generic failure renamed `OVERPASS_FAILED` → `SEARCH_FAILED`. Update i18n keys in `en`, `fr`, `ar` (`errorOverpass` → `errorSearch`).
- CORS: Photon's public endpoint sends permissive CORS headers; browser `fetch` works directly.

## Resilience & UX (future-proofing + non-technical users)

These choices are made to keep the app working as services change and to give plain-language feedback.

### Resilience

- **Request timeout.** Each Photon request uses an `AbortController` with a ~8s timeout, so a hung endpoint never freezes the UI; a timeout maps to the `TIMEOUT` error.
- **One retry on transient failure.** Network error or 5xx → retry the request once before failing. (429 does not retry — it surfaces as `RATE_LIMITED`.)
- **Nominatim fallback adapter.** If Photon is unreachable (network error / 5xx after retry), fall back to a thin Nominatim adapter that returns the same `Place[]` shape. Both geocoders sit behind a common internal `geocode(phrase, lat, lon)` interface so the rest of the app never knows which one answered. This is the main "doesn't break in the future" guard: if one OSM service degrades, search still works.
- **Swappable base URLs.** `PHOTON_BASE_URL` and `NOMINATIM_BASE_URL` are single constants, so self-hosting or swapping endpoints later is a one-line change.

### Non-technical user feedback

- **Per-stop "not found" message.** Instead of a single generic "no route" error, when a specific phrase returns zero results within radius, show a plain-language message naming it: e.g. *"We couldn't find 'pharmacy' near you — try a different name or a wider search radius."* This needs no new return shape: `searchPlaces` returns `Place[][]` aligned by index with `phrases`, so an empty inner array marks a failed phrase. `Home.tsx` checks for empties (and maps their indices back to phrase text) before calling the optimizer.
- **Friendly empty/partial states.** If some but not all phrases resolve, the message lists exactly which stops failed rather than discarding everything silently.
- **No jargon in errors.** All user-facing strings go through i18n (`en`/`fr`/`ar`) and avoid words like "Overpass", "Photon", "geocoder", "API" — they describe what to do next (widen radius, rename the place).

## Files Removed

- `src/services/overpass.ts`
- `src/utils/brandMatcher.ts`
- The `CATEGORY_MAP` / `BRAND_MAP` logic in `src/utils/parser.ts` (file reworked into `queryParser.ts`)

## Out of Scope

- Self-hosting Photon (left swappable via constant).
- Changing the optimizer algorithm or candidate caps.
- Map rendering changes.

## Risks

- **Photon public instance availability / fair use** — acceptable for this app's volume; mitigated by the swappable base URL.
- **Result naming quality** — Photon `name` can be sparse for some POIs; mitigated by appending street/city.
- **`[lon, lat]` ordering** — easy to get backwards; called out explicitly above.
