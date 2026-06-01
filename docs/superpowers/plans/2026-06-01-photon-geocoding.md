# Photon Free-Text Geocoding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace category-based Overpass lookups with free-text fuzzy geocoding (Photon, with a Nominatim fallback) so any place a user names is found near them.

**Architecture:** The query is split into per-stop search phrases (local splitter, Gemini fallback for prose). Each phrase is geocoded through a single `geocode()` function (Photon primary, Nominatim fallback, with timeout + one retry), returning `Place[]` already filtered to the search radius and sorted by distance. The optimizer takes these pre-grouped candidate arrays and runs its existing brute-force shortest-route search unchanged. The old `Intent`/category/brand abstraction is removed.

**Tech Stack:** React 19 + TypeScript + Vite, Zustand, react-i18next, Leaflet. Tests added with Vitest.

---

## File Structure

- **Create** `src/services/photon.ts` — geocoding service: `searchPlaces`, `geocode`, provider adapters, timeout/retry, radius filter/sort. Replaces `overpass.ts`.
- **Create** `src/services/queryParser.ts` — `splitQueryLocal` + `splitQueryGemini`. Replaces `parser.ts` + `gemini.ts`.
- **Modify** `src/utils/optimizer.ts` — new signature taking `Place[][]`; drop type/brand filtering.
- **Modify** `src/types/index.ts` — remove `Intent`; `SearchResult.intents` → `phrases: string[]`.
- **Modify** `src/pages/Home.tsx` — wire splitter → searchPlaces → optimizer; per-stop "not found" errors; phrase chips.
- **Modify** `src/locales/{en,fr,ar}.json` — add `errorSearch` + `errorNotFound`, drop Overpass wording.
- **Delete** `src/services/overpass.ts`, `src/services/gemini.ts`, `src/utils/parser.ts`, `src/utils/brandMatcher.ts`.
- **Create** test files alongside (`src/**/*.test.ts`) + Vitest config.

> **Build note:** Type-level changes (Task 5) ripple through `Home.tsx` until the wiring task (Task 6) is done. Per-task **unit tests** (Vitest) pass in isolation throughout; the full `npm run build` is verified green at Task 6 and again at Task 8. Commit per task regardless — intermediate commits may not `tsc` until Task 6, which is expected and called out.

---

## Task 1: Add Vitest test infrastructure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/utils/haversine.test.ts` (smoke test proving the runner works)

- [ ] **Step 1: Install Vitest**

Run:
```bash
npm install -D vitest
```
Expected: `vitest` added to devDependencies, install completes without error.

- [ ] **Step 2: Add the test script**

In `package.json`, add to the `"scripts"` block (after `"lint"`):
```json
    "test": "vitest run",
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write a smoke test for the existing haversine util**

Create `src/utils/haversine.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { haversineDistance } from './haversine';

describe('haversineDistance', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineDistance(48.85, 2.35, 48.85, 2.35)).toBeCloseTo(0, 5);
  });

  it('returns a positive distance for different points', () => {
    expect(haversineDistance(48.85, 2.35, 48.86, 2.36)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `npm test`
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/utils/haversine.test.ts
git commit -m "test: add Vitest infrastructure"
```

---

## Task 2: Query splitter (`queryParser.ts`)

**Files:**
- Create: `src/services/queryParser.ts`
- Test: `src/services/queryParser.test.ts`

- [ ] **Step 1: Write failing tests for the local splitter**

Create `src/services/queryParser.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { splitQueryLocal } from './queryParser';

describe('splitQueryLocal', () => {
  it('splits on commas', () => {
    expect(splitQueryLocal('TD bank, Starbucks, pharmacy')).toEqual([
      'TD bank', 'Starbucks', 'pharmacy',
    ]);
  });

  it('splits on "and", "then", semicolons and ampersands', () => {
    expect(splitQueryLocal('coffee then bank; gas & pharmacy')).toEqual([
      'coffee', 'bank', 'gas', 'pharmacy',
    ]);
  });

  it('trims whitespace and drops empty segments', () => {
    expect(splitQueryLocal('  cafe ,, , bank  ')).toEqual(['cafe', 'bank']);
  });

  it('returns an empty array for blank input', () => {
    expect(splitQueryLocal('   ')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/services/queryParser.test.ts`
Expected: FAIL — `splitQueryLocal` is not defined.

- [ ] **Step 3: Implement `queryParser.ts`**

Create `src/services/queryParser.ts`:
```ts
// Splits a free-text errand query into one search phrase per stop.

// Connectors that separate stops: comma, semicolon, ampersand, and the words
// "and" / "then" (as whole words). Note: this will mis-split phrases like
// "fish and chips" — that's the case the Gemini fallback is meant to handle.
const CONNECTORS = /\s*(?:,|;|&|\bthen\b|\band\b)\s*/i;

export function splitQueryLocal(query: string): string[] {
  return query
    .split(CONNECTORS)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function splitQueryGemini(query: string, apiKey: string): Promise<string[]> {
  if (!apiKey) throw new Error('Gemini API key is required');

  const prompt = `You turn an errand description into a list of place-search phrases.
Return ONLY a raw JSON array of short strings — one per place the user wants to visit.
Each string should be something you could type into a maps search box (a place name,
brand, or category), e.g. ["TD bank", "coffee shop", "pharmacy"].
Do not include markdown or code fences. Return strictly JSON.

Query: "${query}"`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) throw new Error('No response from Gemini');

  const sanitized = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(sanitized);
  if (!Array.isArray(parsed)) throw new Error('Invalid output structure');

  return parsed
    .map((item: unknown) => (typeof item === 'string' ? item.trim() : String(item).trim()))
    .filter(Boolean);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/services/queryParser.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/queryParser.ts src/services/queryParser.test.ts
git commit -m "feat: add free-text query splitter (local + Gemini)"
```

---

## Task 3: Geocoding service (`photon.ts`)

**Files:**
- Create: `src/services/photon.ts`
- Test: `src/services/photon.test.ts`

- [ ] **Step 1: Write failing tests (mocked fetch)**

Create `src/services/photon.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchPlaces, geocode } from './photon';

const USER = { lat: 48.8566, lon: 2.3522 };

function photonResponse(features: unknown[]) {
  return { ok: true, status: 200, json: async () => ({ features }) };
}

function photonFeature(name: string, lon: number, lat: number, osmValue = 'cafe') {
  return {
    geometry: { coordinates: [lon, lat] },
    properties: { name, osm_type: 'N', osm_id: Math.round(lon * 1e6), osm_value: osmValue },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('geocode', () => {
  it('maps Photon features to Place objects, sorted by distance', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      photonResponse([
        photonFeature('Far Cafe', 2.40, 48.90),   // farther
        photonFeature('Near Cafe', 2.353, 48.857), // closer
      ])
    ));

    const places = await geocode('cafe', USER.lat, USER.lon, 50);
    expect(places).toHaveLength(2);
    expect(places[0].name).toBe('Near Cafe');
    expect(places[0].lat).toBeCloseTo(48.857, 3);
    expect(places[0].lon).toBeCloseTo(2.353, 3);
    expect(places[0].type).toBe('cafe');
  });

  it('filters out results beyond the radius', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      photonResponse([photonFeature('Way Out', 10.0, 50.0)])
    ));
    const places = await geocode('cafe', USER.lat, USER.lon, 5);
    expect(places).toEqual([]);
  });

  it('throws RATE_LIMITED on HTTP 429 without falling back', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(geocode('cafe', USER.lat, USER.lon, 50)).rejects.toThrow('RATE_LIMITED');
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retry, no fallback
  });
});

describe('searchPlaces', () => {
  it('returns one Place[] per phrase, aligned by index', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('bank')) return photonResponse([photonFeature('A Bank', 2.354, 48.857, 'bank')]);
      return photonResponse([]); // the other phrase finds nothing
    }));

    const results = await searchPlaces(['bank', 'unicorn store'], USER.lat, USER.lon, 50);
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveLength(1);
    expect(results[1]).toEqual([]); // empty marks a failed phrase
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/services/photon.test.ts`
Expected: FAIL — module `./photon` has no exports `searchPlaces`/`geocode`.

- [ ] **Step 3: Implement `photon.ts`**

Create `src/services/photon.ts`:
```ts
import { Place } from '../types';
import { haversineDistance } from '../utils/haversine';

// Provider endpoints kept as single swappable constants (self-hosting later = one-line change).
export const PHOTON_BASE_URL = 'https://photon.komoot.io/api';
export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';

const REQUEST_TIMEOUT_MS = 8000;
const RESULT_LIMIT = 15;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// One GET with: 429 -> RATE_LIMITED (no retry), abort -> TIMEOUT, network/5xx -> retried once.
async function requestJson(url: string): Promise<unknown> {
  let lastErr: Error = new Error('SEARCH_FAILED');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.status === 429) throw new Error('RATE_LIMITED');
      if (res.status >= 500) throw new Error('SERVER_ERROR');
      if (!res.ok) throw new Error('SEARCH_FAILED');
      return await res.json();
    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMITED') throw err;
      if (err instanceof Error && err.name === 'AbortError') lastErr = new Error('TIMEOUT');
      else lastErr = err instanceof Error ? err : new Error('SEARCH_FAILED');
      // loop retries once for network / 5xx / timeout
    }
  }
  throw lastErr;
}

function sortAndFilter(places: Place[], lat: number, lon: number, radiusKm: number): Place[] {
  return places
    .filter((p) => haversineDistance(lat, lon, p.lat, p.lon) <= radiusKm)
    .sort(
      (a, b) =>
        haversineDistance(lat, lon, a.lat, a.lon) - haversineDistance(lat, lon, b.lat, b.lon)
    );
}

// ---- Photon (primary) -------------------------------------------------------
interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
}

function mapPhoton(data: unknown, phrase: string): Place[] {
  const features = (data as { features?: PhotonFeature[] })?.features ?? [];
  const places: Place[] = [];
  for (const f of features) {
    const coords = f.geometry?.coordinates;
    if (!coords) continue;
    const [lon, lat] = coords; // Photon returns [lon, lat]
    const p = f.properties ?? {};
    const name = (p.name as string) || [p.street, p.city].filter(Boolean).join(', ') || phrase;
    places.push({
      id: `${p.osm_type ?? 'n'}/${p.osm_id ?? `${lat},${lon}`}`,
      name,
      lat,
      lon,
      type: (p.osm_value as string) || phrase,
      tags: {
        ...(typeof p.osm_key === 'string' ? { osm_key: p.osm_key } : {}),
        ...(typeof p.osm_value === 'string' ? { osm_value: p.osm_value } : {}),
      },
    });
  }
  return places;
}

async function photonGeocode(phrase: string, lat: number, lon: number): Promise<Place[]> {
  const url = `${PHOTON_BASE_URL}?q=${encodeURIComponent(phrase)}&lat=${lat}&lon=${lon}&limit=${RESULT_LIMIT}`;
  return mapPhoton(await requestJson(url), phrase);
}

// ---- Nominatim (fallback) ---------------------------------------------------
interface NominatimResult {
  lat: string;
  lon: string;
  osm_type?: string;
  osm_id?: number;
  name?: string;
  display_name?: string;
  type?: string;
}

function mapNominatim(data: unknown, phrase: string): Place[] {
  const rows = (data as NominatimResult[]) ?? [];
  return rows.map((r) => ({
    id: `${r.osm_type ?? 'n'}/${r.osm_id ?? `${r.lat},${r.lon}`}`,
    name: r.name || r.display_name?.split(',')[0]?.trim() || phrase,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    type: r.type || phrase,
    tags: {},
  }));
}

function bboxViewbox(lat: number, lon: number, radiusKm: number): string {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  // Nominatim viewbox order: left,top,right,bottom (lon,lat,lon,lat)
  return `${lon - dLon},${lat + dLat},${lon + dLon},${lat - dLat}`;
}

async function nominatimGeocode(
  phrase: string,
  lat: number,
  lon: number,
  radiusKm: number
): Promise<Place[]> {
  const viewbox = bboxViewbox(lat, lon, radiusKm);
  const url = `${NOMINATIM_BASE_URL}?q=${encodeURIComponent(phrase)}&format=jsonv2&limit=${RESULT_LIMIT}&bounded=1&viewbox=${viewbox}`;
  return mapNominatim(await requestJson(url), phrase);
}

// ---- Public API -------------------------------------------------------------
// Geocode one phrase: Photon primary, Nominatim fallback (except on rate-limit).
export async function geocode(
  phrase: string,
  lat: number,
  lon: number,
  radiusKm: number
): Promise<Place[]> {
  try {
    return sortAndFilter(await photonGeocode(phrase, lat, lon), lat, lon, radiusKm);
  } catch (err) {
    if (err instanceof Error && err.message === 'RATE_LIMITED') throw err;
    try {
      return sortAndFilter(await nominatimGeocode(phrase, lat, lon, radiusKm), lat, lon, radiusKm);
    } catch {
      throw new Error('SEARCH_FAILED');
    }
  }
}

// Geocode every phrase in parallel; returns Place[][] aligned by index with `phrases`.
export async function searchPlaces(
  phrases: string[],
  lat: number,
  lon: number,
  radiusKm: number
): Promise<Place[][]> {
  return Promise.all(phrases.map((phrase) => geocode(phrase, lat, lon, radiusKm)));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/services/photon.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/photon.ts src/services/photon.test.ts
git commit -m "feat: add Photon geocoding service with Nominatim fallback"
```

---

## Task 4: Refactor optimizer to take pre-grouped candidates

**Files:**
- Modify: `src/utils/optimizer.ts`
- Test: `src/utils/optimizer.test.ts`

- [ ] **Step 1: Write failing tests for the new signature**

Create `src/utils/optimizer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { optimizeRoutes } from './optimizer';
import { Place } from '../types';

const USER = { lat: 0, lon: 0 };

function place(id: string, lat: number, lon: number): Place {
  return { id, name: id, lat, lon, type: 'x', tags: {} };
}

describe('optimizeRoutes', () => {
  it('builds a route in the order of the stops', () => {
    const candidatesPerStop: Place[][] = [
      [place('a', 0, 0.01)],
      [place('b', 0, 0.02)],
    ];
    const { routes } = optimizeRoutes(candidatesPerStop, USER.lat, USER.lon);
    expect(routes).toHaveLength(1);
    expect(routes[0].stops.map((s) => s.place.id)).toEqual(['a', 'b']);
    expect(routes[0].totalDistance).toBeGreaterThan(0);
  });

  it('returns no routes when any stop has zero candidates', () => {
    const { routes } = optimizeRoutes([[place('a', 0, 0.01)], []], USER.lat, USER.lon);
    expect(routes).toEqual([]);
  });

  it('keys candidates by stop index', () => {
    const { candidates } = optimizeRoutes([[place('a', 0, 0.01)]], USER.lat, USER.lon);
    expect(Object.keys(candidates)).toEqual(['stop-0']);
  });

  it('picks the nearest combination as the best route', () => {
    const candidatesPerStop: Place[][] = [
      [place('near', 0, 0.01), place('far', 0, 0.5)],
    ];
    const { routes } = optimizeRoutes(candidatesPerStop, USER.lat, USER.lon);
    expect(routes[0].stops[0].place.id).toBe('near');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/utils/optimizer.test.ts`
Expected: FAIL — `optimizeRoutes` still expects the old `(intents, places, ...)` signature (type error / wrong behavior).

- [ ] **Step 3: Rewrite `optimizer.ts`**

Replace the entire contents of `src/utils/optimizer.ts` with:
```ts
import { Place, Route, RouteStop } from '../types';
import { haversineDistance } from './haversine';

// Helper to generate Cartesian product
function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((a, b) => a.flatMap((d) => b.map((e) => [...d, e])), [[]]);
}

export function estimateTravelTime(distanceKm: number): { walkMin: number; driveMin: number } {
  return {
    walkMin: Math.round((distanceKm / 5) * 60),
    driveMin: Math.round((distanceKm / 30) * 60),
  };
}

export function optimizeRoutes(
  candidatesPerStop: Place[][],
  userLat: number,
  userLon: number,
  maxCandidates: number = 10
): { routes: Route[]; candidates: Record<string, Place[]> } {
  const stopCount = candidatesPerStop.length;
  // Candidate caps are load-bearing for performance — O(candidates^stops * stops!).
  const MAX_CANDIDATES_PER_STOP = Math.min(maxCandidates, stopCount >= 4 ? 5 : maxCandidates);

  const candidates: Record<string, Place[]> = {};
  const candidateArrays: Place[][] = [];

  for (let i = 0; i < stopCount; i++) {
    const sorted = [...candidatesPerStop[i]]
      .sort(
        (a, b) =>
          haversineDistance(userLat, userLon, a.lat, a.lon) -
          haversineDistance(userLat, userLon, b.lat, b.lon)
      )
      .slice(0, MAX_CANDIDATES_PER_STOP);

    candidates[`stop-${i}`] = sorted;

    if (sorted.length === 0) {
      // A stop with no candidates means the route can't be completed.
      return { routes: [], candidates };
    }
    candidateArrays.push(sorted);
  }

  const combinations = cartesian(candidateArrays);
  const allRoutes: Route[] = [];

  for (const combo of combinations) {
    let totalDist = 0;
    let currLat = userLat;
    let currLon = userLon;
    const stops: RouteStop[] = [];

    // Strictly follow the order specified by the user's stops.
    for (const stopPlace of combo) {
      const d = haversineDistance(currLat, currLon, stopPlace.lat, stopPlace.lon);
      totalDist += d;
      const { walkMin, driveMin } = estimateTravelTime(d);
      stops.push({ place: stopPlace, distanceFromPrevious: d, walkMin, driveMin });
      currLat = stopPlace.lat;
      currLon = stopPlace.lon;
    }

    allRoutes.push({ stops, totalDistance: totalDist });
  }

  allRoutes.sort((a, b) => a.totalDistance - b.totalDistance);
  return { routes: allRoutes.slice(0, 5), candidates };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/utils/optimizer.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/optimizer.ts src/utils/optimizer.test.ts
git commit -m "refactor: optimizer takes pre-grouped candidate arrays"
```

---

## Task 5: Update types (remove `Intent`, add `phrases`)

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Remove the `Intent` interface**

In `src/types/index.ts`, delete:
```ts
export interface Intent {
  type: string;
  brand?: string;
}
```

- [ ] **Step 2: Replace `intents` with `phrases` in `SearchResult`**

Change:
```ts
export interface SearchResult {
  intents: Intent[];
  candidates: Record<string, Place[]>;
  routes: Route[];
  error?: string;
}
```
to:
```ts
export interface SearchResult {
  phrases: string[];
  candidates: Record<string, Place[]>;
  routes: Route[];
  error?: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "refactor: replace Intent with search phrases in types"
```

> Build will not `tsc` cleanly until Task 6 rewires `Home.tsx`. That is expected.

---

## Task 6: Wire `Home.tsx` to the new pipeline

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Update imports**

In `src/pages/Home.tsx`, replace these lines:
```ts
import { SearchResult, Intent, Place } from '../types';
import { parseQueryGemini } from '../services/gemini';
import { parseQueryLocal } from '../utils/parser';
import { fetchOSMPlaces } from '../services/overpass';
import { optimizeRoutes } from '../utils/optimizer';
```
with:
```ts
import { SearchResult, Place } from '../types';
import { splitQueryGemini, splitQueryLocal } from '../services/queryParser';
import { searchPlaces } from '../services/photon';
import { optimizeRoutes } from '../utils/optimizer';
```

- [ ] **Step 2: Replace the parse + fetch + optimize block in `runSearch`**

In `runSearch`, replace this block:
```ts
        let intents: Intent[] = [];
        if (parsingMode === 'gemini' || (parsingMode === 'auto' && geminiApiKey)) {
          try { intents = await parseQueryGemini(searchQuery, geminiApiKey); }
          catch {
            if (parsingMode === 'gemini') throw new Error(t('errorGemini'));
            intents = parseQueryLocal(searchQuery);
          }
        } else {
          intents = parseQueryLocal(searchQuery);
        }

        if (intents.length === 0) throw new Error(t('errorEmpty'));

        const places = await fetchOSMPlaces(intents, userLat, userLon, searchRadius * 1000);
        const { routes, candidates } = optimizeRoutes(intents, places, userLat, userLon, maxCandidates);

        if (routes.length === 0) throw new Error(t('errorEmpty'));
```
with:
```ts
        let phrases: string[] = [];
        if (parsingMode === 'gemini' || (parsingMode === 'auto' && geminiApiKey)) {
          try { phrases = await splitQueryGemini(searchQuery, geminiApiKey); }
          catch {
            if (parsingMode === 'gemini') throw new Error(t('errorGemini'));
            phrases = splitQueryLocal(searchQuery);
          }
        } else {
          phrases = splitQueryLocal(searchQuery);
        }

        if (phrases.length === 0) throw new Error(t('errorEmpty'));

        const placesPerStop = await searchPlaces(phrases, userLat, userLon, searchRadius);

        // Plain-language feedback: name exactly which stops we couldn't find.
        const missing = phrases.filter((_, i) => placesPerStop[i].length === 0);
        if (missing.length > 0) {
          throw new Error(t('errorNotFound', { places: missing.join(', ') }));
        }

        const { routes, candidates } = optimizeRoutes(placesPerStop, userLat, userLon, maxCandidates);

        if (routes.length === 0) throw new Error(t('errorEmpty'));
```

- [ ] **Step 3: Update the result payload and error mapping**

In the same function, change:
```ts
        setResult({ intents, candidates, routes });
```
to:
```ts
        setResult({ phrases, candidates, routes });
```

Then in the `catch` block, change:
```ts
        else if (msg === 'OVERPASS_FAILED') setError(t('errorOverpass'));
```
to:
```ts
        else if (msg === 'SEARCH_FAILED') setError(t('errorSearch'));
```

- [ ] **Step 4: Update the "detected" chips**

Replace:
```ts
        {result && result.intents.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted-foreground">{t('detectedIntents')}:</span>
            {result.intents.map((intent, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                {intent.brand ? `${intent.brand} ${intent.type}` : intent.type}
              </span>
            ))}
          </div>
        )}
```
with:
```ts
        {result && result.phrases.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted-foreground">{t('detectedIntents')}:</span>
            {result.phrases.map((phrase, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                {phrase}
              </span>
            ))}
          </div>
        )}
```

- [ ] **Step 5: Update the candidate lookup key**

Replace:
```ts
                  const intentKey = result.intents[idx] ? `${result.intents[idx].type}-${idx}` : null;
                  const candidatesForStop = intentKey
                    ? (result.candidates[intentKey] ?? []).filter((p) => p.id !== stop.place.id).slice(0, 3)
                    : [];
```
with:
```ts
                  const stopKey = `stop-${idx}`;
                  const candidatesForStop = (result.candidates[stopKey] ?? [])
                    .filter((p) => p.id !== stop.place.id)
                    .slice(0, 3);
```

- [ ] **Step 6: Verify the full build and tests pass**

Run: `npm run build`
Expected: `tsc -b` and Vite build both succeed with no errors.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat: wire Home to phrase splitter + Photon geocoding"
```

---

## Task 7: Update i18n strings (en / fr / ar)

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/locales/fr.json`
- Modify: `src/locales/ar.json`

- [ ] **Step 1: English — replace the Overpass error and add new keys**

In `src/locales/en.json`, replace:
```json
  "errorOverpass": "Overpass query failed.",
```
with:
```json
  "errorSearch": "Place search failed. Please try again.",
  "errorNotFound": "We couldn't find {{places}} near you — try a different name or a wider search radius.",
```
And replace the `aboutText` line:
```json
  "aboutText": "ClusterRoute helps you find the best cluster of places near you. Powered by OpenStreetMap, Overpass API, and Gemini. Everything runs in your browser for complete privacy.",
```
with:
```json
  "aboutText": "ClusterRoute helps you find the best cluster of places near you. Powered by OpenStreetMap and Gemini. Everything runs in your browser for complete privacy.",
```

- [ ] **Step 2: French — same changes**

In `src/locales/fr.json`, replace:
```json
  "errorOverpass": "Échec de la requête Overpass.",
```
with:
```json
  "errorSearch": "La recherche de lieux a échoué. Veuillez réessayer.",
  "errorNotFound": "Nous n'avons pas trouvé {{places}} près de vous — essayez un autre nom ou un rayon plus large.",
```
And the `aboutText` line is already free of "Overpass" (it reads "OpenStreetMap et Gemini") — leave it as is.

- [ ] **Step 3: Arabic — same changes**

In `src/locales/ar.json`, replace:
```json
  "errorOverpass": "فشل استعلام Overpass.",
```
with:
```json
  "errorSearch": "فشل البحث عن الأماكن. يرجى المحاولة مرة أخرى.",
  "errorNotFound": "لم نتمكن من العثور على {{places}} بالقرب منك — جرّب اسماً آخر أو نطاق بحث أوسع.",
```
The `aboutText` line already reads "OpenStreetMap وجيميني" (no Overpass) — leave it as is.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: success (JSON valid, no TS errors).

- [ ] **Step 5: Commit**

```bash
git add src/locales/en.json src/locales/fr.json src/locales/ar.json
git commit -m "i18n: add place-search errors, drop Overpass wording"
```

---

## Task 8: Delete dead modules and final verification

**Files:**
- Delete: `src/services/overpass.ts`
- Delete: `src/services/gemini.ts`
- Delete: `src/utils/parser.ts`
- Delete: `src/utils/brandMatcher.ts`

- [ ] **Step 1: Confirm nothing imports the dead modules**

Run: `npx grep -rn "overpass\|services/gemini\|utils/parser\|brandMatcher" src` (or use editor search)
Expected: no matches in `src/` except the files about to be deleted.

- [ ] **Step 2: Delete the files**

```bash
git rm src/services/overpass.ts src/services/gemini.ts src/utils/parser.ts src/utils/brandMatcher.ts
```

- [ ] **Step 3: Final build, lint, and test**

Run: `npm run build`
Expected: success.

Run: `npm run lint`
Expected: no errors.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove Overpass, brand matcher, and old parser modules"
```

---

## Manual smoke test (after Task 8)

- [ ] Run `npm run dev`, allow geolocation.
- [ ] Search `TD bank, Starbucks, pharmacy` → three stops resolve, a route renders on the map.
- [ ] Search a deliberately unfindable term mixed with a real one, e.g. `pharmacy, asdfqwer zzz` → the error names the missing phrase ("…couldn't find asdfqwer zzz…").
- [ ] Search a specific local place by name (something not in the old category list) → it resolves. This is the core win over Overpass.
- [ ] Toggle Settings → Parsing Mode to "Local Only" and confirm comma-separated queries still work without a Gemini key.

---

## Self-Review Notes

- **Spec coverage:** full replacement (Tasks 5–8 remove Intent/Overpass/brand) ✓; Photon primary + Nominatim fallback (Task 3) ✓; local splitter + Gemini fallback (Task 2, wired Task 6) ✓; timeout + one retry (Task 3 `requestJson`) ✓; per-stop not-found message (Task 6 + Task 7 `errorNotFound`) ✓; jargon-free i18n across en/fr/ar (Task 7) ✓; swappable base URLs (Task 3 constants) ✓; `[lon, lat]` ordering handled (Task 3 `mapPhoton`) ✓; optimizer caps preserved (Task 4) ✓.
- **Type consistency:** `searchPlaces(phrases, lat, lon, radiusKm) → Place[][]`, `geocode(phrase, lat, lon, radiusKm) → Place[]`, `optimizeRoutes(candidatesPerStop, userLat, userLon, maxCandidates)`, candidate keys `stop-${i}`, `SearchResult.phrases` — all consistent across Tasks 3/4/5/6.
- **Units:** `searchRadius` is passed to `searchPlaces` in **km** (Task 6) — the old `* 1000` meters conversion for Overpass is intentionally dropped; `haversineDistance` returns km, matching the radius filter in Task 3.
