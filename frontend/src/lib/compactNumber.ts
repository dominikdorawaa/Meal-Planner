import { getLanguage, t } from '../i18n';

const THOUSAND = 1000;
const MILLION = 1_000_000;
const COMPACT_FROM = 10_000;

function shortened(value: number, divisor: number): string {
  const rounded = Math.round((value / divisor) * 10) / 10;
  return rounded.toLocaleString(getLanguage(), { maximumFractionDigits: 1 });
}

export function formatCompactNumber(value: number, decimals = 0): string {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  if (absolute < COMPACT_FROM) return sign + String(Number(absolute.toFixed(decimals)));
  if (Math.round((absolute / THOUSAND) * 10) / 10 < THOUSAND) {
    return sign + t('number.thousands', { value: shortened(absolute, THOUSAND) });
  }
  return sign + t('number.millions', { value: shortened(absolute, MILLION) });
}
