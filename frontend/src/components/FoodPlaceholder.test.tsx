import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FoodPlaceholder } from './FoodPlaceholder'

describe('FoodPlaceholder', () => {
  it('shows the fruit sign for a product', () => {
    render(<FoodPlaceholder kind="product" />)
    const placeholder = screen.getByTestId('food-placeholder')
    expect(placeholder).toHaveAttribute('data-kind', 'product')
    expect(placeholder).toHaveTextContent('nutrition')
  })

  it('shows the bolt sign for a quick meal', () => {
    render(<FoodPlaceholder kind="manual" />)
    const placeholder = screen.getByTestId('food-placeholder')
    expect(placeholder).toHaveAttribute('data-kind', 'manual')
    expect(placeholder).toHaveTextContent('bolt')
  })

  it('uses the same quiet green look for both kinds, without orange', () => {
    const { container } = render(
      <>
        <FoodPlaceholder kind="product" className="w-12 h-12" iconClassName="text-[30px]" />
        <FoodPlaceholder kind="manual" className="w-12 h-12" iconClassName="text-[30px]" />
      </>,
    )
    const [product, manual] = screen.getAllByTestId('food-placeholder')
    expect(product.className).toBe(manual.className)
    expect(product.className).toContain('w-12')
    expect(product.querySelector('span')?.className).toContain('text-[30px]')
    expect(container.innerHTML).not.toContain('orange')
  })
})
