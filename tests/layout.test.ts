import { describe, expect, it } from 'vitest'
import {
  DOCKED_LAYOUT,
  clampFloating,
  decodeLayout,
  encodeLayout,
  initialFloatingLayout,
  moveFloating,
  resizeFloating,
  snapFloating,
  type RectLike,
} from '../src/client/layout.ts'

const bounds: RectLike = {
  left: 100,
  top: 50,
  right: 1100,
  bottom: 750,
  width: 1000,
  height: 700,
}

describe('layout persistence', () => {
  it('round-trips a floating layout', () => {
    const layout = {
      mode: 'floating' as const,
      x: 120,
      y: 80,
      width: 640,
      height: 180,
      anchor: 'right' as const,
    }
    expect(decodeLayout(encodeLayout(layout))).toEqual(layout)
  })

  it('rejects malformed and stale data', () => {
    expect(decodeLayout('{bad')).toEqual(DOCKED_LAYOUT)
    expect(decodeLayout(JSON.stringify({ version: 0, layout: { mode: 'floating' } }))).toEqual(DOCKED_LAYOUT)
    expect(decodeLayout(JSON.stringify({ version: 1, layout: { mode: 'floating', x: 0 } }))).toEqual(DOCKED_LAYOUT)
  })
})

describe('layout geometry', () => {
  it('starts from the native card geometry', () => {
    const card = { left: 220, top: 500, right: 980, bottom: 640, width: 760, height: 140 }
    const seat = { left: 100, top: 470, right: 1100, bottom: 660, width: 1000, height: 190 }
    expect(initialFloatingLayout(card, seat, bounds, 50)).toEqual({
      mode: 'floating', x: 204, y: 470, width: 792, height: 140,
    })
  })

  it('clamps size and position to the active conversation', () => {
    expect(clampFloating({ mode: 'floating', x: -100, y: -100, width: 2000, height: 1000 }, bounds, 80)).toEqual({
      mode: 'floating', x: 108, y: 58, width: 984, height: 604,
    })
  })

  it('moves without crossing the visible bounds', () => {
    const origin = { mode: 'floating' as const, x: 200, y: 200, width: 500, height: 160 }
    expect(moveFloating(origin, 1000, 1000, bounds, 40)).toEqual({
      mode: 'floating', x: 592, y: 542, width: 500, height: 160,
    })
  })

  it('respects a dynamic minimum height for attachments and toolbar chrome', () => {
    expect(clampFloating(
      { mode: 'floating', x: 200, y: 200, width: 500, height: 120 },
      bounds,
      40,
      240,
    )).toEqual({ mode: 'floating', x: 200, y: 200, width: 500, height: 240 })
  })

  it('snaps to an edge and follows that edge when bounds change', () => {
    const snapped = snapFloating(
      { mode: 'floating', x: 580, y: 200, width: 500, height: 160 },
      bounds,
      40,
    )
    expect(snapped).toEqual({
      mode: 'floating', x: 592, y: 200, width: 500, height: 160, anchor: 'right',
    })
    expect(clampFloating(snapped, {
      left: 0, top: 50, right: 1200, bottom: 750, width: 1200, height: 700,
    }, 40)).toEqual({
      mode: 'floating', x: 692, y: 200, width: 500, height: 160, anchor: 'right',
    })
  })

  it('clears the horizontal anchor when moving away from an edge', () => {
    expect(moveFloating(
      { mode: 'floating', x: 592, y: 200, width: 500, height: 160, anchor: 'right' },
      -100,
      0,
      bounds,
      40,
    )).toEqual({ mode: 'floating', x: 492, y: 200, width: 500, height: 160 })
  })

  it('keeps the opposite edge stable when resizing west and north', () => {
    const origin = { mode: 'floating' as const, x: 300, y: 220, width: 500, height: 200 }
    const resized = resizeFloating(origin, 'nw', 120, 60, bounds, 40)
    expect(resized).toEqual({ mode: 'floating', x: 420, y: 280, width: 380, height: 140 })
    expect(resized.x + resized.width).toBe(origin.x + origin.width)
    expect(resized.y + resized.height).toBe(origin.y + origin.height)
  })

  it('releases an incompatible anchor without moving the opposite resize edge', () => {
    const rightAnchored = { mode: 'floating' as const, x: 592, y: 200, width: 500, height: 160, anchor: 'right' as const }
    const resizedEast = resizeFloating(rightAnchored, 'se', -100, 0, bounds, 40)
    expect(resizedEast).toEqual({ mode: 'floating', x: 592, y: 200, width: 400, height: 160 })

    const leftAnchored = { mode: 'floating' as const, x: 108, y: 200, width: 500, height: 160, anchor: 'left' as const }
    const resizedWest = resizeFloating(leftAnchored, 'nw', 100, 0, bounds, 40)
    expect(resizedWest).toEqual({ mode: 'floating', x: 208, y: 200, width: 400, height: 160 })
  })

  it('preserves a matching anchor and stops growth at the active boundary', () => {
    const rightAnchored = { mode: 'floating' as const, x: 592, y: 200, width: 500, height: 160, anchor: 'right' as const }
    expect(resizeFloating(rightAnchored, 'nw', 100, 0, bounds, 40)).toEqual({
      mode: 'floating', x: 692, y: 200, width: 400, height: 160, anchor: 'right',
    })
    expect(resizeFloating(rightAnchored, 'se', 100, 0, bounds, 40)).toEqual(rightAnchored)
  })
})
