import { Intent, Place } from '../types';

function buildOverpassQuery(intents: Intent[], lat: number, lon: number, radius = 15000): string {
  let queryParts = '';
  
  const categoriesToQuery = new Set(intents.map(i => i.type));

  for (const type of categoriesToQuery) {
    if (type === 'atm') {
      queryParts += `node(around:${radius},${lat},${lon})["amenity"="atm"];way(around:${radius},${lat},${lon})["amenity"="atm"];`;
    } else if (type === 'cafe') {
      queryParts += `node(around:${radius},${lat},${lon})["amenity"="cafe"];way(around:${radius},${lat},${lon})["amenity"="cafe"];`;
    } else if (type === 'bank') {
      queryParts += `node(around:${radius},${lat},${lon})["amenity"="bank"];way(around:${radius},${lat},${lon})["amenity"="bank"];`;
    } else if (type === 'supermarket') {
      queryParts += `node(around:${radius},${lat},${lon})["shop"~"supermarket|grocery"];way(around:${radius},${lat},${lon})["shop"~"supermarket|grocery"];`;
    } else if (type === 'restaurant') {
      queryParts += `node(around:${radius},${lat},${lon})["amenity"~"restaurant|fast_food"];way(around:${radius},${lat},${lon})["amenity"~"restaurant|fast_food"];`;
    } else if (type === 'fuel') {
      queryParts += `node(around:${radius},${lat},${lon})["amenity"="fuel"];way(around:${radius},${lat},${lon})["amenity"="fuel"];`;
    } else if (type === 'pharmacy') {
      queryParts += `node(around:${radius},${lat},${lon})["amenity"="pharmacy"];way(around:${radius},${lat},${lon})["amenity"="pharmacy"];`;
    } else if (type === 'park') {
      queryParts += `node(around:${radius},${lat},${lon})["leisure"="park"];way(around:${radius},${lat},${lon})["leisure"="park"];`;
    } else if (type === 'library') {
      queryParts += `node(around:${radius},${lat},${lon})["amenity"="library"];way(around:${radius},${lat},${lon})["amenity"="library"];`;
    } else if (type === 'hospital') {
      queryParts += `node(around:${radius},${lat},${lon})["amenity"~"hospital|clinic"];way(around:${radius},${lat},${lon})["amenity"~"hospital|clinic"];`;
    } else if (type === 'bakery') {
      queryParts += `node(around:${radius},${lat},${lon})["shop"="bakery"];way(around:${radius},${lat},${lon})["shop"="bakery"];`;
    } else if (type === 'gym') {
      queryParts += `node(around:${radius},${lat},${lon})["leisure"="fitness_centre"];way(around:${radius},${lat},${lon})["leisure"="fitness_centre"];node(around:${radius},${lat},${lon})["amenity"="gym"];way(around:${radius},${lat},${lon})["amenity"="gym"];`;
    } else if (type === 'post_office') {
      queryParts += `node(around:${radius},${lat},${lon})["amenity"="post_office"];way(around:${radius},${lat},${lon})["amenity"="post_office"];`;
    } else if (type === 'school') {
      queryParts += `node(around:${radius},${lat},${lon})["amenity"~"school|college|university"];way(around:${radius},${lat},${lon})["amenity"~"school|college|university"];`;
    } else if (type === 'dentist') {
      queryParts += `node(around:${radius},${lat},${lon})["amenity"="dentist"];way(around:${radius},${lat},${lon})["amenity"="dentist"];`;
    } else if (type === 'veterinary') {
      queryParts += `node(around:${radius},${lat},${lon})["amenity"="veterinary"];way(around:${radius},${lat},${lon})["amenity"="veterinary"];`;
    } else if (type === 'hotel') {
      queryParts += `node(around:${radius},${lat},${lon})["tourism"~"hotel|motel"];way(around:${radius},${lat},${lon})["tourism"~"hotel|motel"];`;
    } else if (type === 'cinema') {
      queryParts += `node(around:${radius},${lat},${lon})["amenity"="cinema"];way(around:${radius},${lat},${lon})["amenity"="cinema"];`;
    } else if (type === 'museum') {
      queryParts += `node(around:${radius},${lat},${lon})["tourism"="museum"];way(around:${radius},${lat},${lon})["tourism"="museum"];`;
    } else if (type === 'hairdresser') {
      queryParts += `node(around:${radius},${lat},${lon})["shop"="hairdresser"];way(around:${radius},${lat},${lon})["shop"="hairdresser"];`;
    } else if (type === 'laundry') {
      queryParts += `node(around:${radius},${lat},${lon})["shop"~"laundry|dry_cleaning"];way(around:${radius},${lat},${lon})["shop"~"laundry|dry_cleaning"];`;
    }
  }

  // If no parts added, just return empty
  if (!queryParts) return '';

  return `[out:json][timeout:25];(${queryParts});out center;`;
}

export async function fetchOSMPlaces(intents: Intent[], lat: number, lon: number, radius: number = 15000): Promise<Place[]> {
  const query = buildOverpassQuery(intents, lat, lon, radius);
  if (!query) return [];

  const url = `https://overpass-api.de/api/interpreter`;
  const response = await fetch(url, {
    method: 'POST',
    body: query,
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('RATE_LIMITED');
    if (response.status === 504) throw new Error('TIMEOUT');
    throw new Error('OVERPASS_FAILED');
  }

  const data = await response.json();
  const places: Place[] = [];

  for (const element of data.elements) {
    const latNode = element.lat || element.center?.lat;
    const lonNode = element.lon || element.center?.lon;
    if (!latNode || !lonNode) continue;

    const tags = element.tags || {};
    const name = tags.name || tags['name:en'] || tags.brand || 'Unnamed Place';

    let matchedType = 'unknown';
    if (tags.amenity === 'atm') matchedType = 'atm';
    else if (tags.amenity === 'cafe') matchedType = 'cafe';
    else if (tags.amenity === 'bank') matchedType = 'bank';
    else if (tags.shop === 'supermarket' || tags.shop === 'grocery') matchedType = 'supermarket';
    else if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food') matchedType = 'restaurant';
    else if (tags.amenity === 'fuel') matchedType = 'fuel';
    else if (tags.amenity === 'pharmacy') matchedType = 'pharmacy';
    else if (tags.leisure === 'park') matchedType = 'park';
    else if (tags.amenity === 'library') matchedType = 'library';
    else if (tags.amenity === 'hospital' || tags.amenity === 'clinic') matchedType = 'hospital';
    else if (tags.shop === 'bakery') matchedType = 'bakery';
    else if (tags.leisure === 'fitness_centre' || tags.amenity === 'gym') matchedType = 'gym';
    else if (tags.amenity === 'post_office') matchedType = 'post_office';
    else if (tags.amenity === 'school' || tags.amenity === 'college' || tags.amenity === 'university') matchedType = 'school';
    else if (tags.amenity === 'dentist') matchedType = 'dentist';
    else if (tags.amenity === 'veterinary') matchedType = 'veterinary';
    else if (tags.tourism === 'hotel' || tags.tourism === 'motel') matchedType = 'hotel';
    else if (tags.amenity === 'cinema') matchedType = 'cinema';
    else if (tags.tourism === 'museum') matchedType = 'museum';
    else if (tags.shop === 'hairdresser') matchedType = 'hairdresser';
    else if (tags.shop === 'laundry' || tags.shop === 'dry_cleaning') matchedType = 'laundry';

    places.push({
      id: `${element.type}/${element.id}`,
      name,
      lat: latNode,
      lon: lonNode,
      type: matchedType,
      tags
    });
  }

  return places;
}
