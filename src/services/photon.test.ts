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

  it('constrains the query with a bbox', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(String(url));
      return photonResponse([]);
    }));
    await geocode('cafe', USER.lat, USER.lon, 10);
    expect(urls[0]).toContain('bbox=');
  });

  it('adds an osm_tag filter for category words but not for brand names', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(String(url));
      return photonResponse([]);
    }));
    await geocode('bank', USER.lat, USER.lon, 10);
    await geocode('Starbucks', USER.lat, USER.lon, 10);
    expect(urls[0]).toContain('osm_tag=amenity%3Abank');
    expect(urls[1]).not.toContain('osm_tag');
  });

  it('strips the category word from a brand+category query but keeps the osm_tag', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(String(url));
      return photonResponse([]);
    }));
    await geocode('TD bank', USER.lat, USER.lon, 10);
    expect(urls[0]).toContain('q=TD&'); // "bank" stripped from the text query
    expect(urls[0]).toContain('osm_tag=amenity%3Abank');
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

  it('doubles the radius and retries until a phrase is found', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      // First two attempts find nothing; the third (larger bbox) succeeds.
      if (calls.length >= 3) {
        return photonResponse([photonFeature('Late Cafe', 2.353, 48.857)]);
      }
      return photonResponse([]);
    }));

    const results = await searchPlaces(['cafe'], USER.lat, USER.lon, 10);
    expect(results[0]).toHaveLength(1);
    expect(calls.length).toBe(3); // retried twice before the hit
  });

  it('gives up with an empty result after the maximum number of attempts', async () => {
    const fetchMock = vi.fn(async () => photonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchPlaces(['nowhere place'], USER.lat, USER.lon, 10);
    expect(results[0]).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(5); // initial + 4 doublings
  });
});
