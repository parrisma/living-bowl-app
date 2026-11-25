import { describe, expect, it } from '@jest/globals';
import { getRandomNumber } from './random-number';

describe('getRandomNumber', () => {
  it('returns 1 when the random source returns 0', () => {
    expect(getRandomNumber(() => 0)).toBe(1);
  });

  it('returns 100 when the random source returns a value just below 1', () => {
    expect(getRandomNumber(() => 0.99999)).toBe(100);
  });
});
