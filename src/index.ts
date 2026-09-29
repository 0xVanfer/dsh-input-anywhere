/**
 * Host half. The Client owns the whole preference surface, so this half only
 * declares the live Config schema the settings form edits and opts out of the
 * schema-generated page.
 *
 * Every field is `volatile()`: the settings service refuses writes to a field
 * whose nearest volatile ancestor is absent, and only volatile fields are
 * projected into the editable form.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import {
  ADAPTIVE_OPACITY_MODES,
  CONTROL_OPACITY_MODES,
  DEFAULT_PREFERENCES,
  SURFACE_MODES,
} from './preferences-contract.ts'

export const name = 'dsh-input-anywhere'

/** Live preference schema; also the envelope the Client form validates its reads against. */
export const Config = z.object({
  enabled: z.boolean().default(DEFAULT_PREFERENCES.enabled).volatile(),
  surfaceMode: z.union([...SURFACE_MODES]).default(DEFAULT_PREFERENCES.surfaceMode).volatile(),
  surfaceOpacity: z.number().min(0.2).max(1).default(DEFAULT_PREFERENCES.surfaceOpacity).volatile(),
  controlsMode: z.union([...CONTROL_OPACITY_MODES]).default(DEFAULT_PREFERENCES.controlsMode).volatile(),
  controlsOpacity: z.number().min(0.2).max(1).default(DEFAULT_PREFERENCES.controlsOpacity).volatile(),
  overlapAware: z.boolean().default(DEFAULT_PREFERENCES.overlapAware).volatile(),
  overlapIdleMode: z.union([...ADAPTIVE_OPACITY_MODES]).default(DEFAULT_PREFERENCES.overlapIdleMode).volatile(),
  overlapIdleOpacity: z.number().min(0.2).max(1).default(DEFAULT_PREFERENCES.overlapIdleOpacity).volatile(),
  overlapActiveMode: z.union([...ADAPTIVE_OPACITY_MODES]).default(DEFAULT_PREFERENCES.overlapActiveMode).volatile(),
  overlapActiveOpacity: z.number().min(0.2).max(1).default(DEFAULT_PREFERENCES.overlapActiveOpacity).volatile(),
})

/**
 * Host body. The only work is claiming the page: this plugin renders its own
 * `settings.section`, so the settings service must not also generate one.
 * @param ctx - host plugin context.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber))
  })
}

export type {
  ControlOpacityMode,
  InputAnywherePreferences,
  SurfaceMode,
} from './preferences-contract.ts'
