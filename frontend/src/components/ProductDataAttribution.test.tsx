import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../i18n';
import { ODBL_URL, OPEN_FOOD_FACTS_URL, ProductDataAttribution } from './ProductDataAttribution';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('ProductDataAttribution', () => {
  it('credits Open Food Facts and links its licence', () => {
    render(<ProductDataAttribution />);

    expect(screen.getByText(/Dane produktów:/)).toBeTruthy();
    const source = screen.getByRole('link', { name: 'Open Food Facts' });
    const licence = screen.getByRole('link', { name: 'ODbL' });
    expect(source.getAttribute('href')).toBe(OPEN_FOOD_FACTS_URL);
    expect(licence.getAttribute('href')).toBe(ODBL_URL);
    expect(source.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('uses the chosen language', () => {
    setLanguage('en');
    render(<ProductDataAttribution />);

    expect(screen.getByText(/Product data:/)).toBeTruthy();
  });
});
