import { describe, expect, it } from 'vitest';
import {
  defaultMeasure,
  measureBaseAmount,
  measureLabel,
  measureListName,
  measureName,
  measureRowLabel,
  measureRowUnit,
  productMeasures,
  unitLabel,
} from './measures';
import { measure, withMeasures } from './measureFixtures';
import { t } from '../i18n';

const banana = withMeasures({ unit: '100g' }, measure('piece', 120, true), measure('package', 1000));
const milk = withMeasures({ unit: '100ml' }, measure('cup', 250));
const egg = { unit: 'pc' };
const tbsp = measure('tbsp', 25);

describe('productMeasures', () => {
  it('keeps the order sent by the server', () => {
    expect(productMeasures(banana).map(item => item.code)).toEqual(['piece', 'package', 'g']);
  });

  it('falls back to the base unit when the product has no measures yet', () => {
    expect(productMeasures({ unit: '100ml' })).toEqual([{ code: 'ml', base_amount: 1, default: true, names: null, max_amount: 5000 }]);
    expect(productMeasures(egg)).toEqual([{ code: 'piece', base_amount: 1, default: true, names: null, max_amount: 100 }]);
  });
});

describe('defaultMeasure', () => {
  it('picks the measure marked as default', () => {
    expect(defaultMeasure(banana).code).toBe('piece');
    expect(defaultMeasure(milk).code).toBe('ml');
  });

  it('picks the first measure when none is marked as default', () => {
    expect(defaultMeasure({ unit: '100g', measures: [{ ...tbsp, default: false }] }).code).toBe('tbsp');
  });
});

describe('measureName', () => {
  it('declines the name by the amount in Polish', () => {
    expect(measureName(tbsp.names, 1, 'pl')).toBe('łyżka');
    expect(measureName(tbsp.names, 3, 'pl')).toBe('łyżki');
    expect(measureName(tbsp.names, 5, 'pl')).toBe('łyżek');
    expect(measureName(tbsp.names, 0.5, 'pl')).toBe('łyżki');
  });

  it('uses English forms and falls back to another language', () => {
    expect(measureName(tbsp.names, 2, 'en')).toBe('tablespoons');
    expect(measureName({ pl: { one: 'garść' } }, 1, 'en')).toBe('garść');
    expect(measureName({ en: { one: 'handful' } }, 1, 'pl')).toBe('handful');
    expect(measureName({ pl: { many: 'garści' } }, 2, 'pl')).toBe('garści');
    expect(measureName({ pl: { one: 'garść' } }, 2, 'pl')).toBe('garść');
    expect(measureName({ pl: {} }, 2, 'pl')).toBeNull();
    expect(measureName(null, 1)).toBeNull();
  });
});

describe('measureListName', () => {
  it('uses the plural form for lists of measures', () => {
    expect(measureListName(tbsp.names, 'pl')).toBe('łyżki');
    expect(measureListName(tbsp.names, 'en')).toBe('tablespoons');
    expect(measureListName({ pl: { one: 'garść' } }, 'pl')).toBe('garść');
    expect(measureListName({ pl: {} }, 'pl')).toBeNull();
    expect(measureListName(undefined)).toBeNull();
  });
});

describe('labels', () => {
  it('names measures without names by their short unit', () => {
    expect(measureLabel({ code: 'piece', names: null }, 2)).toBe(t('units.szt'));
    expect(measureLabel({ code: 'package', names: null }, 2)).toBe(t('units.opak'));
    expect(measureLabel({ code: 'g', names: null }, 2)).toBe('g');
    expect(unitLabel('szt', 2)).toBe(t('units.szt'));
    expect(unitLabel('opak', 2)).toBe(t('units.opak'));
    expect(unitLabel('piece', 2, banana)).toBe('sztuki');
    expect(unitLabel('tbsp', 2, banana)).toBe('tbsp');
  });

  it('describes each amount row', () => {
    expect(measureRowLabel(banana, banana.measures[0])).toBe(t('amount.countOf', { name: 'sztuki' }));
    expect(measureRowLabel(banana, banana.measures[2])).toBe(t('amount.grams'));
    expect(measureRowLabel(egg, productMeasures(egg)[0])).toBe(t('amount.pieces'));
    expect(measureRowLabel(banana, { code: 'handful', base_amount: 30, max_amount: 10 })).toBe(t('amount.countOf', { name: 'handful' }));
    expect(measureRowUnit(banana, banana.measures[0], 2)).toBe(t('amount.measureOf', { name: 'sztuki', amount: '120 g' }));
    expect(measureRowUnit(milk, milk.measures[1], 1)).toBe(t('amount.measureOf', { name: 'szklanka', amount: '250 ml' }));
    expect(measureRowUnit(banana, banana.measures[2], 100)).toBe('g');
    expect(measureRowUnit(egg, productMeasures(egg)[0], 2)).toBe(t('units.szt'));
  });
});

describe('measureBaseAmount', () => {
  it('turns an amount of a measure into grams or milliliters', () => {
    expect(measureBaseAmount(banana, 'piece', 2)).toBe(240);
    expect(measureBaseAmount(milk, 'ml', 150)).toBe(150);
    expect(measureBaseAmount(milk, 'piece', 1)).toBeNull();
  });
});
