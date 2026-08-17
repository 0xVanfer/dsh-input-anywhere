// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFERENCES } from '../src/preferences-contract.ts'
import {
  applyFloatingStyles,
  clearFloatingStyles,
  findTrailingRegion,
  minimumCardHeight,
  overlapsChatOutput,
  syncFloatingAppearance,
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

const TEST_APPEARANCE = {
  preferences: { ...DEFAULT_PREFERENCES, overlapAware: false, controlsMode: 'opaque' as const },
  inputActive: false,
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
    attachmentRail.style.marginTop = '5px'
    attachmentRail.style.marginBottom = '7px'
    extensionAccessory.style.marginTop = '3px'
    extensionAccessory.style.marginBottom = '4px'
    const overlay = document.createElement('div')
    overlay.style.position = 'absolute'
    result.card.append(overlay, attachmentRail, extensionAccessory, scroll, toolbar)

    setRect(attachmentRail, rect(0, 0, 500, 64))
    setRect(extensionAccessory, rect(0, 0, 500, 36))
    setRect(toolbar, rect(0, 0, 500, 28))
    setRect(overlay, rect(0, 0, 500, 100))

    // 128px rows + 19px margins + 8px padding + 2px border + 18px gaps + 48px input.
    expect(minimumCardHeight(result)).toBe(223)
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

describe('output overlap geometry', () => {
  it('requires positive visible overlap with a current chat flow', () => {
    const result = targets()
    const flow = document.createElement('div')
    flow.dataset.chatFlow = ''
    result.scroller.prepend(flow)
    setRect(result.root, rect(0, 0, 1000, 800))
    setRect(result.seat, rect(200, 200, 400, 180))
    setRect(flow, rect(100, 100, 700, 500))
    expect(overlapsChatOutput(result)).toBe(true)

    setRect(flow, rect(100, 20, 700, 180))
    expect(overlapsChatOutput(result)).toBe(false)

    setRect(flow, rect(100, 100, 700, 500))
    flow.style.display = 'none'
    expect(overlapsChatOutput(result)).toBe(false)
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
    }, TEST_APPEARANCE)

    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
      .toBe('hsla(220, 20%, 20%, 0.42)')
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-menu-surface'))
      .toBe('hsla(220, 20%, 24%, 0.48)')
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
    }, TEST_APPEARANCE)

    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
      .toBe('rgb(20 30 40 / 0.35)')
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-menu-surface'))
      .toBe('rgb(20 30 40 / 0.35)')
  })

  it('keeps the followed surface while idle and uses input-active alpha when covered', () => {
    const result = targets()
    const flow = document.createElement('div')
    flow.dataset.chatFlow = ''
    result.scroller.prepend(flow)
    setRect(result.root, rect(0, 0, 1000, 800))
    setRect(result.seat, rect(200, 200, 400, 180))
    setRect(flow, rect(100, 100, 700, 500))
    result.card.style.setProperty('--dsw-alias-bg-layer-1', 'rgba(10, 20, 30, 0.3)')
    result.card.style.setProperty('--dsw-alias-bg-layer-2', 'rgba(40, 50, 60, 0.4)')

    syncFloatingAppearance(result, { preferences: { ...DEFAULT_PREFERENCES }, inputActive: false })
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
      .toBe('rgba(10, 20, 30, 0.3)')
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-controls-opacity')).toBe('0.3')

    syncFloatingAppearance(result, { preferences: { ...DEFAULT_PREFERENCES }, inputActive: true })
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
      .toBe('rgba(10, 20, 30, 0.92)')
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-controls-opacity')).toBe('0.92')
  })

  it('supports custom and opaque surface/control strategies outside overlap', () => {
    const result = targets()
    setRect(result.root, rect(0, 0, 1000, 800))
    setRect(result.seat, rect(200, 200, 400, 180))
    result.card.style.setProperty('--dsw-alias-bg-layer-1', '#102030')
    result.card.style.setProperty('--dsw-alias-bg-layer-2', '#304050')

    syncFloatingAppearance(result, {
      preferences: {
        ...DEFAULT_PREFERENCES,
        overlapAware: false,
        surfaceMode: 'custom',
        surfaceOpacity: 0.7,
        controlsMode: 'custom',
        controlsOpacity: 0.8,
      },
      inputActive: false,
    })
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
      .toBe('rgb(16 32 48 / 0.7)')
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-menu-surface'))
      .toBe('rgb(48 64 80 / 0.7)')
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-controls-opacity')).toBe('0.8')

    syncFloatingAppearance(result, {
      preferences: {
        ...DEFAULT_PREFERENCES,
        overlapAware: false,
        surfaceMode: 'opaque',
        controlsMode: 'opaque',
      },
      inputActive: false,
    })
    expect(result.seat.hasAttribute('data-input-anywhere-themed')).toBe(false)
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-surface')).toBe('')
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-controls-opacity')).toBe('1')
  })

  it('rewrites modern theme colors without discarding custom alpha', () => {
    const result = targets()
    setRect(result.root, rect(0, 0, 1000, 800))
    setRect(result.seat, rect(200, 200, 400, 180))
    result.card.style.setProperty('--dsw-alias-bg-layer-1', 'oklch(62% 0.12 250 / 0.4)')
    result.card.style.setProperty('--dsw-alias-bg-layer-2', 'color(display-p3 0.2 0.3 0.4 / 0.5)')

    syncFloatingAppearance(result, {
      preferences: {
        ...DEFAULT_PREFERENCES,
        overlapAware: false,
        surfaceMode: 'custom',
        surfaceOpacity: 0.7,
      },
      inputActive: false,
    })
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
      .toBe('oklch(62% 0.12 250 / 0.7)')
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-menu-surface'))
      .toBe('color(display-p3 0.2 0.3 0.4 / 0.7)')
  })

  it('skips a fully transparent layer when custom alpha needs a color tint', () => {
    const result = targets()
    setRect(result.root, rect(0, 0, 1000, 800))
    setRect(result.seat, rect(200, 200, 400, 180))
    result.card.style.setProperty('--dsw-alias-bg-layer-1', 'transparent')
    result.card.style.setProperty('--dsw-alias-bg-base', 'rebeccapurple')

    syncFloatingAppearance(result, {
      preferences: {
        ...DEFAULT_PREFERENCES,
        overlapAware: false,
        surfaceMode: 'custom',
        surfaceOpacity: 0.6,
      },
      inputActive: false,
    })
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
      .toBe('color-mix(in srgb, rebeccapurple 60%, transparent)')
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
    }, TEST_APPEARANCE)

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
    }, TEST_APPEARANCE)

    expect(result.seat.hasAttribute('data-input-anywhere-floating')).toBe(true)
    expect(result.scroller.hasAttribute('data-input-anywhere-floating-host')).toBe(true)
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-width')).toBe('640px')
    expect(result.card.style.getPropertyValue('--dsh-input-anywhere-card-height')).toBe('180px')

    clearFloatingStyles(result)

    expect(result.seat.hasAttribute('data-input-anywhere-floating')).toBe(false)
    expect(result.scroller.hasAttribute('data-input-anywhere-floating-host')).toBe(false)
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-width')).toBe('')
    expect(result.seat.style.getPropertyValue('--dsh-input-anywhere-controls-opacity')).toBe('')
    expect(result.card.style.getPropertyValue('--dsh-input-anywhere-card-height')).toBe('')
    expect(result.seat.style.getPropertyValue('--dsw-specific-tip')).toBe('rgb(1, 2, 3)')
    expect(result.card.dataset.extensionOwned).toBe('keep')
  })
})
