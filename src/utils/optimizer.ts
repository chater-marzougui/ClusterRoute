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
