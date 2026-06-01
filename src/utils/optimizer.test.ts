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
