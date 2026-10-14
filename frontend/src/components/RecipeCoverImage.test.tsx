import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RecipeCoverImage } from './RecipeCoverImage'
import { DEFAULT_RECIPE_IMAGE_URL } from '../lib/recipeImage'

afterEach(cleanup)

describe('RecipeCoverImage', () => {
  it('shows the default image when the recipe has no image', () => {
    render(<RecipeCoverImage recipe={{ name: 'Pasta Pesto', image_url: null }} alt="Pasta Pesto" />)

    expect(screen.getByRole('img', { name: 'Pasta Pesto' }).getAttribute('src')).toBe(DEFAULT_RECIPE_IMAGE_URL)
  })

  it('falls back to the default image when the custom image fails', () => {
    render(<RecipeCoverImage recipe={{ image_url: 'https://example.com/broken.jpg' }} alt="Salad" />)
    const image = screen.getByRole('img', { name: 'Salad' })
    expect(image.getAttribute('src')).toBe('https://example.com/broken.jpg')

    fireEvent.error(image)

    expect(screen.getByRole('img', { name: 'Salad' }).getAttribute('src')).toBe(DEFAULT_RECIPE_IMAGE_URL)
  })

  it('shows the placeholder icon when every image fails', () => {
    const { container } = render(<RecipeCoverImage recipe={{}} alt="Soup" className="cover" />)

    fireEvent.error(screen.getByRole('img', { name: 'Soup' }))

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.cover')?.textContent).toBe('restaurant')
  })
})
