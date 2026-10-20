import { afterEach, describe, expect, it } from 'vitest'
import { isTextEntry } from './textEntryFocus'

function create(html: string) {
  document.body.innerHTML = html
  return document.body.firstElementChild
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('isTextEntry', () => {
  it('treats fields that open the keyboard as text entry', () => {
    expect(isTextEntry(create('<input>'))).toBe(true)
    expect(isTextEntry(create('<input type="number">'))).toBe(true)
    expect(isTextEntry(create('<textarea></textarea>'))).toBe(true)
  })

  it('ignores controls that do not open the keyboard', () => {
    expect(isTextEntry(create('<input type="checkbox">'))).toBe(false)
    expect(isTextEntry(create('<input type="range">'))).toBe(false)
    expect(isTextEntry(create('<input readonly>'))).toBe(false)
    expect(isTextEntry(create('<textarea readonly></textarea>'))).toBe(false)
    expect(isTextEntry(create('<button>ok</button>'))).toBe(false)
    expect(isTextEntry(null)).toBe(false)
  })

  it('treats editable content as text entry', () => {
    const element = create('<div contenteditable="true"></div>') as HTMLElement
    Object.defineProperty(element, 'isContentEditable', { value: true })

    expect(isTextEntry(element)).toBe(true)
  })
})
