import { describe, expect, it } from 'vitest'
import { customRecipeImageUrl, DEFAULT_RECIPE_IMAGE_URLS } from './recipeImage'

describe('recipeImage', () => {
  it('points the default images for both themes at bundled static files', () => {
    expect(DEFAULT_RECIPE_IMAGE_URLS).toEqual({
      light: '/recipe-images/default-light.svg',
      dark: '/recipe-images/default-dark.svg',
    })
  })

  it('has no custom image when the recipe image is missing or blank', () => {
    expect(customRecipeImageUrl(undefined)).toBeNull()
    expect(customRecipeImageUrl(null)).toBeNull()
    expect(customRecipeImageUrl('   ')).toBeNull()
  })

  it('trims the custom image url', () => {
    expect(customRecipeImageUrl(' https://example.com/photo.jpg ')).toBe('https://example.com/photo.jpg')
  })
})
