import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DayBalancePreview } from './DayBalancePreview'
import { t } from '../i18n'

afterEach(cleanup)

const targets = { target_kcal: 2000, target_protein: 100, target_fat: 60, target_carbs: 250 }
const dayWithoutItem = { kcal: 1500, protein: 80, fat: 50, carbs: 200 }
const item = { kcal: 600, protein: 30.4, fat: 5, carbs: 40 }

function renderPreview(editing = false) {
  return render(<DayBalancePreview dayLabel="17.10" dayWithoutItem={dayWithoutItem} item={item} targets={targets} editing={editing} />)
}

function openPreview() {
  fireEvent.click(screen.getByRole('button', { name: t('dayBalance.show') }))
}

describe('DayBalancePreview', () => {
  it('stays closed until opened and can be hidden again', () => {
    renderPreview()
    const toggle = screen.getByRole('button', { name: t('dayBalance.show') })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(t('dayBalance.afterTitle'))).toBeNull()

    openPreview()
    expect(screen.getByRole('button', { name: t('dayBalance.hide') }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('17.10')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.hide') }))
    expect(screen.queryByText(t('dayBalance.afterTitle'))).toBeNull()
  })

  it('shows the day with the item first and marks what goes over the target', () => {
    renderPreview()
    openPreview()

    expect(screen.getByText(t('dayBalance.afterTitle'))).toBeTruthy()
    expect(screen.getByRole('button', { name: t('dayBalance.after') }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('2100')).toBeTruthy()
    expect(screen.getByText('110')).toBeTruthy()
    expect(screen.getByText(t('plan.summary.over', { amount: '100 kcal' }))).toBeTruthy()
    expect(screen.getByTestId('kcal-overflow').style.width).not.toBe('0%')
  })

  it('shows the day without the item when switched to before', () => {
    renderPreview()
    openPreview()
    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.before') }))

    expect(screen.getByText(t('dayBalance.beforeTitle'))).toBeTruthy()
    expect(screen.getByText('1500')).toBeTruthy()
    expect(screen.getByText(t('plan.summary.missing', { amount: '300 kcal' }))).toBeTruthy()
  })

  it('names the balances after a change when editing a plan item', () => {
    renderPreview(true)
    openPreview()
    expect(screen.getByText(t('dayBalance.afterEditTitle'))).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.before') }))
    expect(screen.getByText(t('dayBalance.beforeEditTitle'))).toBeTruthy()
  })
})
