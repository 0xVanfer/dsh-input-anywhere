import {
  EDGE_MARGIN,
  MIN_CARD_HEIGHT,
  MIN_WIDTH,
  type FloatingLayout,
  type RectLike,
} from './layout.ts'

export interface ComposerTargets {
  readonly seat: HTMLElement
  readonly card: HTMLElement
  readonly scroller: HTMLElement
  readonly root: HTMLElement
}

interface ViewportGeometry {
  readonly offsetLeft: number
  readonly offsetTop: number
  readonly width: number
  readonly height: number
}

export function rectOf(element: Element): RectLike {
  const rect = element.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  }
}

/**
 * Resolve the usable floating area. A very narrow conversation column is not
 * useful for a composer, so side-panel layouts fall back to the full viewport.
 */
export function visibleBounds(
  root: HTMLElement,
  viewport: ViewportGeometry | null = window.visualViewport,
  fallbackWidth = window.innerWidth,
  fallbackHeight = window.innerHeight,
): RectLike {
  const rootRect = root.getBoundingClientRect()
  const viewportLeft = viewport?.offsetLeft ?? 0
  const viewportTop = viewport?.offsetTop ?? 0
  const viewportRight = viewportLeft + (viewport?.width ?? fallbackWidth)
  const viewportBottom = viewportTop + (viewport?.height ?? fallbackHeight)
  const viewportBounds = {
    left: viewportLeft,
    top: viewportTop,
    right: viewportRight,
    bottom: viewportBottom,
    width: viewportRight - viewportLeft,
    height: viewportBottom - viewportTop,
  }
  const left = Math.max(rootRect.left, viewportLeft)
  const top = Math.max(rootRect.top, viewportTop)
  const right = Math.max(left + 1, Math.min(rootRect.right, viewportRight))
  const bottom = Math.max(top + 1, Math.min(rootRect.bottom, viewportBottom))
  const rootBounds = { left, top, right, bottom, width: right - left, height: bottom - top }
  const usableMinimum = Math.min(MIN_WIDTH + EDGE_MARGIN * 2, viewportBounds.width)
  return rootBounds.width < usableMinimum ? viewportBounds : rootBounds
}

export function extraHeight(targets: ComposerTargets): number {
  return Math.max(0, targets.seat.getBoundingClientRect().height - targets.card.getBoundingClientRect().height)
}

/**
 * CSS can make fixed positioning relative to an ancestor instead of the visual
 * viewport. Refuse floating in that case rather than applying incorrect global
 * coordinates to a transformed third-party shell.
 */
export function hasFixedContainingBlock(element: HTMLElement): boolean {
  for (let ancestor = element.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
    const style = window.getComputedStyle(ancestor)
    const contain = style.contain.split(/\s+/)
    const willChange = style.willChange.split(/\s*,\s*/)
    if ((style.transform !== '' && style.transform !== 'none')
      || (style.perspective !== '' && style.perspective !== 'none')
      || (style.filter !== '' && style.filter !== 'none')
      || (style.backdropFilter !== '' && style.backdropFilter !== 'none')
      || contain.some(value => ['layout', 'paint', 'strict', 'content'].includes(value))
      || willChange.some(value => ['transform', 'perspective', 'filter'].includes(value))) return true
  }
  return false
}

function cssPixels(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Preserve extension-owned accessory and attachment rows when the card has a
 * fixed floating height. Absolutely positioned overlays do not consume space.
 */
export function minimumCardHeight(targets: ComposerTargets): number {
  const scroll = targets.card.querySelector<HTMLElement>('[data-input-scroll]')
  if (scroll === null) return MIN_CARD_HEIGHT
  const cardStyle = window.getComputedStyle(targets.card)
  const normalChildren = Array.from(targets.card.children).filter((child): child is HTMLElement => {
    if (!(child instanceof HTMLElement) || child === scroll) return false
    const position = child.style.position || window.getComputedStyle(child).position
    return position !== 'absolute' && position !== 'fixed'
  })
  const itemCount = normalChildren.length + 1
  const fixedHeight = normalChildren.reduce(
    (sum, child) => sum + child.getBoundingClientRect().height,
    0,
  )
  const chrome = cssPixels(cardStyle.paddingTop)
    + cssPixels(cardStyle.paddingBottom)
    + cssPixels(cardStyle.borderTopWidth)
    + cssPixels(cardStyle.borderBottomWidth)
    + cssPixels(cardStyle.rowGap) * Math.max(0, itemCount - 1)
  return Math.max(MIN_CARD_HEIGHT, Math.ceil(fixedHeight + chrome + 48))
}

export function clearFloatingStyles(targets: ComposerTargets): void {
  targets.seat.removeAttribute('data-input-anywhere-floating')
  targets.card.removeAttribute('data-input-anywhere-floating-card')
  targets.scroller.removeAttribute('data-input-anywhere-floating-host')
  for (const property of [
    '--dsh-input-anywhere-x',
    '--dsh-input-anywhere-y',
    '--dsh-input-anywhere-width',
  ]) targets.seat.style.removeProperty(property)
  targets.card.style.removeProperty('--dsh-input-anywhere-card-height')
}

export function applyFloatingStyles(targets: ComposerTargets, layout: FloatingLayout): void {
  targets.seat.setAttribute('data-input-anywhere-floating', '')
  targets.card.setAttribute('data-input-anywhere-floating-card', '')
  targets.scroller.setAttribute('data-input-anywhere-floating-host', '')
  targets.seat.style.setProperty('--dsh-input-anywhere-x', `${layout.x}px`)
  targets.seat.style.setProperty('--dsh-input-anywhere-y', `${layout.y}px`)
  targets.seat.style.setProperty('--dsh-input-anywhere-width', `${layout.width}px`)
  targets.card.style.setProperty('--dsh-input-anywhere-card-height', `${layout.height}px`)
}

/** Find the trailing toolbar branch without assuming which Slot owns its controls. */
export function findTrailingRegion(card: HTMLElement, controls: HTMLElement): HTMLElement | null {
  let row: HTMLElement = controls
  while (row.parentElement !== null && row.parentElement !== card) row = row.parentElement
  if (row.parentElement !== card) return null
  const trailing = row.lastElementChild
  if (!(trailing instanceof HTMLElement) || trailing === row.firstElementChild) return null
  return trailing
}
