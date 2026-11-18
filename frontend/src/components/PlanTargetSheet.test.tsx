import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { addDaysToIsoDate, todayIsoDate } from '../lib/planDates';
import { fullDayLabel, shortDayLabel, weekStartOf } from '../lib/planTarget';
import { PlanTargetSheet } from './PlanTargetSheet';

afterEach(cleanup);

const MEALS = [
  { id: 'breakfast', name: 'Śniadanie', color: '#f2b84b' },
  { id: 'dinner', name: 'Obiad', color: '#a78bfa' },
];
const ITEM = { kcal: 465, protein: 32, fat: 17, carbs: 47 };
const TARGETS = { target_kcal: 2000, target_protein: 100, target_fat: 60, target_carbs: 250 };

function renderSheet(overrides: Partial<Parameters<typeof PlanTargetSheet>[0]> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const consumedForDay = vi.fn((date: string) => ({ kcal: date === '2026-10-18' ? 1000 : 0, protein: 0, fat: 0, carbs: 0 }));
  render(
    <PlanTargetSheet
      mode="set"
      title="Owsianka"
      date="2026-10-17"
      mealType="breakfast"
      meals={MEALS}
      item={ITEM}
      targets={TARGETS}
      consumedForDay={consumedForDay}
      onConfirm={onConfirm}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onConfirm, onClose, consumedForDay };
}

describe('PlanTargetSheet', () => {
  it('shows the week of the chosen day with fill bars and sets the picked day and meal', () => {
    const { onConfirm } = renderSheet();
    const sheet = within(screen.getByRole('dialog', { name: t('planTarget.whereTitle') }));

    expect(sheet.getByText('12 – 18 października')).toBeTruthy();
    expect(sheet.getByRole('button', { name: 'Sobota, 17.10' }).getAttribute('aria-pressed')).toBe('true');
    expect(sheet.getByRole('button', { name: 'Śniadanie' }).getAttribute('aria-pressed')).toBe('true');
    const sunday = sheet.getByRole('button', { name: 'Niedziela, 18.10' });
    expect((sunday.querySelector('[aria-hidden="true"] > span') as HTMLElement).style.width).toBe('50%');

    fireEvent.click(sunday);
    fireEvent.click(sheet.getByRole('button', { name: 'Obiad' }));
    fireEvent.click(sheet.getByRole('button', { name: t('planTarget.set', { meal: 'Obiad', day: 'nd 18.10' }) }));

    expect(onConfirm).toHaveBeenCalledWith('2026-10-18', 'dinner');
  });

  it('moves between weeks across months', () => {
    renderSheet();
    const sheet = within(screen.getByRole('dialog'));

    fireEvent.click(sheet.getByRole('button', { name: t('planTarget.nextWeek') }));
    fireEvent.click(sheet.getByRole('button', { name: t('planTarget.nextWeek') }));
    fireEvent.click(sheet.getByRole('button', { name: t('planTarget.nextWeek') }));
    expect(sheet.getByText('2 – 8 listopada')).toBeTruthy();
    fireEvent.click(sheet.getByRole('button', { name: t('planTarget.previousWeek') }));
    expect(sheet.getByText('26 października – 1 listopada')).toBeTruthy();
  });

  it('marks today and dims days that have passed', () => {
    const today = todayIsoDate();
    renderSheet({ date: today, targets: null });
    const sheet = within(screen.getByRole('dialog'));

    const todayButton = sheet.getByRole('button', { name: fullDayLabel(today) });
    expect(todayButton.textContent).toContain(t('recipeDetails.today'));
    const monday = weekStartOf(today);
    if (monday !== today) expect(sheet.getByRole('button', { name: fullDayLabel(monday) }).className).toContain('opacity-45');
    expect(sheet.queryByRole('button', { name: t('dayBalance.title') })).toBeNull();
  });

  it('adds with a thumbnail and waits for a meal to be chosen', () => {
    const today = todayIsoDate();
    const { onConfirm, consumedForDay } = renderSheet({
      mode: 'add',
      date: today,
      mealType: null,
      meta: '1 porcja · 465 kcal',
      leading: <span data-testid="thumb" />,
    });
    const sheet = within(screen.getByRole('dialog', { name: 'Owsianka' }));

    expect(sheet.getByTestId('thumb')).toBeTruthy();
    expect(sheet.getByText('1 porcja · 465 kcal')).toBeTruthy();
    expect((sheet.getByRole('button', { name: t('planTarget.chooseMeal') }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(sheet.getByRole('button', { name: t('dayBalance.title') }));
    expect(sheet.getByTestId('balance-kcal').textContent).toBe('465');
    expect(consumedForDay).toHaveBeenCalledWith(today);

    const tomorrow = addDaysToIsoDate(today, 1);
    fireEvent.click(sheet.getByRole('button', { name: t('planTarget.nextWeek') }));
    fireEvent.click(sheet.getByRole('button', { name: t('planTarget.previousWeek') }));
    fireEvent.click(sheet.getByRole('button', { name: fullDayLabel(tomorrow) }));
    fireEvent.click(sheet.getByRole('button', { name: 'Obiad' }));
    fireEvent.click(sheet.getByRole('button', { name: `${t('planTarget.addTo.dinner')}, ${shortDayLabel(tomorrow)}` }));

    expect(onConfirm).toHaveBeenCalledWith(tomorrow, 'dinner');
  });

  it('shows a spinner while adding', () => {
    renderSheet({ mode: 'add', busy: true });

    const button = screen.getByRole('dialog').querySelector('.sticky button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.animate-spin')).toBeTruthy();
  });

  it('closes with the close button and when tapping outside', () => {
    const { onClose } = renderSheet();

    fireEvent.click(screen.getByRole('button', { name: t('plan.summary.close') }));
    fireEvent.click(screen.getByRole('dialog').parentElement!);

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
