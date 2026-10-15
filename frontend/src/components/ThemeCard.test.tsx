import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeCard } from './ThemeCard'
import { t } from '../i18n'

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('ThemeCard', () => {
  it('shows all theme options with dark selected by default', () => {
    render(<ThemeCard />)

    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: new RegExp(t('theme.dark')) }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: new RegExp(t('theme.light')) }).getAttribute('aria-checked')).toBe('false')
  })

  it('switches the theme and remembers the choice', () => {
    document.documentElement.classList.add('dark')
    render(<ThemeCard />)

    fireEvent.click(screen.getByRole('radio', { name: new RegExp(t('theme.light')) }))

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('mp_theme')).toBe('light')
    expect(screen.getByRole('radio', { name: new RegExp(t('theme.light')) }).getAttribute('aria-checked')).toBe('true')
  })

  it('shows the stored preference', () => {
    localStorage.setItem('mp_theme', 'system')

    render(<ThemeCard />)

    expect(screen.getByRole('radio', { name: new RegExp(t('theme.system')) }).getAttribute('aria-checked')).toBe('true')
  })

  it('moves the selection with arrow keys and keeps only the selected option in the tab order', () => {
    render(<ThemeCard />)
    const group = screen.getByRole('radiogroup')
    const option = (label: 'theme.dark' | 'theme.light' | 'theme.system') =>
      screen.getByRole('radio', { name: new RegExp(t(label)) })

    expect(option('theme.dark').tabIndex).toBe(0)
    expect(option('theme.light').tabIndex).toBe(-1)

    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(option('theme.light').getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(option('theme.light'))
    expect(option('theme.light').tabIndex).toBe(0)
    expect(option('theme.dark').tabIndex).toBe(-1)

    fireEvent.keyDown(group, { key: 'ArrowDown' })
    expect(option('theme.system').getAttribute('aria-checked')).toBe('true')

    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(option('theme.dark').getAttribute('aria-checked')).toBe('true')

    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(option('theme.system').getAttribute('aria-checked')).toBe('true')

    fireEvent.keyDown(group, { key: 'ArrowUp' })
    expect(option('theme.light').getAttribute('aria-checked')).toBe('true')
    expect(localStorage.getItem('mp_theme')).toBe('light')

    fireEvent.keyDown(group, { key: 'Enter' })
    expect(option('theme.light').getAttribute('aria-checked')).toBe('true')
  })
})
