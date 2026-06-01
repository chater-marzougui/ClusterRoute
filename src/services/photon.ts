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
