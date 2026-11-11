import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RECIPE_IMAGE_URLS,
  imagePosition,
  makeMainImage,
  moveFocus,
  newRecipeImage,
  nudgeFocus,
  recipeCoverImage,
  recipeImages,
} from './recipeImage'

describe('recipeImage', () => {
  it('points the default images for both themes at bundled static files', () => {
    expect(DEFAULT_RECIPE_IMAGE_URLS).toEqual({
      light: '/recipe-images/default-light.svg',
      dark: '/recipe-images/default-dark.svg',
    })
  })

  it('reads trimmed images with valid focus and skips blank ones', () => {
    expect(recipeImages({
      images: [
        { url: ' https://example.com/a.jpg ', focus_x: 120, focus_y: -3 },
        { url: '   ' },
        null,
        { url: 'https://example.com/b.jpg', focus_x: Number.NaN, focus_y: null },
      ],
    })).toEqual([
      { url: 'https://example.com/a.jpg', focus_x: 100, focus_y: 0 },
      { url: 'https://example.com/b.jpg', focus_x: 50, focus_y: 50 },
    ])
  })

  it('has no images or cover when the recipe has none', () => {
    expect(recipeImages(undefined)).toEqual([])
    expect(recipeImages({ images: null })).toEqual([])
    expect(recipeCoverImage(null)).toBeNull()
  })

  it('uses the first image as the cover', () => {
    expect(recipeCoverImage({ images: [{ url: 'https://example.com/a.jpg' }, { url: 'https://example.com/b.jpg' }] }))
      .toEqual(newRecipeImage('https://example.com/a.jpg'))
  })

  it('turns the focus into a css object position', () => {
    expect(imagePosition({ focus_x: 25, focus_y: 60 })).toBe('25% 60%')
  })

  it('moves the chosen image to the front and keeps the others in order', () => {
    expect(makeMainImage(['a', 'b', 'c'], 2)).toEqual(['c', 'a', 'b'])
    expect(makeMainImage(['a', 'b', 'c'], 1)).toEqual(['b', 'a', 'c'])
  })

  it('keeps the order when the image is already main or missing', () => {
    const images = ['a', 'b']
    expect(makeMainImage(images, 0)).toBe(images)
    expect(makeMainImage(images, 5)).toBe(images)
  })

  it('moves the focus against the drag along the axis the photo overflows', () => {
    const image = newRecipeImage('https://example.com/wide.jpg')
    const moved = moveFocus(image, { x: -40, y: 30 }, { width: 400, height: 300 }, { width: 1600, height: 900 })

    expect(moved.focus_x).toBeCloseTo(50 + (40 / (1600 * (300 / 900) - 400)) * 100, 1)
    expect(moved.focus_y).toBe(50)
  })

  it('stops the focus at the photo edges', () => {
    const image = { url: 'https://example.com/tall.jpg', focus_x: 50, focus_y: 90 }

    expect(moveFocus(image, { x: 0, y: -500 }, { width: 400, height: 300 }, { width: 900, height: 1600 }).focus_y).toBe(100)
  })

  it('keeps the focus when sizes are not known yet', () => {
    const image = newRecipeImage('https://example.com/a.jpg')

    expect(moveFocus(image, { x: 10, y: 10 }, { width: 0, height: 0 }, { width: 100, height: 100 })).toBe(image)
    expect(moveFocus(image, { x: 10, y: 10 }, { width: 400, height: 300 }, { width: 0, height: 0 })).toBe(image)
  })

  it('nudges the focus by a step within the edges', () => {
    expect(nudgeFocus({ url: 'u', focus_x: 98, focus_y: 50 }, { x: 5, y: -5 })).toEqual({ url: 'u', focus_x: 100, focus_y: 45 })
  })
})
