import { t } from '../i18n';

export const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org';
export const ODBL_URL = 'https://opendatacommons.org/licenses/odbl/1-0/';

export function ProductDataAttribution() {
  const linkClass = 'underline underline-offset-2 hover:text-primary transition-colors';
  return (
    <p className="text-center text-xs text-on-surface-variant/70 mb-8">
      {t('attribution.productData')}:{' '}
      <a href={OPEN_FOOD_FACTS_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
        Open Food Facts
      </a>{' '}
      (
      <a href={ODBL_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
        ODbL
      </a>
      )
    </p>
  );
}
