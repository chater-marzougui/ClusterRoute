import { describe, it, expect } from 'vitest';
import { haversineDistance } from './haversine';

describe('haversineDistance', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineDistance(48.85, 2.35, 48.85, 2.35)).toBeCloseTo(0, 5);
  });

  it('returns a positive distance for different points', () => {
    expect(haversineDistance(48.85, 2.35, 48.86, 2.36)).toBeGreaterThan(0);
  });
});
