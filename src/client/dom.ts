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
  const right = Math.min(rootRect.right, viewportRight)
  const bottom = Math.min(rootRect.bottom, viewportBottom)
  const rootBounds = { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
  const usableMinimumWidth = Math.min(MIN_WIDTH + EDGE_MARGIN * 2, viewportBounds.width)
  const usableMinimumHeight = Math.min(MIN_CARD_HEIGHT + EDGE_MARGIN * 2, viewportBounds.height)
  return rootBounds.width < usableMinimumWidth || rootBounds.height < usableMinimumHeight
    ? viewportBounds
    : rootBounds
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

const APPEARANCE_SURFACE_TOKENS = [
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-base',
] as const

const APPEARANCE_MENU_SURFACE_TOKENS = [
  '--dsw-alias-bg-layer-2',
  ...APPEARANCE_SURFACE_TOKENS,
] as const

function alphaChannel(value: string): number | null {
  const color = value.trim().toLowerCase()
  if (color === '') return null
  if (color === 'transparent') return 0

  const hex = /^#([0-9a-f]{4}|[0-9a-f]{8})$/i.exec(color)?.[1]
  if (hex !== undefined) {
    const channel = hex.length === 4 ? `${hex[3]}${hex[3]}` : hex.slice(6)
    return Number.parseInt(channel, 16) / 255
  }

  const slashAlpha = /\/\s*([\d.]+)(%)?\s*\)$/.exec(color)
  if (slashAlpha?.[1] !== undefined) {
    const parsed = Number.parseFloat(slashAlpha[1])
    return slashAlpha[2] === '%' ? parsed / 100 : parsed
  }

  const legacy = /^(?:rgba|hsla)\((.*)\)$/.exec(color)?.[1]
  if (legacy !== undefined) {
    const parts = legacy.split(',')
    if (parts.length === 4 && parts[3] !== undefined) return Number.parseFloat(parts[3])
    return 1
  }

  if (/^(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\(/.test(color)
    || /^#[0-9a-f]{3,6}$/i.test(color)
    || /^[a-z]+$/i.test(color)) return 1
  return null
}

function inheritedTokenValue(
  element: HTMLElement,
  style: CSSStyleDeclaration,
  name: string,
): string {
  const computed = style.getPropertyValue(name)
  if (computed.trim() !== '') return computed
  for (let node: HTMLElement | null = element; node !== null; node = node.parentElement) {
    const inline = node.style.getPropertyValue(name)
    if (inline.trim() !== '') return inline
  }
  return ''
}

function translucentToken(
  element: HTMLElement,
  style: CSSStyleDeclaration,
  names: readonly string[],
): string | undefined {
  return names.find((name) => {
    const alpha = alphaChannel(inheritedTokenValue(element, style, name))
    return alpha !== null && alpha < 0.999
  })
}

/**
 * Reuse translucent DSH surfaces only inside the floating seat. Opaque themes
 * retain native input, tip, and menu tokens, so the bridge stays inert without
 * an appearance extension and never changes text/control opacity.
 */
export function syncFloatingSurfaces(targets: Pick<ComposerTargets, 'seat' | 'card'>): void {
  const style = window.getComputedStyle(targets.card)
  const surface = translucentToken(targets.card, style, APPEARANCE_SURFACE_TOKENS)
  if (surface === undefined) {
    targets.seat.removeAttribute('data-input-anywhere-themed')
    targets.seat.style.removeProperty('--dsh-input-anywhere-surface')
    targets.seat.style.removeProperty('--dsh-input-anywhere-menu-surface')
    return
  }

  const menuSurface = translucentToken(targets.card, style, APPEARANCE_MENU_SURFACE_TOKENS)
    ?? surface
  targets.seat.setAttribute('data-input-anywhere-themed', '')
  targets.seat.style.setProperty('--dsh-input-anywhere-surface', `var(${surface})`)
  targets.seat.style.setProperty('--dsh-input-anywhere-menu-surface', `var(${menuSurface})`)
}

export function clearFloatingStyles(targets: ComposerTargets): void {
  targets.seat.removeAttribute('data-input-anywhere-floating')
  targets.seat.removeAttribute('data-input-anywhere-themed')
  targets.card.removeAttribute('data-input-anywhere-floating-card')
  targets.scroller.removeAttribute('data-input-anywhere-floating-host')
  for (const property of [
    '--dsh-input-anywhere-x',
    '--dsh-input-anywhere-y',
    '--dsh-input-anywhere-width',
    '--dsh-input-anywhere-surface',
    '--dsh-input-anywhere-menu-surface',
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
  syncFloatingSurfaces(targets)
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
