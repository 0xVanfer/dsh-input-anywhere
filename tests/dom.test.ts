// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyFloatingStyles,
  clearFloatingStyles,
  findTrailingRegion,
  minimumCardHeight,
  visibleBounds,
  type ComposerTargets,
} from '../src/client/dom.ts'

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  }
}

function setRect(element: Element, value: DOMRect): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(value)
}

function targets(): ComposerTargets {
  const root = document.createElement('main')
  const scroller = document.createElement('section')
  const seat = document.createElement('div')
  const card = document.createElement('div')
  root.append(scroller)
  scroller.append(seat)
  seat.append(card)
  return { root, scroller, seat, card }
}

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('visible composer bounds', () => {
  it('uses the conversation and viewport intersection when it is usable', () => {
    const root = document.createElement('main')
    setRect(root, rect(200, 50, 900, 700))

    expect(visibleBounds(root, {
      offsetLeft: 0,
      offsetTop: 0,
      width: 1000,
      height: 800,
    })).toEqual({
      left: 200,
      top: 50,
      right: 1000,
      bottom: 750,
      width: 800,
      height: 700,
    })
  })

  it('falls back to the viewport when extensions leave a narrow conversation column', () => {
    const root = document.createElement('main')
    setRect(root, rect(780, 0, 220, 800))

    expect(visibleBounds(root, {
      offsetLeft: 0,
      offsetTop: 0,
      width: 1000,
      height: 800,
    })).toEqual({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
    })
  })

  it('falls back to the viewport when the conversation is vertically off-screen', () => {
    const root = document.createElement('main')
    setRect(root, rect(0, 900, 1000, 600))

    expect(visibleBounds(root, {
      offsetLeft: 0,
      offsetTop: 0,
      width: 1000,
      height: 800,
    })).toEqual({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
    })
  })
})

describe('extension-aware composer DOM', () => {
  it('includes normal-flow extension rows in the minimum card height', () => {
    const result = targets()
    result.card.style.paddingTop = '4px'
    result.card.style.paddingBottom = '4px'
    result.card.style.borderTopWidth = '1px'
    result.card.style.borderBottomWidth = '1px'
    result.card.style.rowGap = '6px'
    const nativeComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation(element => (
      element === result.card
        ? {
          paddingTop: '4px',
          paddingBottom: '4px',
          borderTopWidth: '1px',
          borderBottomWidth: '1px',
          rowGap: '6px',
        } as CSSStyleDeclaration
        : nativeComputedStyle(element)
    ))

    const scroll = document.createElement('div')
    scroll.dataset.inputScroll = ''
    const attachmentRail = document.createElement('div')
    const extensionAccessory = document.createElement('div')
    const toolbar = document.createElement('div')
    const overlay = document.createElement('div')
    overlay.style.position = 'absolute'
    result.card.append(overlay, attachmentRail, extensionAccessory, scroll, toolbar)

    setRect(attachmentRail, rect(0, 0, 500, 64))
    setRect(extensionAccessory, rect(0, 0, 500, 36))
    setRect(toolbar, rect(0, 0, 500, 28))
    setRect(overlay, rect(0, 0, 500, 100))

    // 128px rows + 8px padding + 2px border + 18px gaps + 48px input.
    expect(minimumCardHeight(result)).toBe(204)
  })

  it('finds the trailing branch after third-party right-side contributors', () => {
    const card = document.createElement('div')
    const row = document.createElement('div')
    const tools = document.createElement('div')
    const slotCell = document.createElement('div')
    const controls = document.createElement('div')
    const trailing = document.createElement('div')
    const rightExtension = document.createElement('button')
    const model = document.createElement('button')
    const context = document.createElement('button')
    const send = document.createElement('button')

    rightExtension.setAttribute('aria-haspopup', 'menu')
    model.setAttribute('aria-haspopup', 'menu')
    context.setAttribute('aria-haspopup', 'dialog')
    slotCell.append(controls)
    tools.append(slotCell)
    trailing.append(rightExtension, model, context, send)
    row.append(tools, trailing)
    card.append(row)

    expect(findTrailingRegion(card, controls)).toBe(trailing)
  })

  it('returns null when a custom composer has no separate trailing branch', () => {
    const card = document.createElement('div')
    const row = document.createElement('div')
    const tools = document.createElement('div')
    const controls = document.createElement('div')
    tools.append(controls)
    row.append(tools)
    card.append(row)

    expect(findTrailingRegion(card, controls)).toBeNull()
  })
})

describe('floating style ownership', () => {
  it('bridges translucent card, dock, and menu surfaces without changing opacity', () => {
    const result = targets()
    result.card.style.setProperty('--dsw-specific-input-major', 'hsl(220, 20%, 20%)')
    result.card.style.setProperty('--dsw-alias-bg-layer-1', 'hsla(220, 20%, 20%, 0.42)')
    result.card.style.setProperty('--dsw-alias-bg-layer-2', 'hsla(220, 20%, 24%, 0.48)')

    applyFloatingStyles(result, {
      mode: 'floating',
      x: 120,
      y: 80,
      width: 640,
      height: 180,
    })

    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
      .toBe('var(--dsw-alias-bg-layer-1)')
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-menu-surface'))
      .toBe('var(--dsw-alias-bg-layer-2)')
    expect(result.seat.hasAttribute('data-input-anywhere-themed')).toBe(true)
    expect(result.card.style.opacity).toBe('')

    clearFloatingStyles(result)
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-surface')).toBe('')
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-menu-surface')).toBe('')
    expect(result.seat.hasAttribute('data-input-anywhere-themed')).toBe(false)
  })

  it('falls back to a translucent main surface when the card surface is opaque', () => {
    const result = targets()
    result.card.style.setProperty('--dsw-alias-bg-layer-1', 'hsl(220 20% 20%)')
    result.card.style.setProperty('--dsw-alias-bg-base', 'rgb(20 30 40 / 35%)')

    applyFloatingStyles(result, {
      mode: 'floating',
      x: 120,
      y: 80,
      width: 640,
      height: 180,
    })

    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
      .toBe('var(--dsw-alias-bg-base)')
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-menu-surface'))
      .toBe('var(--dsw-alias-bg-base)')
  })

  it('retains the native composer surface for opaque themes', () => {
    const result = targets()
    result.card.style.setProperty('--dsw-alias-bg-layer-1', '#112233')
    result.card.style.setProperty('--dsw-alias-bg-base', 'rgb(20, 30, 40)')

    applyFloatingStyles(result, {
      mode: 'floating',
      x: 120,
      y: 80,
      width: 640,
      height: 180,
    })

    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-surface')).toBe('')
    expect(result.seat.hasAttribute('data-input-anywhere-themed')).toBe(false)
  })

  it('applies and removes only plugin-owned markers and properties', () => {
    const result = targets()
    result.card.dataset.extensionOwned = 'keep'
    result.seat.style.setProperty('--dsw-specific-tip', 'rgb(1, 2, 3)')

    applyFloatingStyles(result, {
      mode: 'floating',
      x: 120,
      y: 80,
      width: 640,
      height: 180,
    })

    expect(result.seat.hasAttribute('data-input-anywhere-floating')).toBe(true)
    expect(result.scroller.hasAttribute('data-input-anywhere-floating-host')).toBe(true)
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-width')).toBe('640px')
    expect(result.card.style.getPropertyValue('--dsh-input-anywhere-card-height')).toBe('180px')

    clearFloatingStyles(result)

    expect(result.seat.hasAttribute('data-input-anywhere-floating')).toBe(false)
    expect(result.scroller.hasAttribute('data-input-anywhere-floating-host')).toBe(false)
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-width')).toBe('')
    expect(result.card.style.getPropertyValue('--dsh-input-anywhere-card-height')).toBe('')
    expect(result.seat.style.getPropertyValue('--dsw-specific-tip')).toBe('rgb(1, 2, 3)')
    expect(result.card.dataset.extensionOwned).toBe('keep')
  })
})
