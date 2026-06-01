import { Place } from '../types';
import { haversineDistance } from '../utils/haversine';
import { categoryMatch } from '../utils/categoryTags';

// Provider endpoints kept as single swappable constants (self-hosting later = one-line change).
export const PHOTON_BASE_URL = 'https://photon.komoot.io/api';
export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';

const REQUEST_TIMEOUT_MS = 8000;
// Generous limit so nearby branches aren't truncated before our distance sort.
const RESULT_LIMIT = 40;
// Low value tells Photon to favour proximity over global prominence (0..1, default 0.4).
const LOCATION_BIAS_SCALE = '0.1';
// Initial attempt + this many radius doublings before declaring "not found".
const MAX_RADIUS_DOUBLINGS = 4;

// Axis-aligned bounding box around a point, as Photon expects it:
// "minLon,minLat,maxLon,maxLat". ~111 km per degree of latitude.
function bbox(lat: number, lon: number, radiusKm: number): string {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return `${lon - dLon},${lat - dLat},${lon + dLon},${lat + dLat}`;
}

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

// Strips the matched category keyword from the phrase so a brand+category query
// ("TD bank") searches for the distinguishing part ("TD") within the osm_tag
// filter. Falls back to the full phrase when nothing distinctive remains
// ("bank" -> "bank", "coffee" -> "coffee").
function queryTextFor(phrase: string, keyword: string | null): string {
  if (!keyword) return phrase;
  const stripped = phrase.replace(new RegExp(keyword, 'ig'), '').replace(/\s+/g, ' ').trim();
  return stripped.length > 0 ? stripped : phrase;
}

async function photonGeocode(
  phrase: string,
  lat: number,
  lon: number,
  radiusKm: number
): Promise<Place[]> {
  // Generic category words ("bank", "supermarket") get an osm_tag filter so we
  // match real POIs of that category instead of places merely named that way.
  const match = categoryMatch(phrase);

  const params = new URLSearchParams({
    q: queryTextFor(phrase, match?.keyword ?? null),
    lat: String(lat),
    lon: String(lon),
    limit: String(RESULT_LIMIT),
    bbox: bbox(lat, lon, radiusKm), // hard area constraint (lat/lon alone is only a bias)
    location_bias_scale: LOCATION_BIAS_SCALE,
  });
  if (match) params.append('osm_tag', match.tag);

  const url = `${PHOTON_BASE_URL}?${params.toString()}`;
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
    return sortAndFilter(await photonGeocode(phrase, lat, lon, radiusKm), lat, lon, radiusKm);
  } catch (err) {
    if (err instanceof Error && err.message === 'RATE_LIMITED') throw err;
    try {
      return sortAndFilter(await nominatimGeocode(phrase, lat, lon, radiusKm), lat, lon, radiusKm);
    } catch {
      throw new Error('SEARCH_FAILED');
    }
  }
}

// Geocode every phrase, returning Place[][] aligned by index with `phrases`.
// Phrases that come back empty are retried with the radius doubled, up to
// MAX_RADIUS_DOUBLINGS times. Already-found phrases are not re-queried. Any
// phrase still empty after the last attempt is left as [] (caller treats that
// as "not found").
// `onResolved` fires as soon as a phrase is settled — either found (non-empty)
// or finally given up (empty after all expansions). This lets the UI update the
// map progressively instead of waiting for every phrase to finish.
export async function searchPlaces(
  phrases: string[],
  lat: number,
  lon: number,
  radiusKm: number,
  onResolved?: (index: number, places: Place[]) => void
): Promise<Place[][]> {
  const results: Place[][] = phrases.map(() => []);
  let radius = radiusKm;

  for (let attempt = 0; attempt <= MAX_RADIUS_DOUBLINGS; attempt++) {
    const pending = results
      .map((places, i) => (places.length === 0 ? i : -1))
      .filter((i) => i >= 0);
    if (pending.length === 0) break;

    await Promise.all(
      pending.map((i) =>
        geocode(phrases[i], lat, lon, radius).then((places) => {
          results[i] = places;
          if (places.length > 0) onResolved?.(i, places); // found — reveal on map now
        })
      )
    );

    radius *= 2;
  }

  // Notify for phrases that never resolved, so the UI can mark them "not found".
  results.forEach((places, i) => {
    if (places.length === 0) onResolved?.(i, []);
  });

  return results;
}
