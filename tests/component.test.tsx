// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InputAnywhereControls } from '../src/client/InputAnywhereControls.tsx'
import { DEFAULT_PREFERENCES, type InputAnywherePreferences } from '../src/preferences-contract.ts'
import type { PreferenceSnapshot, PreferenceStore } from '../src/client/preferences.ts'

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

class ComponentPreferenceStore implements PreferenceStore {
  private listeners = new Set<() => void>()
  private snapshot: PreferenceSnapshot

  constructor(preferences: InputAnywherePreferences = { ...DEFAULT_PREFERENCES }) {
    this.snapshot = { preferences, status: 'ready', writable: true, persistence: 'host' }
  }

  getSnapshot = (): PreferenceSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async set<K extends keyof InputAnywherePreferences>(field: K, value: InputAnywherePreferences[K]): Promise<void> {
    this.update({ [field]: value })
  }

  async reset(): Promise<void> {
    this.snapshot = { ...this.snapshot, preferences: { ...DEFAULT_PREFERENCES } }
    this.publish()
  }

  update(patch: Partial<InputAnywherePreferences>): void {
    this.snapshot = {
      ...this.snapshot,
      preferences: { ...this.snapshot.preferences, ...patch },
    }
    this.publish()
  }

  private publish(): void {
    for (const listener of this.listeners) listener()
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
  document.body.removeAttribute('style')
  document.documentElement.className = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('InputAnywhereControls integration', () => {
  it('unmounts all floating behavior when the durable feature switch is disabled', async () => {
    const fixture = createFixture()
    const store = new ComponentPreferenceStore({ ...DEFAULT_PREFERENCES, enabled: false })
    const view = render(<InputAnywhereControls preferences={store} />, { container: fixture.mount })
    expect(view.queryByRole('button', { name: 'Move input' })).toBeNull()

    act(() => { store.update({ enabled: true }) })
    fireEvent.click(await view.findByRole('button', { name: 'Move input' }))
    expect(fixture.seat.hasAttribute('data-input-anywhere-floating')).toBe(true)

    act(() => { store.update({ enabled: false }) })
    await waitFor(() => {
      expect(view.queryByRole('button', { name: 'Move input' })).toBeNull()
      expect(fixture.seat.hasAttribute('data-input-anywhere-floating')).toBe(false)
      expect(fixture.scroller.hasAttribute('data-input-anywhere-floating-host')).toBe(false)
      expect(JSON.parse(window.localStorage.getItem('dsh-input-anywhere:layout:v1') ?? '{}'))
        .toMatchObject({ layout: { mode: 'docked' } })
    })

    act(() => { store.update({ enabled: true }) })
    const restoredMove = await view.findByRole('button', { name: 'Move input' })
    expect(restoredMove.getAttribute('aria-pressed')).toBe('false')
    expect(fixture.seat.hasAttribute('data-input-anywhere-floating')).toBe(false)
  })

  it('uses output overlap plus official draft or editor focus for adaptive alpha', async () => {
    const fixture = createFixture()
    const flow = document.createElement('div')
    flow.dataset.chatFlow = ''
    fixture.scroller.prepend(flow)
    setRect(flow, rect(0, 0, 1000, 700))
    fixture.card.style.setProperty('--dsw-alias-bg-layer-1', 'rgba(10, 20, 30, 0.3)')
    fixture.card.style.setProperty('--dsw-alias-bg-layer-2', 'rgba(40, 50, 60, 0.4)')
    const store = new ComponentPreferenceStore()
    const view = render(
      <InputAnywhereControls preferences={store} input={{ draft: '' }} />,
      { container: fixture.mount },
    )
    fireEvent.click(view.getByRole('button', { name: 'Move input' }))
    expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
      .toBe('rgba(10, 20, 30, 0.3)')
    expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-controls-opacity')).toBe('0.3')

    view.rerender(<InputAnywhereControls preferences={store} input={{ draft: 'working' }} />)
    expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
      .toBe('rgba(10, 20, 30, 0.92)')

    view.rerender(<InputAnywhereControls preferences={store} input={{ draft: '' }} />)
    const editor = fixture.card.querySelector('textarea')
    if (editor === null) throw new Error('fixture textarea missing')
    fireEvent.focusIn(editor)
    await waitFor(() => {
      expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
        .toBe('rgba(10, 20, 30, 0.92)')
    })
  })

  it('rebinds overlap measurement when chat flow is added or removed after floating', async () => {
    const fixture = createFixture()
    fixture.card.style.setProperty('--dsw-alias-bg-layer-1', 'rgba(10, 20, 30, 0.3)')
    fixture.card.style.setProperty('--dsw-alias-bg-layer-2', 'rgba(40, 50, 60, 0.4)')
    const store = new ComponentPreferenceStore()
    const view = render(
      <InputAnywhereControls preferences={store} input={{ draft: 'working' }} />,
      { container: fixture.mount },
    )
    fireEvent.click(view.getByRole('button', { name: 'Move input' }))
    expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
      .toBe('rgba(10, 20, 30, 0.3)')

    const flow = document.createElement('div')
    flow.dataset.chatFlow = ''
    setRect(flow, rect(0, 0, 1000, 700))
    fixture.scroller.prepend(flow)
    await waitFor(() => {
      expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
        .toBe('rgba(10, 20, 30, 0.92)')
      expect(Array.from(ResizeObserverStub.instances).some(observer => observer.observed.has(flow))).toBe(true)
    })

    flow.remove()
    await waitFor(() => {
      expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
        .toBe('rgba(10, 20, 30, 0.3)')
      expect(Array.from(ResizeObserverStub.instances).some(observer => observer.observed.has(flow))).toBe(false)
    })
  })

  it('coalesces geometry notifications into one animation frame', async () => {
    const fixture = createFixture()
    const view = render(<InputAnywhereControls />, { container: fixture.mount })
    fireEvent.click(view.getByRole('button', { name: 'Move input' }))
    await new Promise<void>(resolve => { window.requestAnimationFrame(() => { resolve() }) })

    const callbacks: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    fixture.scroller.dispatchEvent(new Event('scroll'))
    fixture.scroller.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('transitionend'))
    expect(callbacks).toHaveLength(1)

    act(() => { callbacks[0]?.(performance.now()) })
    expect(callbacks).toHaveLength(1)
  })

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

  it('re-clamps the complete seat when a dock panel appears after floating', async () => {
    const fixture = createFixture()
    const view = render(<InputAnywhereControls />, { container: fixture.mount })
    fireEvent.click(view.getByRole('button', { name: 'Move input' }))
    expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-y')).toBe('580px')

    const queuePanel = document.createElement('section')
    queuePanel.dataset.queueDock = ''
    fixture.seat.insertBefore(queuePanel, fixture.card)
    setRect(queuePanel, rect(100, 580, 800, 100))
    setRect(fixture.seat, rect(100, 480, 800, 280))
    act(() => { ResizeObserverStub.trigger(fixture.seat) })

    await waitFor(() => {
      expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-y')).toBe('512px')
      expect(fixture.seat.contains(queuePanel)).toBe(true)
    })
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

  it('releases pointer capture when the component unmounts during a drag', () => {
    const fixture = createFixture()
    const view = render(<InputAnywhereControls />, { container: fixture.mount })
    const move = view.getByRole('button', { name: 'Move input' })
    const releasePointerCapture = vi.mocked(HTMLElement.prototype.releasePointerCapture)

    fireEvent.pointerDown(move, {
      button: 0,
      isPrimary: true,
      pointerId: 12,
      clientX: 240,
      clientY: 700,
    })
    view.unmount()

    expect(releasePointerCapture).toHaveBeenCalledWith(12)
    expect(document.documentElement.classList.contains('dsh-input-anywhere-interacting')).toBe(false)
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

  it('rebinds when composer markers are added to existing ancestors', async () => {
    const fixture = createFixture()
    fixture.root.removeAttribute('data-phase')
    fixture.scroller.removeAttribute('data-conversation-scroll')
    fixture.seat.removeAttribute('data-composer-seat')
    fixture.card.removeAttribute('data-composer-card')
    const view = render(<InputAnywhereControls />, { container: fixture.mount })

    act(() => {
      fixture.root.dataset.phase = 'active'
      fixture.scroller.dataset.conversationScroll = ''
      fixture.seat.dataset.composerSeat = ''
      fixture.card.dataset.composerCard = ''
    })

    await waitFor(() => {
      expect(fixture.seat.classList.contains('dsh-input-anywhere-seat')).toBe(true)
      expect(fixture.trailing.hasAttribute('data-input-anywhere-trailing')).toBe(true)
    })
    view.unmount()
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

  it('tracks translucent surface tokens changed by an ancestor appearance extension', async () => {
    const fixture = createFixture()
    fixture.root.style.setProperty('--dsw-alias-bg-layer-1', '#112233')
    const view = render(<InputAnywhereControls />, { container: fixture.mount })
    fireEvent.click(view.getByRole('button', { name: 'Move input' }))

    expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-surface')).toBe('')

    act(() => {
      fixture.root.style.setProperty('--dsw-alias-bg-layer-1', 'hsla(220, 20%, 20%, 0.42)')
      fixture.root.style.setProperty('--dsw-alias-bg-layer-2', 'hsla(220, 20%, 24%, 0.48)')
    })
    await waitFor(() => {
      expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-surface'))
        .toBe('hsla(220, 20%, 20%, 0.42)')
      expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-menu-surface'))
        .toBe('hsla(220, 20%, 24%, 0.48)')
      expect(fixture.seat.hasAttribute('data-input-anywhere-themed')).toBe(true)
    })

    act(() => {
      fixture.root.style.setProperty('--dsw-alias-bg-layer-1', 'hsl(220, 20%, 20%)')
    })
    await waitFor(() => {
      expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-surface')).toBe('')
      expect(fixture.seat.style.getPropertyValue('--dsh-input-anywhere-menu-surface')).toBe('')
      expect(fixture.seat.hasAttribute('data-input-anywhere-themed')).toBe(false)
    })
  })

  it('returns to native docking when an appearance extension adds a fixed containing block', async () => {
    const fixture = createFixture()
    const view = render(<InputAnywhereControls />, { container: fixture.mount })
    fireEvent.click(view.getByRole('button', { name: 'Move input' }))
    expect(fixture.seat.hasAttribute('data-input-anywhere-floating')).toBe(true)

    act(() => { fixture.root.style.backdropFilter = 'blur(8px)' })

    await waitFor(() => {
      expect(fixture.seat.hasAttribute('data-input-anywhere-floating')).toBe(false)
      expect(view.getByRole('button', { name: 'Move input' }).getAttribute('aria-pressed')).toBe('false')
    })
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
