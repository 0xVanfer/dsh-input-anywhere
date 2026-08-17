export const STORAGE_KEY = 'dsh-input-anywhere:layout:v1'
export const LAYOUT_VERSION = 1
export const MIN_WIDTH = 320
export const MIN_CARD_HEIGHT = 116
export const EDGE_MARGIN = 8
export const COMPOSER_SIDE_PADDING = 16
export const SNAP_THRESHOLD = 24

export type HorizontalAnchor = 'left' | 'right'
export type ResizeDirection = 'nw' | 'ne' | 'sw' | 'se'

export interface DockedLayout {
  readonly mode: 'docked'
}

export interface FloatingLayout {
  readonly mode: 'floating'
  /** Viewport-space seat coordinates in CSS pixels. */
  readonly x: number
  readonly y: number
  /** Total seat width and composer-card height. */
  readonly width: number
  readonly height: number
  /** Boundary intent retained across sidebar and viewport changes. */
  readonly anchor?: HorizontalAnchor
}

export type ComposerLayout = DockedLayout | FloatingLayout

export interface RectLike {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly width: number
  readonly height: number
}

export const DOCKED_LAYOUT: DockedLayout = { mode: 'docked' }

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function sameLayout(left: ComposerLayout, right: ComposerLayout): boolean {
  if (left.mode !== right.mode) return false
  if (left.mode === 'docked' || right.mode === 'docked') return true
  return left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height
    && left.anchor === right.anchor
}

export function decodeLayout(serialized: string | null): ComposerLayout {
  if (serialized === null) return DOCKED_LAYOUT
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (typeof parsed !== 'object' || parsed === null) return DOCKED_LAYOUT
    const record = parsed as Record<string, unknown>
    if (record.version !== LAYOUT_VERSION) return DOCKED_LAYOUT
    const layout = record.layout
    if (typeof layout !== 'object' || layout === null) return DOCKED_LAYOUT
    const candidate = layout as Record<string, unknown>
    if (candidate.mode === 'docked') return DOCKED_LAYOUT
    if (candidate.mode !== 'floating'
      || !finite(candidate.x)
      || !finite(candidate.y)
      || !finite(candidate.width)
      || !finite(candidate.height)) return DOCKED_LAYOUT
    return {
      mode: 'floating',
      x: candidate.x,
      y: candidate.y,
      width: candidate.width,
      height: candidate.height,
      ...(candidate.anchor === 'left' || candidate.anchor === 'right'
        ? { anchor: candidate.anchor }
        : {}),
    }
  } catch {
    return DOCKED_LAYOUT
  }
}

export function encodeLayout(layout: ComposerLayout): string {
  return JSON.stringify({ version: LAYOUT_VERSION, layout })
}

/** Clamp card size and the complete seat footprint to the active bounds. */
export function clampFloating(
  layout: FloatingLayout,
  bounds: RectLike,
  extraHeight: number,
  minimumCardHeight = MIN_CARD_HEIGHT,
  margin = EDGE_MARGIN,
): FloatingLayout {
  const availableWidth = Math.max(1, bounds.width - margin * 2)
  const availableCardHeight = Math.max(1, bounds.height - margin * 2 - Math.max(0, extraHeight))
  const minWidth = Math.min(MIN_WIDTH, availableWidth)
  const minHeight = Math.min(Math.max(MIN_CARD_HEIGHT, minimumCardHeight), availableCardHeight)
  const width = clamp(layout.width, minWidth, availableWidth)
  const height = clamp(layout.height, minHeight, availableCardHeight)
  const minX = bounds.left + margin
  const minY = bounds.top + margin
  const maxX = Math.max(minX, bounds.right - margin - width)
  const maxY = Math.max(minY, bounds.bottom - margin - height - Math.max(0, extraHeight))
  const x = layout.anchor === 'left'
    ? minX
    : layout.anchor === 'right'
      ? maxX
      : clamp(layout.x, minX, maxX)
  return {
    mode: 'floating',
    x,
    y: clamp(layout.y, minY, maxY),
    width,
    height,
    ...(layout.anchor === undefined ? {} : { anchor: layout.anchor }),
  }
}

export function initialFloatingLayout(
  card: RectLike,
  seat: RectLike,
  bounds: RectLike,
  extraHeight: number,
  minimumCardHeight = MIN_CARD_HEIGHT,
): FloatingLayout {
  return clampFloating({
    mode: 'floating',
    x: card.left - COMPOSER_SIDE_PADDING,
    y: seat.top,
    width: card.width + COMPOSER_SIDE_PADDING * 2,
    height: card.height,
  }, bounds, extraHeight, minimumCardHeight)
}

/** A deliberate move releases any previous horizontal boundary anchor. */
export function moveFloating(
  origin: FloatingLayout,
  deltaX: number,
  deltaY: number,
  bounds: RectLike,
  extraHeight: number,
  minimumCardHeight = MIN_CARD_HEIGHT,
): FloatingLayout {
  const { anchor: _anchor, ...unanchored } = origin
  return clampFloating({
    ...unanchored,
    x: origin.x + deltaX,
    y: origin.y + deltaY,
  }, bounds, extraHeight, minimumCardHeight)
}

/** Convert edge proximity into an anchor so future bound changes preserve intent. */
export function snapFloating(
  layout: FloatingLayout,
  bounds: RectLike,
  extraHeight: number,
  minimumCardHeight = MIN_CARD_HEIGHT,
  threshold = SNAP_THRESHOLD,
): FloatingLayout {
  const { anchor: _anchor, ...unanchored } = layout
  const normalized = clampFloating(unanchored, bounds, extraHeight, minimumCardHeight)
  const minX = bounds.left + EDGE_MARGIN
  const maxX = Math.max(minX, bounds.right - EDGE_MARGIN - normalized.width)
  const anchor = normalized.x - minX <= threshold
    ? 'left'
    : maxX - normalized.x <= threshold
      ? 'right'
      : undefined
  return clampFloating({
    ...normalized,
    ...(anchor === undefined ? {} : { anchor }),
  }, bounds, extraHeight, minimumCardHeight)
}

/** Resize from one corner while keeping its opposite corner geometrically stable. */
export function resizeFloating(
  origin: FloatingLayout,
  direction: ResizeDirection,
  deltaX: number,
  deltaY: number,
  bounds: RectLike,
  extraHeight: number,
  minimumCardHeight = MIN_CARD_HEIGHT,
): FloatingLayout {
  const west = direction.includes('w')
  const north = direction.includes('n')
  const proposedWidth = origin.width + (west ? -deltaX : deltaX)
  const proposedHeight = origin.height + (north ? -deltaY : deltaY)
  const availableWidth = Math.max(1, bounds.width - EDGE_MARGIN * 2)
  const availableHeight = Math.max(1, bounds.height - EDGE_MARGIN * 2 - Math.max(0, extraHeight))
  const width = clamp(proposedWidth, Math.min(MIN_WIDTH, availableWidth), availableWidth)
  const height = clamp(
    proposedHeight,
    Math.min(Math.max(MIN_CARD_HEIGHT, minimumCardHeight), availableHeight),
    availableHeight,
  )
  const candidate: FloatingLayout = {
    mode: 'floating',
    x: west ? origin.x + origin.width - width : origin.x,
    y: north ? origin.y + origin.height - height : origin.y,
    width,
    height,
    ...(origin.anchor === undefined ? {} : { anchor: origin.anchor }),
  }
  return clampFloating(candidate, bounds, extraHeight, minimumCardHeight)
}
