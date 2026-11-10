import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Wordmark } from './Wordmark'

afterEach(cleanup)

describe('Wordmark', () => {
  it('reads as one word with the middle part in regular weight', () => {
    const { container } = render(<Wordmark />)
    const wordmark = container.firstElementChild!

    expect(wordmark.textContent).toBe('Calendories')
    expect(wordmark.className).toBe('font-headline font-extrabold tracking-tight')
    expect(wordmark.querySelector('.font-normal')?.textContent).toBe('end')
  })

  it('adds extra classes from the caller', () => {
    const { container } = render(<Wordmark className="text-primary" />)

    expect(container.firstElementChild!.className).toBe('font-headline font-extrabold tracking-tight text-primary')
  })
})
