import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Wordmark } from './Wordmark'

afterEach(cleanup)

describe('Wordmark', () => {
  it('shows Cal and ories bold with a regular end in the middle', () => {
    const { container } = render(<Wordmark />)
    const visible = container.querySelector('[aria-hidden="true"]') as HTMLElement

    expect(visible.textContent).toBe('Calendories')
    expect(visible.parentElement?.className).toContain('font-extrabold')
    expect(visible.querySelector('.font-normal')?.textContent).toBe('end')
  })

  it('is read by screen readers as one word', () => {
    render(<h1><Wordmark /></h1>)

    expect(screen.getByRole('heading', { name: 'Calendories' })).toBeTruthy()
    expect(screen.getByText('Calendories', { selector: '.sr-only' })).toBeTruthy()
  })

  it('adds extra classes from the caller', () => {
    const { container } = render(<Wordmark className="text-primary" />)

    expect(container.firstElementChild!.className).toContain('text-primary')
  })
})
