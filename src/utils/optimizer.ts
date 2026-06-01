import { Intent, Place, Route, RouteStop } from '../types';
import { haversineDistance } from './haversine';
import { matchBrand } from './brandMatcher';

// Helper to generate all permutations of an array
function permute<T>(arr: T[]): T[][] {
  if (arr.length === 0) return [[]];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    const restPerms = permute(rest);
    for (const p of restPerms) {
      result.push([arr[i], ...p]);
    }
  }
  return result;
}

// Helper to generate Cartesian product
function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (a, b) => a.flatMap(d => b.map(e => [...d, e])),
    [[]]
  );
}

export function optimizeRoutes(
  intents: Intent[],
  places: Place[],
  userLat: number,
  userLon: number
): { routes: Route[], candidates: Record<string, Place[]> } {
  const MAX_CANDIDATES_PER_INTENT = intents.length >= 4 ? 5 : 10;
  
  const candidates: Record<string, Place[]> = {};
  const candidateArrays: Place[][] = [];

  for (let i = 0; i < intents.length; i++) {
    const intent = intents[i];
    const key = `${intent.type}-${i}`;
    
    // Filter matching type and brand
    let matching = places.filter(p => p.type === intent.type && matchBrand(p, intent.brand || ''));
    
    // Sort by distance to user to get best candidates
    matching.sort((a, b) => {
      const distA = haversineDistance(userLat, userLon, a.lat, a.lon);
      const distB = haversineDistance(userLat, userLon, b.lat, b.lon);
      return distA - distB;
    });

    matching = matching.slice(0, MAX_CANDIDATES_PER_INTENT);
    candidates[key] = matching;
    
    if (matching.length === 0) {
      // Missing an intent category completely, can't complete route
      return { routes: [], candidates };
    }
    
    candidateArrays.push(matching);
  }

  const combinations = cartesian(candidateArrays);
  const allRoutes: Route[] = [];

  for (const combo of combinations) {
    let totalDist = 0;
    let currLat = userLat;
    let currLon = userLon;
    const stops: RouteStop[] = [];

    // Strictly follow the order specified by the user's intents
    for (const stopPlace of combo) {
      const d = haversineDistance(currLat, currLon, stopPlace.lat, stopPlace.lon);
      totalDist += d;
      stops.push({ place: stopPlace, distanceFromPrevious: d });
      currLat = stopPlace.lat;
      currLon = stopPlace.lon;
    }

    allRoutes.push({ stops, totalDistance: totalDist });
  }

  // Sort all completed routes by total distance
  allRoutes.sort((a, b) => a.totalDistance - b.totalDistance);

  // Return top 5
  return { routes: allRoutes.slice(0, 5), candidates };
}
