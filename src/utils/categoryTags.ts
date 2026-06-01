// Maps free-text category keywords to a Photon osm_tag filter (key:value).
//
// Used as a NON-BLOCKING enhancer: if a phrase contains one of these words we
// constrain the geocoder to that OSM category (so "bank" finds real banks, not
// places literally named "Bank"). If no keyword matches, the caller falls back
// to a plain free-text search — so brand names ("Starbucks", "Tim Hortons") and
// unknown terms still work. This is the key difference from the old Overpass
// pipeline, where an unmatched term returned nothing.

const CATEGORY_TAGS: { keywords: string[]; tag: string }[] = [
  { keywords: ['atm', 'cash machine'], tag: 'amenity:atm' },
  { keywords: ['coffee', 'cafe', 'café'], tag: 'amenity:cafe' },
  { keywords: ['bank'], tag: 'amenity:bank' },
  { keywords: ['supermarket', 'grocery', 'groceries'], tag: 'shop:supermarket' },
  { keywords: ['restaurant', 'diner'], tag: 'amenity:restaurant' },
  { keywords: ['gas', 'petrol', 'fuel'], tag: 'amenity:fuel' },
  { keywords: ['pharmacy', 'drugstore', 'chemist'], tag: 'amenity:pharmacy' },
  { keywords: ['playground', 'park'], tag: 'leisure:park' },
  { keywords: ['library'], tag: 'amenity:library' },
  { keywords: ['hospital', 'clinic'], tag: 'amenity:hospital' },
  { keywords: ['bakery', 'boulangerie'], tag: 'shop:bakery' },
  { keywords: ['gym', 'fitness'], tag: 'leisure:fitness_centre' },
  { keywords: ['post office', 'post'], tag: 'amenity:post_office' },
  { keywords: ['school', 'college', 'university'], tag: 'amenity:school' },
  { keywords: ['dentist', 'dental'], tag: 'amenity:dentist' },
  { keywords: ['veterinary', 'veterinarian'], tag: 'amenity:veterinary' },
  { keywords: ['hotel', 'motel'], tag: 'tourism:hotel' },
  { keywords: ['cinema', 'movie'], tag: 'amenity:cinema' },
  { keywords: ['museum'], tag: 'tourism:museum' },
  { keywords: ['hairdresser', 'barber', 'salon', 'haircut'], tag: 'shop:hairdresser' },
  { keywords: ['laundry', 'laundromat'], tag: 'shop:laundry' },
];

// Returns the matched osm_tag and the keyword that triggered it, or null when
// the phrase has no known category word. The caller strips `keyword` from the
// text query so a brand+category phrase like "TD bank" searches for "TD" within
// amenity:bank, instead of the literal text "TD bank" (which misses branches
// named "TD" or "TD Canada Trust").
export function categoryMatch(phrase: string): { tag: string; keyword: string } | null {
  const p = phrase.toLowerCase();
  for (const { keywords, tag } of CATEGORY_TAGS) {
    const keyword = keywords.find((k) => p.includes(k));
    if (keyword) return { tag, keyword };
  }
  return null;
}

// Convenience wrapper: just the osm_tag string (e.g. "amenity:bank"), or null.
export function categoryTagFor(phrase: string): string | null {
  return categoryMatch(phrase)?.tag ?? null;
}
