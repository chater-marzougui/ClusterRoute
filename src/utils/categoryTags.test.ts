import { describe, it, expect } from 'vitest';
import { categoryTagFor } from './categoryTags';

describe('categoryTagFor', () => {
  it('maps generic category words to an osm_tag', () => {
    expect(categoryTagFor('bank')).toBe('amenity:bank');
    expect(categoryTagFor('supermarket')).toBe('shop:supermarket');
    expect(categoryTagFor('gas station')).toBe('amenity:fuel');
    expect(categoryTagFor('coffee')).toBe('amenity:cafe');
  });

  it('detects the category inside a longer phrase', () => {
    expect(categoryTagFor('TD bank')).toBe('amenity:bank');
    expect(categoryTagFor('Bank of Montreal')).toBe('amenity:bank');
  });

  it('returns null for brand or unknown names', () => {
    expect(categoryTagFor('Starbucks')).toBeNull();
    expect(categoryTagFor('Tim Hortons')).toBeNull();
    expect(categoryTagFor('zzz unicorn emporium')).toBeNull();
  });
});
