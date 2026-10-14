import { describe, expect, it } from 'vitest'
import { DEFAULT_RECIPE_IMAGE_URL, recipeImageCandidates } from './recipeImage'

describe('recipeImageCandidates', () => {
  it('points the default image at the bundled static file', () => {
    expect(DEFAULT_RECIPE_IMAGE_URL).toBe('/recipe-images/default.webp')
  })

  it('uses only the default image when the recipe has no image', () => {
    expect(recipeImageCandidates(undefined)).toEqual([DEFAULT_RECIPE_IMAGE_URL])
    expect(recipeImageCandidates(null)).toEqual([DEFAULT_RECIPE_IMAGE_URL])
    expect(recipeImageCandidates('   ')).toEqual([DEFAULT_RECIPE_IMAGE_URL])
  })

  it('tries the custom image first and falls back to the default image', () => {
    expect(recipeImageCandidates(' https://example.com/photo.jpg ')).toEqual([
      'https://example.com/photo.jpg',
      DEFAULT_RECIPE_IMAGE_URL,
    ])
  })

  it('does not repeat the default image', () => {
    expect(recipeImageCandidates(DEFAULT_RECIPE_IMAGE_URL)).toEqual([DEFAULT_RECIPE_IMAGE_URL])
  })
})
