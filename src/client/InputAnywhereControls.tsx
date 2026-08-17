import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'
import { IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  DOCKED_LAYOUT,
  clampFloating,
  decodeLayout,
  encodeLayout,
  initialFloatingLayout,
  moveFloating,
  resizeFloating,
  sameLayout,
  snapFloating,
  STORAGE_KEY,
  type ComposerLayout,
  type FloatingLayout,
  type ResizeDirection,
} from './layout.ts'
import {
  applyFloatingStyles,
  clearFloatingStyles,
  extraHeight,
  findTrailingRegion,
  hasFixedContainingBlock,
  minimumCardHeight,
  rectOf,
  visibleBounds,
  type ComposerTargets,
} from './dom.ts'

interface PointerInteraction {
  readonly pointerId: number
  readonly kind: 'move' | 'resize'
  readonly direction?: ResizeDirection
  readonly startX: number
  readonly startY: number
  readonly origin: FloatingLayout
  readonly target: HTMLElement
}

const DIRECTIONS: readonly ResizeDirection[] = ['nw', 'ne', 'sw', 'se']
const DIRECTION_LABELS: Record<ResizeDirection, string> = {
  nw: 'top-left',
  ne: 'top-right',
  sw: 'bottom-left',
  se: 'bottom-right',
}

function loadLayout(): ComposerLayout {
  try {
    return decodeLayout(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return DOCKED_LAYOUT
  }
}

function persistLayout(layout: ComposerLayout): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, encodeLayout(layout))
  } catch {
    // Storage can be disabled by browser policy; the interaction stays in memory.
  }
}

export function InputAnywhereControls(): ReactElement {
  const controlsRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<ComposerLayout>(DOCKED_LAYOUT)
  const interactionRef = useRef<PointerInteraction | null>(null)
  const pendingLayoutRef = useRef<ComposerLayout | null>(null)
  const frameRef = useRef<number | null>(null)
  const [targets, setTargets] = useState<ComposerTargets | null>(null)
  const [layout, setLayout] = useState<ComposerLayout>(loadLayout)
  layoutRef.current = layout

  const commitLayout = (next: ComposerLayout): void => {
    layoutRef.current = next
    setLayout(next)
  }

  const flushScheduled = (): void => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    const pending = pendingLayoutRef.current
    pendingLayoutRef.current = null
    if (pending !== null) commitLayout(pending)
  }

  const scheduleLayout = (next: ComposerLayout): void => {
    pendingLayoutRef.current = next
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      const pending = pendingLayoutRef.current
      pendingLayoutRef.current = null
      if (pending !== null) commitLayout(pending)
    })
  }

  // Rebind when a replacement composer preserves the Slot cell but swaps marker ancestors.
  useLayoutEffect(() => {
    const controls = controlsRef.current
    if (controls === null) return

    let current: ComposerTargets | null = null
    let trailingRegion: HTMLElement | null = null
    let dependencyObserver: MutationObserver | null = null

    const releaseCurrent = (): void => {
      dependencyObserver?.disconnect()
      dependencyObserver = null
      trailingRegion?.removeAttribute('data-input-anywhere-trailing')
      trailingRegion = null
      if (current === null) return
      clearFloatingStyles(current)
      current.seat.classList.remove('dsh-input-anywhere-seat')
      current.card.classList.remove('dsh-input-anywhere-card')
      current.scroller.classList.remove('dsh-input-anywhere-scroll')
      current = null
    }

    const discover = (): void => {
      const card = controls.closest<HTMLElement>('[data-composer-card]')
      const seat = controls.closest<HTMLElement>('[data-composer-seat]')
      const scroller = seat?.closest<HTMLElement>('[data-conversation-scroll]') ?? null
      const root = scroller?.closest<HTMLElement>('[data-phase]') ?? null
      if (card === null || seat === null || scroller === null || root === null) {
        if (current !== null) {
          releaseCurrent()
          setTargets(null)
        }
        return
      }
      if (current?.card === card
        && current.seat === seat
        && current.scroller === scroller
        && current.root === root) return

      releaseCurrent()
      const next = { seat, card, scroller, root }
      current = next
      seat.classList.add('dsh-input-anywhere-seat')
      card.classList.add('dsh-input-anywhere-card')
      scroller.classList.add('dsh-input-anywhere-scroll')
      const markTrailingRegion = (): void => {
        const candidate = findTrailingRegion(card, controls)
        if (candidate === trailingRegion) return
        trailingRegion?.removeAttribute('data-input-anywhere-trailing')
        trailingRegion = candidate
        trailingRegion?.setAttribute('data-input-anywhere-trailing', '')
      }
      markTrailingRegion()
      dependencyObserver = new MutationObserver(markTrailingRegion)
      dependencyObserver.observe(card, { childList: true, subtree: true })
      setTargets(next)
    }

    discover()
    const discoveryObserver = new MutationObserver(discover)
    discoveryObserver.observe(document.body, { childList: true, subtree: true })
    return () => {
      discoveryObserver.disconnect()
      releaseCurrent()
      document.documentElement.classList.remove(
        'dsh-input-anywhere-interacting',
        'dsh-input-anywhere-resizing',
      )
    }
  }, [])

  useLayoutEffect(() => {
    if (targets === null) return
    if (layout.mode === 'docked') {
      clearFloatingStyles(targets)
      return
    }
    if (hasFixedContainingBlock(targets.seat)) {
      clearFloatingStyles(targets)
      commitLayout(DOCKED_LAYOUT)
      return
    }
    const normalized = clampFloating(
      layout,
      visibleBounds(targets.root),
      extraHeight(targets),
      minimumCardHeight(targets),
    )
    if (!sameLayout(normalized, layout)) {
      commitLayout(normalized)
      return
    }
    applyFloatingStyles(targets, normalized)
  }, [layout, targets])

  useEffect(() => {
    const timer = window.setTimeout(() => { persistLayout(layout) }, 120)
    return () => { window.clearTimeout(timer) }
  }, [layout])

  // Browser reload can bypass the debounce; pagehide also keeps BFCache state in sync.
  useEffect(() => {
    const handlePageHide = (): void => {
      flushScheduled()
      persistLayout(layoutRef.current)
    }
    const flushOnUnmount = (): void => {
      const latest = pendingLayoutRef.current ?? layoutRef.current
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      pendingLayoutRef.current = null
      layoutRef.current = latest
      persistLayout(latest)
    }
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      flushOnUnmount()
      document.documentElement.classList.remove(
        'dsh-input-anywhere-interacting',
        'dsh-input-anywhere-resizing',
      )
    }
  }, [])

  useEffect(() => {
    if (targets === null || layout.mode === 'docked') return
    const normalize = (): void => {
      const current = layoutRef.current
      if (current.mode === 'docked') return
      const next = clampFloating(
        current,
        visibleBounds(targets.root),
        extraHeight(targets),
        minimumCardHeight(targets),
      )
      if (!sameLayout(current, next)) commitLayout(next)
      else applyFloatingStyles(targets, next)
    }
    const observer = new ResizeObserver(normalize)
    observer.observe(targets.root)
    observer.observe(targets.seat)
    // Fixed card height hides intrinsic growth, so each normal child must be observed.
    const observedChildren = new Set<HTMLElement>()
    const syncObservedChildren = (): void => {
      const currentChildren = new Set(
        Array.from(targets.card.children).filter((child): child is HTMLElement => child instanceof HTMLElement),
      )
      for (const child of observedChildren) {
        if (currentChildren.has(child)) continue
        observer.unobserve(child)
        observedChildren.delete(child)
      }
      for (const child of currentChildren) {
        if (observedChildren.has(child)) continue
        observer.observe(child)
        observedChildren.add(child)
      }
    }
    syncObservedChildren()
    const mutations = new MutationObserver(() => {
      syncObservedChildren()
      normalize()
    })
    mutations.observe(targets.card, { childList: true, subtree: true, characterData: true })
    window.addEventListener('resize', normalize)
    window.addEventListener('orientationchange', normalize)
    window.addEventListener('transitionend', normalize)
    window.visualViewport?.addEventListener('resize', normalize)
    window.visualViewport?.addEventListener('scroll', normalize)
    return () => {
      observer.disconnect()
      mutations.disconnect()
      window.removeEventListener('resize', normalize)
      window.removeEventListener('orientationchange', normalize)
      window.removeEventListener('transitionend', normalize)
      window.visualViewport?.removeEventListener('resize', normalize)
      window.visualViewport?.removeEventListener('scroll', normalize)
    }
  }, [layout.mode, targets])

  const floatingFromDom = (): FloatingLayout | null => {
    if (targets === null || hasFixedContainingBlock(targets.seat)) return null
    const current = layoutRef.current
    if (current.mode === 'floating') return current
    const cardRect = rectOf(targets.card)
    const seatRect = rectOf(targets.seat)
    const extra = Math.max(0, seatRect.height - cardRect.height)
    return initialFloatingLayout(
      cardRect,
      seatRect,
      visibleBounds(targets.root),
      extra,
      minimumCardHeight(targets),
    )
  }

  const finishInteraction = (target?: HTMLElement, pointerId?: number): void => {
    const interaction = interactionRef.current
    const captureTarget = target ?? interaction?.target
    const capturePointerId = pointerId ?? interaction?.pointerId
    const latest = pendingLayoutRef.current ?? layoutRef.current
    flushScheduled()
    const finalLayout = interaction?.kind === 'move' && latest.mode === 'floating' && targets !== null
      ? snapFloating(
        latest,
        visibleBounds(targets.root),
        extraHeight(targets),
        minimumCardHeight(targets),
      )
      : latest
    if (!sameLayout(finalLayout, layoutRef.current)) commitLayout(finalLayout)
    persistLayout(finalLayout)
    interactionRef.current = null
    document.documentElement.classList.remove(
      'dsh-input-anywhere-interacting',
      'dsh-input-anywhere-resizing',
    )
    if (captureTarget !== undefined
      && capturePointerId !== undefined
      && captureTarget.hasPointerCapture(capturePointerId)) {
      captureTarget.releasePointerCapture(capturePointerId)
    }
  }

  const beginInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    kind: PointerInteraction['kind'],
    direction?: ResizeDirection,
  ): void => {
    if (!event.isPrimary || event.button !== 0) return
    const origin = floatingFromDom()
    if (origin === null) return
    event.currentTarget.focus({ preventScroll: true })
    event.preventDefault()
    event.stopPropagation()
    commitLayout(origin)
    event.currentTarget.setPointerCapture(event.pointerId)
    interactionRef.current = {
      pointerId: event.pointerId,
      kind,
      ...(direction === undefined ? {} : { direction }),
      startX: event.clientX,
      startY: event.clientY,
      origin,
      target: event.currentTarget,
    }
    document.documentElement.classList.add('dsh-input-anywhere-interacting')
    if (kind === 'resize') document.documentElement.classList.add('dsh-input-anywhere-resizing')
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>): void => {
    const interaction = interactionRef.current
    if (interaction === null || interaction.pointerId !== event.pointerId || targets === null) return
    if (event.buttons === 0 && event.pointerType !== 'touch') {
      finishInteraction(interaction.target, interaction.pointerId)
      return
    }
    event.preventDefault()
    const deltaX = event.clientX - interaction.startX
    const deltaY = event.clientY - interaction.startY
    const bounds = visibleBounds(targets.root)
    const extra = extraHeight(targets)
    const minimumHeight = minimumCardHeight(targets)
    const next = interaction.kind === 'move'
      ? moveFloating(interaction.origin, deltaX, deltaY, bounds, extra, minimumHeight)
      : resizeFloating(
        interaction.origin,
        interaction.direction ?? 'se',
        deltaX,
        deltaY,
        bounds,
        extra,
        minimumHeight,
      )
    scheduleLayout(next)
  }

  const onPointerEnd = (event: ReactPointerEvent<HTMLElement>): void => {
    const interaction = interactionRef.current
    if (interaction === null || interaction.pointerId !== event.pointerId) return
    event.preventDefault()
    finishInteraction(interaction.target, interaction.pointerId)
  }

  const nudgeMove = (event: ReactKeyboardEvent<HTMLElement>): void => {
    if (targets === null) return
    const delta = event.shiftKey ? 1 : 10
    const vector: Record<string, readonly [number, number]> = {
      ArrowLeft: [-delta, 0],
      ArrowRight: [delta, 0],
      ArrowUp: [0, -delta],
      ArrowDown: [0, delta],
    }
    const move = vector[event.key]
    if (move === undefined) return
    const origin = floatingFromDom()
    if (origin === null) return
    event.preventDefault()
    commitLayout(moveFloating(
      origin,
      move[0],
      move[1],
      visibleBounds(targets.root),
      extraHeight(targets),
      minimumCardHeight(targets),
    ))
  }

  const nudgeResize = (
    event: ReactKeyboardEvent<HTMLElement>,
    direction: ResizeDirection,
  ): void => {
    if (targets === null) return
    const current = layoutRef.current
    if (current.mode === 'docked') return
    const delta = event.shiftKey ? 1 : 10
    const vector: Record<string, readonly [number, number]> = {
      ArrowLeft: [-delta, 0],
      ArrowRight: [delta, 0],
      ArrowUp: [0, -delta],
      ArrowDown: [0, delta],
    }
    const resize = vector[event.key]
    if (resize === undefined) return
    event.preventDefault()
    commitLayout(resizeFloating(
      current,
      direction,
      resize[0],
      resize[1],
      visibleBounds(targets.root),
      extraHeight(targets),
      minimumCardHeight(targets),
    ))
  }

  const growResize = (
    event: ReactKeyboardEvent<HTMLElement>,
    direction: ResizeDirection,
  ): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (targets === null) return
    const current = layoutRef.current
    if (current.mode === 'docked') return
    event.preventDefault()
    commitLayout(resizeFloating(
      current,
      direction,
      direction.includes('w') ? -10 : 10,
      direction.includes('n') ? -10 : 10,
      visibleBounds(targets.root),
      extraHeight(targets),
      minimumCardHeight(targets),
    ))
  }

  const reset = (): void => {
    finishInteraction()
    commitLayout(DOCKED_LAYOUT)
    persistLayout(DOCKED_LAYOUT)
  }

  return <>
    <div ref={controlsRef} className="dsh-input-anywhere-controls">
      <button
        type="button"
        className="dsh-input-anywhere-button"
        aria-label="Move input"
        aria-pressed={layout.mode === 'floating'}
        title="Move input"
        onClick={() => {
          const next = floatingFromDom()
          if (next !== null && layoutRef.current.mode === 'docked') commitLayout(next)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            reset()
            return
          }
          nudgeMove(event)
        }}
        onPointerDown={(event) => { beginInteraction(event, 'move') }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
      >
        <span className="dsh-input-anywhere-grip" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
        </span>
      </button>
      {layout.mode === 'floating' && <button
        type="button"
        className="dsh-input-anywhere-button"
        data-action="reset"
        aria-label="Reset input position"
        title="Reset input position"
        onClick={reset}
      >
        <IconRefreshOutline16 size={16} />
      </button>}
    </div>
    {layout.mode === 'floating' && targets !== null && createPortal(
      <div className="dsh-input-anywhere-resize-layer">
        {DIRECTIONS.map(direction => <button
          key={direction}
          type="button"
          className="dsh-input-anywhere-resize"
          data-direction={direction}
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
          aria-label={`Resize input from ${DIRECTION_LABELS[direction]} corner. ${layout.width} by ${layout.height} pixels.`}
          title={`Resize input from ${DIRECTION_LABELS[direction]} corner`}
          onKeyDown={(event) => {
            growResize(event, direction)
            nudgeResize(event, direction)
          }}
          onPointerDown={(event) => { beginInteraction(event, 'resize', direction) }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
        />)}
      </div>,
      targets.card,
    )}
  </>
}
