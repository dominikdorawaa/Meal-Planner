import { afterEach, describe, expect, it } from 'vitest'
import { canStartTabSwipe, swipeStep } from './tabSwipe'

const WIDTH = 400

function element(html: string) {
  document.body.innerHTML = html
  return document.getElementById('target')
}

function makeHorizontallyScrollable(node: HTMLElement) {
  Object.defineProperty(node, 'scrollWidth', { configurable: true, value: 800 })
  Object.defineProperty(node, 'clientWidth', { configurable: true, value: 400 })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('canStartTabSwipe', () => {
  it('allows a swipe that starts on regular content', () => {
    expect(canStartTabSwipe(element('<main><p id="target">text</p></main>'), 200, WIDTH)).toBe(true)
  })

  it('ignores swipes that start at the screen edges where the system back gesture lives', () => {
    const target = element('<p id="target">text</p>')

    expect(canStartTabSwipe(target, 10, WIDTH)).toBe(false)
    expect(canStartTabSwipe(target, 390, WIDTH)).toBe(false)
  })

  it('ignores swipes while a sheet or dialog is open', () => {
    const target = element('<p id="target">text</p><div data-scroll-lock></div>')

    expect(canStartTabSwipe(target, 200, WIDTH)).toBe(false)
  })

  it('ignores swipes that start in form controls', () => {
    expect(canStartTabSwipe(element('<input id="target" type="range">'), 200, WIDTH)).toBe(false)
    expect(canStartTabSwipe(element('<textarea id="target"></textarea>'), 200, WIDTH)).toBe(false)
    expect(canStartTabSwipe(element('<label><input id="target"></label>'), 200, WIDTH)).toBe(false)
  })

  it('ignores swipes that start inside a horizontally scrollable strip', () => {
    const target = element('<div id="strip" style="overflow-x: auto"><button id="target">day</button></div>')
    makeHorizontallyScrollable(document.getElementById('strip') as HTMLElement)

    expect(canStartTabSwipe(target, 200, WIDTH)).toBe(false)
  })

  it('allows swipes on a strip that has nothing to scroll', () => {
    const target = element('<div id="strip" style="overflow-x: auto"><button id="target">day</button></div>')

    expect(canStartTabSwipe(target, 200, WIDTH)).toBe(true)
  })

  it('ignores swipes without a target element', () => {
    expect(canStartTabSwipe(null, 200, WIDTH)).toBe(false)
  })
})

describe('swipeStep', () => {
  it('moves to the next tab after a clear swipe to the left', () => {
    expect(swipeStep(-80, 10)).toBe(1)
  })

  it('moves to the previous tab after a clear swipe to the right', () => {
    expect(swipeStep(80, -10)).toBe(-1)
  })

  it('ignores short or mostly vertical movements', () => {
    expect(swipeStep(-40, 0)).toBeNull()
    expect(swipeStep(-80, 60)).toBeNull()
  })
})
