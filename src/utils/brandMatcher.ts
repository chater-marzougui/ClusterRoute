import { Place } from '../types';

export function matchBrand(place: Place, brand: string): boolean {
  if (!brand) return true;
  const brandLower = brand.toLowerCase();
  
  // Tags to check for brand match
  const checkTags = ['brand', 'brand:en', 'name', 'name:en', 'operator'];
  for (const tag of checkTags) {
    if (place.tags[tag] && place.tags[tag].toLowerCase().includes(brandLower)) {
      return true;
    }
  }
  return false;
}
