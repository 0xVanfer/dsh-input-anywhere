import type { InputAnywherePreferences } from '../preferences-contract.ts'
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
  const normalChildren = Array.from(targets.card.children).flatMap((child) => {
    if (!(child instanceof HTMLElement) || child === scroll) return []
    const style = window.getComputedStyle(child)
    const position = child.style.position || style.position
    return position === 'absolute' || position === 'fixed' ? [] : [{ child, style }]
  })
  const itemCount = normalChildren.length + 1
  const fixedHeight = normalChildren.reduce(
    (sum, { child, style }) => sum
      + child.getBoundingClientRect().height
      + cssPixels(child.style.marginTop || style.marginTop)
      + cssPixels(child.style.marginBottom || style.marginBottom),
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

interface ResolvedColor {
  value: string
  alpha: number
}

export interface FloatingAppearance {
  preferences: InputAnywherePreferences
  inputActive: boolean
}

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

function withAlpha(value: string, alpha: number): string | undefined {
  const color = value.trim()
  if (color.toLowerCase() === 'transparent') return alpha === 0 ? 'transparent' : undefined
  const shortHex = /^#([0-9a-f])([0-9a-f])([0-9a-f])(?:[0-9a-f])?$/i.exec(color)
  if (shortHex?.[1] !== undefined && shortHex[2] !== undefined && shortHex[3] !== undefined) {
    const channels = [shortHex[1], shortHex[2], shortHex[3]].map(channel => Number.parseInt(`${channel}${channel}`, 16))
    return `rgb(${channels.join(' ')} / ${alpha})`
  }
  const longHex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/i.exec(color)
  if (longHex?.[1] !== undefined && longHex[2] !== undefined && longHex[3] !== undefined) {
    const channels = [longHex[1], longHex[2], longHex[3]].map(channel => Number.parseInt(channel, 16))
    return `rgb(${channels.join(' ')} / ${alpha})`
  }
  const functional = /^(rgba?|hsla?)\((.*)\)$/i.exec(color)
  if (functional?.[1] !== undefined && functional[2] !== undefined) {
    const fn = functional[1].toLowerCase().startsWith('rgb') ? 'rgb' : 'hsl'
    const body = functional[2]
    if (body.includes(',')) {
      const channels = body.split(',').slice(0, 3).map(part => part.trim())
      return channels.length === 3 ? `${fn}a(${channels.join(', ')}, ${alpha})` : undefined
    }
    const channels = body.split('/')[0]?.trim()
    return channels === undefined || channels === '' ? undefined : `${fn}(${channels} / ${alpha})`
  }
  const modern = /^(hwb|lab|lch|oklab|oklch|color)\((.*)\)$/i.exec(color)
  if (modern?.[1] !== undefined && modern[2] !== undefined) {
    const channels = modern[2].split('/')[0]?.trim()
    return channels === undefined || channels === ''
      ? undefined
      : `${modern[1]}(${channels} / ${alpha})`
  }
  return /^[a-z]+$/i.test(color)
    ? `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`
    : undefined
}

function inheritedTokenValue(
  element: HTMLElement,
  style: CSSStyleDeclaration,
  name: string,
): string {
  const computed = style.getPropertyValue(name)
  if (computed.trim() !== '') return computed.trim()
  for (let node: HTMLElement | null = element; node !== null; node = node.parentElement) {
    const inline = node.style.getPropertyValue(name)
    if (inline.trim() !== '') return inline.trim()
  }
  return ''
}

function firstResolvedColor(
  element: HTMLElement,
  style: CSSStyleDeclaration,
  names: readonly string[],
  fallback: string,
  requireTint = false,
): ResolvedColor | undefined {
  for (const name of names) {
    const value = inheritedTokenValue(element, style, name)
    const alpha = alphaChannel(value)
    if (alpha !== null && (!requireTint || alpha > 0)) return { value, alpha }
  }
  const alpha = alphaChannel(fallback)
  return alpha === null || (requireTint && alpha <= 0) ? undefined : { value: fallback, alpha }
}

function firstTranslucentColor(
  element: HTMLElement,
  style: CSSStyleDeclaration,
  names: readonly string[],
): ResolvedColor | undefined {
  for (const name of names) {
    const value = inheritedTokenValue(element, style, name)
    const alpha = alphaChannel(value)
    if (alpha !== null && alpha < 0.999) return { value, alpha }
  }
  return undefined
}

function positiveIntersection(first: DOMRect, second: DOMRect, bounds: RectLike): boolean {
  const left = Math.max(first.left, second.left, bounds.left)
  const top = Math.max(first.top, second.top, bounds.top)
  const right = Math.min(first.right, second.right, bounds.right)
  const bottom = Math.min(first.bottom, second.bottom, bounds.bottom)
  return right - left > 0.5 && bottom - top > 0.5
}

export function overlapsChatOutput(targets: ComposerTargets): boolean {
  const seatRect = targets.seat.getBoundingClientRect()
  if (seatRect.width <= 0 || seatRect.height <= 0) return false
  const bounds = visibleBounds(targets.root)
  const flows = targets.scroller.querySelectorAll<HTMLElement>('[data-chat-flow]')
  return Array.from(flows).some((flow) => {
    if (targets.seat.contains(flow)
      || flow.hidden
      || flow.style.display === 'none'
      || window.getComputedStyle(flow).display === 'none') return false
    const flowRect = flow.getBoundingClientRect()
    return flowRect.width > 0 && flowRect.height > 0 && positiveIntersection(seatRect, flowRect, bounds)
  })
}

function clearAppearance(targets: Pick<ComposerTargets, 'seat'>): void {
  targets.seat.removeAttribute('data-input-anywhere-themed')
  targets.seat.style.removeProperty('--dsh-input-anywhere-surface')
  targets.seat.style.removeProperty('--dsh-input-anywhere-menu-surface')
}

/** Resolve user preference, theme alpha, overlap, and input activity into owned paint values. */
export function syncFloatingAppearance(
  targets: ComposerTargets,
  appearance: FloatingAppearance,
): void {
  const { preferences, inputActive } = appearance
  const overlap = preferences.overlapAware && overlapsChatOutput(targets)
  const style = window.getComputedStyle(targets.card)
  const overlapMode = inputActive ? preferences.overlapActiveMode : preferences.overlapIdleMode
  const overlapAlpha = overlap && overlapMode === 'custom'
    ? inputActive ? preferences.overlapActiveOpacity : preferences.overlapIdleOpacity
    : undefined
  const forcedAlpha = overlapAlpha
    ?? (preferences.surfaceMode === 'custom' ? preferences.surfaceOpacity : undefined)
  const baseSurfaceSource = firstResolvedColor(
    targets.card,
    style,
    APPEARANCE_SURFACE_TOKENS,
    style.backgroundColor,
    forcedAlpha !== undefined,
  )
  const themeSurfaceSource = firstTranslucentColor(targets.card, style, APPEARANCE_SURFACE_TOKENS)
  const surfaceSource = forcedAlpha === undefined && preferences.surfaceMode === 'theme'
    ? themeSurfaceSource
    : baseSurfaceSource
  const themeMenuSource = firstTranslucentColor(targets.card, style, APPEARANCE_MENU_SURFACE_TOKENS)
  const menuSource = forcedAlpha === undefined && preferences.surfaceMode === 'theme'
    ? themeMenuSource ?? surfaceSource
    : firstResolvedColor(
        targets.card,
        style,
        APPEARANCE_MENU_SURFACE_TOKENS,
        surfaceSource?.value ?? style.backgroundColor,
        forcedAlpha !== undefined,
      )
  const themeAlpha = preferences.surfaceMode === 'theme' && surfaceSource !== undefined
    ? surfaceSource.alpha
    : undefined
  const surfaceAlpha = forcedAlpha ?? themeAlpha ?? 1
  const menuAlpha = forcedAlpha ?? (preferences.surfaceMode === 'theme' ? menuSource?.alpha : undefined) ?? surfaceAlpha
  const shouldBridge = surfaceSource !== undefined
    && menuSource !== undefined
    && (forcedAlpha !== undefined || themeAlpha !== undefined)

  if (shouldBridge) {
    const surface = withAlpha(surfaceSource.value, surfaceAlpha)
    const menu = withAlpha(menuSource.value, menuAlpha)
    if (surface !== undefined && menu !== undefined) {
      targets.seat.setAttribute('data-input-anywhere-themed', '')
      targets.seat.style.setProperty('--dsh-input-anywhere-surface', surface)
      targets.seat.style.setProperty('--dsh-input-anywhere-menu-surface', menu)
    } else clearAppearance(targets)
  } else clearAppearance(targets)

  const controlsOpacity = preferences.controlsMode === 'surface'
    ? surfaceAlpha
    : preferences.controlsMode === 'custom'
      ? preferences.controlsOpacity
      : 1
  targets.seat.style.setProperty('--dsh-input-anywhere-controls-opacity', String(controlsOpacity))
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
    '--dsh-input-anywhere-controls-opacity',
  ]) targets.seat.style.removeProperty(property)
  targets.card.style.removeProperty('--dsh-input-anywhere-card-height')
}

function setStyleProperty(element: HTMLElement, property: string, value: string): void {
  if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value)
}

export function applyFloatingStyles(
  targets: ComposerTargets,
  layout: FloatingLayout,
  appearance: FloatingAppearance,
): void {
  targets.seat.setAttribute('data-input-anywhere-floating', '')
  targets.card.setAttribute('data-input-anywhere-floating-card', '')
  targets.scroller.setAttribute('data-input-anywhere-floating-host', '')
  setStyleProperty(targets.seat, '--dsh-input-anywhere-x', `${layout.x}px`)
  setStyleProperty(targets.seat, '--dsh-input-anywhere-y', `${layout.y}px`)
  setStyleProperty(targets.seat, '--dsh-input-anywhere-width', `${layout.width}px`)
  setStyleProperty(targets.card, '--dsh-input-anywhere-card-height', `${layout.height}px`)
  syncFloatingAppearance(targets, appearance)
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
