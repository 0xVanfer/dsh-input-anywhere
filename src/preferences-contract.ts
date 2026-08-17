export const SETTINGS_NAMESPACE = 'dsh-input-anywhere'

export const SURFACE_MODES = ['theme', 'custom', 'opaque'] as const
export type SurfaceMode = typeof SURFACE_MODES[number]

export const CONTROL_OPACITY_MODES = ['surface', 'custom', 'opaque'] as const
export type ControlOpacityMode = typeof CONTROL_OPACITY_MODES[number]

export const ADAPTIVE_OPACITY_MODES = ['surface', 'custom'] as const
export type AdaptiveOpacityMode = typeof ADAPTIVE_OPACITY_MODES[number]

export interface InputAnywherePreferences {
  enabled: boolean
  surfaceMode: SurfaceMode
  surfaceOpacity: number
  controlsMode: ControlOpacityMode
  controlsOpacity: number
  overlapAware: boolean
  overlapIdleMode: AdaptiveOpacityMode
  overlapIdleOpacity: number
  overlapActiveMode: AdaptiveOpacityMode
  overlapActiveOpacity: number
}

export const DEFAULT_PREFERENCES: Readonly<InputAnywherePreferences> = Object.freeze({
  enabled: true,
  surfaceMode: 'theme',
  surfaceOpacity: 0.78,
  controlsMode: 'surface',
  controlsOpacity: 0.9,
  overlapAware: true,
  overlapIdleMode: 'surface',
  overlapIdleOpacity: 0.45,
  overlapActiveMode: 'custom',
  overlapActiveOpacity: 0.92,
})

export const PREFERENCE_FIELDS = Object.freeze([
  'enabled',
  'surfaceMode',
  'surfaceOpacity',
  'controlsMode',
  'controlsOpacity',
  'overlapAware',
  'overlapIdleMode',
  'overlapIdleOpacity',
  'overlapActiveMode',
  'overlapActiveOpacity',
] as const satisfies readonly (keyof InputAnywherePreferences)[])

function opacity(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0.2, value))
    : fallback
}

export function normalizePreferences(value: unknown): InputAnywherePreferences {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_PREFERENCES }
  const input = value as Partial<Record<keyof InputAnywherePreferences, unknown>>
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_PREFERENCES.enabled,
    surfaceMode: SURFACE_MODES.includes(input.surfaceMode as SurfaceMode)
      ? input.surfaceMode as SurfaceMode
      : DEFAULT_PREFERENCES.surfaceMode,
    surfaceOpacity: opacity(input.surfaceOpacity, DEFAULT_PREFERENCES.surfaceOpacity),
    controlsMode: CONTROL_OPACITY_MODES.includes(input.controlsMode as ControlOpacityMode)
      ? input.controlsMode as ControlOpacityMode
      : DEFAULT_PREFERENCES.controlsMode,
    controlsOpacity: opacity(input.controlsOpacity, DEFAULT_PREFERENCES.controlsOpacity),
    overlapAware: typeof input.overlapAware === 'boolean'
      ? input.overlapAware
      : DEFAULT_PREFERENCES.overlapAware,
    overlapIdleMode: ADAPTIVE_OPACITY_MODES.includes(input.overlapIdleMode as AdaptiveOpacityMode)
      ? input.overlapIdleMode as AdaptiveOpacityMode
      : DEFAULT_PREFERENCES.overlapIdleMode,
    overlapIdleOpacity: opacity(input.overlapIdleOpacity, DEFAULT_PREFERENCES.overlapIdleOpacity),
    overlapActiveMode: ADAPTIVE_OPACITY_MODES.includes(input.overlapActiveMode as AdaptiveOpacityMode)
      ? input.overlapActiveMode as AdaptiveOpacityMode
      : DEFAULT_PREFERENCES.overlapActiveMode,
    overlapActiveOpacity: opacity(input.overlapActiveOpacity, DEFAULT_PREFERENCES.overlapActiveOpacity),
  }
}
