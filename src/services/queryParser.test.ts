import { describe, it, expect } from 'vitest';
import { splitQueryLocal } from './queryParser';

describe('splitQueryLocal', () => {
  it('splits on commas', () => {
    expect(splitQueryLocal('TD bank, Starbucks, pharmacy')).toEqual([
      'TD bank', 'Starbucks', 'pharmacy',
    ]);
  });

  it('splits on "and", "then", semicolons and ampersands', () => {
    expect(splitQueryLocal('coffee then bank; gas & pharmacy')).toEqual([
      'coffee', 'bank', 'gas', 'pharmacy',
    ]);
  });

  it('trims whitespace and drops empty segments', () => {
    expect(splitQueryLocal('  cafe ,, , bank  ')).toEqual(['cafe', 'bank']);
  });

  it('returns an empty array for blank input', () => {
    expect(splitQueryLocal('   ')).toEqual([]);
  });
});
