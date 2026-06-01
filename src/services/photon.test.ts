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
