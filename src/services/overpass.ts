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
    }
  }

  // If no parts added, just return empty
  if (!queryParts) return '';

  return `[out:json][timeout:25];(${queryParts});out center;`;
}

export async function fetchOSMPlaces(intents: Intent[], lat: number, lon: number): Promise<Place[]> {
  const query = buildOverpassQuery(intents, lat, lon);
  if (!query) return [];

  const url = `https://overpass-api.de/api/interpreter`;
  const response = await fetch(url, {
    method: 'POST',
    body: query,
  });

  if (!response.ok) {
    throw new Error('Overpass API failed');
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
