import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RecipeCoverImage } from './RecipeCoverImage'
import { DEFAULT_RECIPE_IMAGE_URLS, newRecipeImage } from '../lib/recipeImage'

const photo = (url: string) => newRecipeImage(url)

afterEach(cleanup)

function expectDefaultImages(name: string) {
  const [light, dark] = screen.getAllByRole('img', { name })
  expect(light.getAttribute('src')).toBe(DEFAULT_RECIPE_IMAGE_URLS.light)
  expect(light.className).toContain('dark:hidden')
  expect(dark.getAttribute('src')).toBe(DEFAULT_RECIPE_IMAGE_URLS.dark)
  expect(dark.className).toContain('hidden dark:block')
}

describe('RecipeCoverImage', () => {
  it('shows the default image for the light and dark theme when the recipe has no image', () => {
    render(<RecipeCoverImage image={null} alt="Pasta Pesto" />)

    expectDefaultImages('Pasta Pesto')
  })

  it('keeps the image class on the default images', () => {
    render(<RecipeCoverImage image={null} alt="Soup" imgClassName="cover-image" />)

    screen.getAllByRole('img', { name: 'Soup' }).forEach((image) => expect(image.className).toContain('cover-image'))
  })

  it('falls back to the default images when the custom image fails', () => {
    render(<RecipeCoverImage image={photo('https://example.com/broken.jpg')} alt="Salad" />)
    const image = screen.getByRole('img', { name: 'Salad' })
    expect(image.getAttribute('src')).toBe('https://example.com/broken.jpg')

    fireEvent.error(image)

    expectDefaultImages('Salad')
  })

  it('keeps the working default image when only the other theme image fails', () => {
    const { container } = render(<RecipeCoverImage image={null} alt="Soup" className="cover" />)

    fireEvent.error(screen.getAllByRole('img', { name: 'Soup' })[1])

    const light = screen.getByRole('img', { name: 'Soup' })
    expect(light.getAttribute('src')).toBe(DEFAULT_RECIPE_IMAGE_URLS.light)
    expect(light.className).toContain('dark:hidden')
    const placeholder = container.querySelector('.cover')
    expect(placeholder?.textContent).toBe('restaurant')
    expect(placeholder?.className).toContain('hidden dark:flex')
  })

  it('shows the placeholder icon for both themes when both default images fail', () => {
    const { container } = render(<RecipeCoverImage image={null} alt="Soup" className="cover" />)
    const [light, dark] = screen.getAllByRole('img', { name: 'Soup' })

    fireEvent.error(light)
    fireEvent.error(dark)

    expect(screen.queryByRole('img')).toBeNull()
    const placeholders = [...container.querySelectorAll('.cover')]
    expect(placeholders.map((placeholder) => placeholder.textContent)).toEqual(['restaurant', 'restaurant'])
    expect(placeholders[0].className).toContain('flex dark:hidden')
    expect(placeholders[1].className).toContain('hidden dark:flex')
  })

  it('tries the new image again after the recipe image changes', () => {
    const { rerender } = render(<RecipeCoverImage image={photo('https://example.com/old.jpg')} alt="Stew" />)
    fireEvent.error(screen.getByRole('img', { name: 'Stew' }))

    rerender(<RecipeCoverImage image={photo('https://example.com/new.jpg')} alt="Stew" />)

    expect(screen.getByRole('img', { name: 'Stew' }).getAttribute('src')).toBe('https://example.com/new.jpg')
  })

  it('shows the custom image in its framing', () => {
    render(<RecipeCoverImage image={{ url: ' https://example.com/photo.jpg ', focus_x: 20, focus_y: 75 }} alt="Pie" />)
    const image = screen.getByRole('img', { name: 'Pie' })

    expect(image.getAttribute('src')).toBe('https://example.com/photo.jpg')
    expect(image.style.objectPosition).toBe('20% 75%')
  })
})
