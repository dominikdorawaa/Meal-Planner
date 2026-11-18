import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { DayBalanceCard } from './DayBalanceCard';

afterEach(cleanup);

const TARGETS = { target_kcal: 2000, target_protein: 100, target_fat: 60, target_carbs: 250 };
const DAY = { kcal: 1500, protein: 80, fat: 40, carbs: 200 };
const ITEM = { kcal: 465, protein: 32, fat: 0, carbs: 47 };

describe('DayBalanceCard', () => {
  it('starts folded with a short explanation', () => {
    render(<DayBalanceCard dayWithoutItem={DAY} item={ITEM} targets={TARGETS} />);

    const toggle = screen.getByRole('button', { name: t('dayBalance.title') });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText(t('dayBalance.subtitle'))).toBeTruthy();
    expect(screen.queryByTestId('balance-kcal')).toBeNull();
  });

  it('explains a change instead of adding when editing', () => {
    render(<DayBalanceCard dayWithoutItem={DAY} item={ITEM} targets={TARGETS} editing />);

    expect(screen.getByText(t('dayBalance.editSubtitle'))).toBeTruthy();
  });

  it('shows the day after adding with the added part and the day before on request', () => {
    render(<DayBalanceCard dayWithoutItem={DAY} item={ITEM} targets={TARGETS} />);
    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.title') }));

    expect(screen.queryByText(t('dayBalance.subtitle'))).toBeNull();
    expect(screen.getByRole('button', { name: t('dayBalance.after') }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('balance-kcal').textContent).toBe('1965');
    expect(screen.getByTestId('balance-protein').textContent).toBe('112');
    expect(screen.getByText('+465')).toBeTruthy();
    expect(screen.getByText('+32')).toBeTruthy();
    expect(screen.getByTestId('balance-protein').className).toContain('text-error');
    expect(screen.getByTestId('balance-kcal').className).not.toContain('text-error');
    expect(screen.getByTestId('balance-kcal-added').style.left).toBe('75%');
    expect(Number.parseFloat(screen.getByTestId('balance-kcal-added').style.width)).toBeCloseTo(23.25);
    expect(screen.getByTestId('balance-fat-added').style.width).toBe('0%');

    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.before') }));
    expect(screen.getByTestId('balance-kcal').textContent).toBe('1500');
    expect(screen.getByTestId('balance-protein').className).not.toContain('text-error');
    expect(screen.getByTestId('balance-kcal-added').style.width).toBe('0%');
  });

  it('can start unfolded', () => {
    render(<DayBalanceCard dayWithoutItem={DAY} item={ITEM} targets={TARGETS} defaultOpen />);

    expect(screen.getByTestId('balance-carbs').textContent).toBe('247');
  });
});
