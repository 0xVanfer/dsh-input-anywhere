// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InputAnywhereControls } from '../src/client/InputAnywhereControls.tsx'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  IconRefreshOutline16: () => null,
}))

const rectangles = new WeakMap<Element, DOMRect>()

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
  rectangles.set(element, value)
}

class ResizeObserverStub {
  static readonly instances = new Set<ResizeObserverStub>()

  readonly observed = new Set<Element>()

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.add(this)
  }

  observe(target: Element): void {
    this.observed.add(target)
  }

  unobserve(target: Element): void {
    this.observed.delete(target)
  }

  disconnect(): void {
    this.observed.clear()
    ResizeObserverStub.instances.delete(this)
  }

  static trigger(target: Element): void {
    for (const observer of ResizeObserverStub.instances) {
      if (!observer.observed.has(target)) continue
      observer.callback([{ target } as ResizeObserverEntry], observer as unknown as ResizeObserver)
    }
  }
}

interface Fixture {
  readonly root: HTMLElement
  readonly scroller: HTMLElement
  readonly seat: HTMLElement
  readonly card: HTMLElement
  readonly scroll: HTMLElement
  readonly row: HTMLElement
  readonly trailing: HTMLElement
  readonly mount: HTMLElement
  readonly leftExtension: HTMLButtonElement
  readonly rightExtension: HTMLButtonElement
  readonly model: HTMLButtonElement
}

function createFixture(): Fixture {
  const root = document.createElement('main')
  root.dataset.phase = 'active'
  const scroller = document.createElement('section')
  scroller.dataset.conversationScroll = ''
  const seat = document.createElement('div')
  seat.dataset.composerSeat = ''
  const card = document.createElement('div')
  card.dataset.composerCard = ''
  const scroll = document.createElement('div')
  scroll.dataset.inputScroll = ''
  scroll.append(document.createElement('textarea'))
  const row = document.createElement('div')
  const tools = document.createElement('div')
  const leftExtension = document.createElement('button')
  leftExtension.textContent = 'Extension left'
  const mount = document.createElement('div')
  const trailing = document.createElement('div')
  const rightExtension = document.createElement('button')
  rightExtension.textContent = 'Extension right'
  rightExtension.setAttribute('aria-haspopup', 'menu')
  const model = document.createElement('button')
  model.textContent = 'Model'
  model.setAttribute('aria-haspopup', 'menu')
  const context = document.createElement('button')
  context.setAttribute('aria-haspopup', 'dialog')
  const send = document.createElement('button')
  send.setAttribute('aria-label', 'Send message')

  tools.append(leftExtension, mount)
  trailing.append(rightExtension, model, context, send)
  row.append(tools, trailing)
  card.append(scroll, row)
  seat.append(card)
  scroller.append(seat)
  root.append(scroller)
  document.body.append(root)

  setRect(root, rect(0, 0, 1000, 800))
  setRect(scroller, rect(0, 0, 1000, 800))
  setRect(seat, rect(100, 580, 800, 180))
  setRect(card, rect(200, 600, 600, 116))
  setRect(scroll, rect(200, 600, 600, 48))
  setRect(row, rect(200, 688, 600, 28))

  return {
    root,
    scroller,
    seat,
    card,
    scroll,
    row,
    trailing,
    mount,
    leftExtension,
    rightExtension,
    model,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  ResizeObserverStub.instances.clear()
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rectangles.get(this) ?? rect(0, 0, 0, 0)
  })
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      offsetLeft: 0,
      offsetTop: 0,
      width: 1000,
      height: 800,
    }),
  })
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: vi.fn(() => true),
  })
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  document.documentElement.className = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('InputAnywhereControls integration', () => {
  it('moves the whole native seat while preserving third-party contributors', async () => {
    const fixture = createFixture()
    const view = render(<InputAnywhereControls />, { container: fixture.mount })
    const move = view.getByRole('button', { name: 'Move input' })

    expect(fixture.trailing.hasAttribute('data-input-anywhere-trailing')).toBe(true)

    fireEvent.click(move)

    await waitFor(() => {
      expect(fixture.seat.hasAttribute('data-input-anywhere-floating')).toBe(true)
    })
    expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-x')).toBe('184px')
    expect(fixture.card.contains(fixture.leftExtension)).toBe(true)
    expect(fixture.card.contains(fixture.rightExtension)).toBe(true)
    expect(fixture.scroller.hasAttribute('data-input-anywhere-floating-host')).toBe(true)

    fireEvent.click(view.getByRole('button', { name: 'Reset input position' }))

    await waitFor(() => {
      expect(fixture.seat.hasAttribute('data-input-anywhere-floating')).toBe(false)
    })
    expect(fixture.card.contains(fixture.leftExtension)).toBe(true)
    expect(fixture.card.contains(fixture.rightExtension)).toBe(true)
  })

  it('marks the trailing region without claiming model or extension controls', () => {
    const fixture = createFixture()
    const view = render(<InputAnywhereControls />, { container: fixture.mount })
    const replacement = document.createElement('button')
    replacement.setAttribute('aria-haspopup', 'menu')
    replacement.textContent = 'Replacement model'
    const lateExtension = document.createElement('button')
    lateExtension.setAttribute('aria-haspopup', 'menu')
    lateExtension.textContent = 'Late extension menu'

    fixture.model.replaceWith(replacement)
    fixture.trailing.insertBefore(lateExtension, fixture.trailing.lastElementChild)

    expect(fixture.trailing.hasAttribute('data-input-anywhere-trailing')).toBe(true)
    expect(fixture.trailing.querySelectorAll('[aria-haspopup="menu"]').length).toBe(3)

    view.unmount()
    expect(fixture.trailing.hasAttribute('data-input-anywhere-trailing')).toBe(false)
  })

  it('observes extension rows added and resized after floating', async () => {
    const fixture = createFixture()
    const view = render(<InputAnywhereControls />, { container: fixture.mount })
    fireEvent.click(view.getByRole('button', { name: 'Move input' }))
    await waitFor(() => {
      expect(fixture.card.style.getPropertyValue('--dsh-input-anywhere-card-height')).toBe('116px')
    })

    const accessory = document.createElement('div')
    accessory.dataset.extensionAccessory = ''
    setRect(accessory, rect(200, 560, 600, 100))
    fixture.card.insertBefore(accessory, fixture.scroll)

    await waitFor(() => {
      expect(Array.from(ResizeObserverStub.instances).some(observer => observer.observed.has(accessory))).toBe(true)
      expect(fixture.card.style.getPropertyValue('--dsh-input-anywhere-card-height')).toBe('176px')
    })

    setRect(accessory, rect(200, 520, 600, 140))
    act(() => { ResizeObserverStub.trigger(accessory) })

    await waitFor(() => {
      expect(fixture.card.style.getPropertyValue('--dsh-input-anywhere-card-height')).toBe('216px')
    })
  })

  it('supports keyboard move, resize, and reset without removing extensions', async () => {
    const fixture = createFixture()
    const view = render(<InputAnywhereControls />, { container: fixture.mount })
    const move = view.getByRole('button', { name: 'Move input' })
    fireEvent.click(move)

    await waitFor(() => {
      expect(move.getAttribute('aria-pressed')).toBe('true')
    })
    fireEvent.keyDown(move, { key: 'ArrowRight' })
    await waitFor(() => {
      expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-x')).toBe('194px')
    })

    const southeast = screen.getByRole('button', { name: /Resize input from bottom-right corner/ })
    fireEvent.keyDown(southeast, { key: 'ArrowRight' })
    fireEvent.keyDown(southeast, { key: 'ArrowDown' })
    fireEvent.keyDown(southeast, { key: 'Enter' })
    await waitFor(() => {
      expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-width')).toBe('652px')
      expect(fixture.card.style.getPropertyValue('--dsh-input-anywhere-card-height')).toBe('136px')
      expect(southeast.getAttribute('aria-label')).toContain('652 by 136 pixels')
    })

    fireEvent.keyDown(move, { key: 'Escape' })
    await waitFor(() => {
      expect(fixture.seat.hasAttribute('data-input-anywhere-floating')).toBe(false)
    })
    expect(fixture.card.contains(fixture.rightExtension)).toBe(true)
  })

  it('releases pointer capture when Escape resets an active drag', () => {
    const fixture = createFixture()
    const view = render(<InputAnywhereControls />, { container: fixture.mount })
    const move = view.getByRole('button', { name: 'Move input' })
    const releasePointerCapture = vi.mocked(HTMLElement.prototype.releasePointerCapture)

    fireEvent.pointerDown(move, {
      button: 0,
      isPrimary: true,
      pointerId: 7,
      clientX: 240,
      clientY: 700,
    })
    fireEvent.keyDown(move, { key: 'Escape' })

    expect(releasePointerCapture).toHaveBeenCalledWith(7)
    expect(fixture.seat.hasAttribute('data-input-anywhere-floating')).toBe(false)
    view.unmount()
  })

  it('commits an animation-frame-pending pointer layout on pagehide', () => {
    const fixture = createFixture()
    const view = render(<InputAnywhereControls />, { container: fixture.mount })
    const move = view.getByRole('button', { name: 'Move input' })
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(41)
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame')

    fireEvent.pointerDown(move, {
      button: 0,
      buttons: 1,
      isPrimary: true,
      pointerId: 9,
      pointerType: 'mouse',
      clientX: 240,
      clientY: 700,
    })
    fireEvent.pointerMove(move, {
      buttons: 1,
      isPrimary: true,
      pointerId: 9,
      pointerType: 'mouse',
      clientX: 260,
      clientY: 700,
    })
    act(() => { window.dispatchEvent(new Event('pagehide')) })

    expect(requestFrame).toHaveBeenCalledOnce()
    expect(cancelFrame).toHaveBeenCalledWith(41)
    expect(JSON.parse(window.localStorage.getItem('dsh-input-anywhere:layout:v1') ?? '')).toMatchObject({
      layout: { mode: 'floating', x: 204 },
    })
  })

  it('flushes the latest keyboard layout on teardown and persists reset immediately', async () => {
    const fixture = createFixture()
    const view = render(<InputAnywhereControls />, { container: fixture.mount })
    const move = view.getByRole('button', { name: 'Move input' })
    fireEvent.click(move)
    fireEvent.keyDown(move, { key: 'ArrowRight' })
    view.unmount()

    expect(JSON.parse(window.localStorage.getItem('dsh-input-anywhere:layout:v1') ?? '')).toMatchObject({
      layout: { mode: 'floating', x: 194 },
    })

    document.body.replaceChildren()
    const resetFixture = createFixture()
    const resetView = render(<InputAnywhereControls />, { container: resetFixture.mount })
    fireEvent.click(resetView.getByRole('button', { name: 'Move input' }))
    fireEvent.click(resetView.getByRole('button', { name: 'Reset input position' }))

    expect(JSON.parse(window.localStorage.getItem('dsh-input-anywhere:layout:v1') ?? '')).toMatchObject({
      layout: { mode: 'docked' },
    })
  })

  it('recovers when composer markers appear after the control mounts', async () => {
    const isolated = document.createElement('div')
    document.body.append(isolated)
    const view = render(<InputAnywhereControls />, { container: isolated })
    const fixture = createFixture()
    fixture.mount.replaceWith(isolated)

    await waitFor(() => {
      expect(fixture.seat.classList.contains('dsh-input-anywhere-seat')).toBe(true)
      expect(fixture.trailing.hasAttribute('data-input-anywhere-trailing')).toBe(true)
    })

    fireEvent.click(view.getByRole('button', { name: 'Move input' }))
    await waitFor(() => {
      expect(fixture.seat.hasAttribute('data-input-anywhere-floating')).toBe(true)
    })
  })

  it('keeps native docking inside a transformed extension shell', () => {
    const fixture = createFixture()
    fixture.root.style.transform = 'translateX(0)'
    const view = render(<InputAnywhereControls />, { container: fixture.mount })

    fireEvent.click(view.getByRole('button', { name: 'Move input' }))

    expect(fixture.seat.hasAttribute('data-input-anywhere-floating')).toBe(false)
    expect(view.getByRole('button', { name: 'Move input' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('tolerates unavailable local storage during interaction and teardown', () => {
    const fixture = createFixture()
    const storage = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError')
    })
    const view = render(<InputAnywhereControls />, { container: fixture.mount })

    expect(() => {
      fireEvent.click(view.getByRole('button', { name: 'Move input' }))
      view.unmount()
    }).not.toThrow()
    expect(storage).toHaveBeenCalled()
  })

  it('fails closed when mounted outside a recognized composer', () => {
    const isolated = document.createElement('div')
    document.body.append(isolated)
    const view = render(<InputAnywhereControls />, { container: isolated })

    expect(view.getByRole('button', { name: 'Move input' })).toBeTruthy()
    expect(document.querySelector('[data-input-anywhere-floating]')).toBeNull()
    expect(document.documentElement.classList.contains('dsh-input-anywhere-interacting')).toBe(false)
  })
})
