import { describe, expect, it } from 'vitest';
import { productDisplayName } from './productName';

describe('productDisplayName', () => {
  it('adds the brand in brackets', () => {
    expect(productDisplayName({ name: 'Śmietanka 18%', brand: 'Piątnica' })).toBe('Śmietanka 18% (Piątnica)');
  });

  it('shows only the name when there is no brand', () => {
    expect(productDisplayName({ name: 'Banan', brand: null })).toBe('Banan');
    expect(productDisplayName({ name: ' Banan ', brand: '  ' })).toBe('Banan');
  });

  it('does not repeat a brand that is already in the name', () => {
    expect(productDisplayName({ name: 'Danio od Danone', brand: 'danone' })).toBe('Danio od Danone');
  });

  it('falls back to the brand or an empty text', () => {
    expect(productDisplayName({ name: '', brand: 'Lidl' })).toBe('Lidl');
    expect(productDisplayName(null)).toBe('');
  });
});
