/** Host half: register the durable preference namespace used by the Client settings page. */
import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import {
  ADAPTIVE_OPACITY_MODES,
  CONTROL_OPACITY_MODES,
  DEFAULT_PREFERENCES,
  SETTINGS_NAMESPACE,
  SURFACE_MODES,
  type InputAnywherePreferences,
} from './preferences-contract.ts'

export const name = 'dsh-input-anywhere'

export const InputAnywherePreferencesSchema: z<InputAnywherePreferences> = z.object({
  enabled: z.boolean().default(DEFAULT_PREFERENCES.enabled),
  surfaceMode: z.union([...SURFACE_MODES]).default(DEFAULT_PREFERENCES.surfaceMode),
  surfaceOpacity: z.number().min(0.2).max(1).default(DEFAULT_PREFERENCES.surfaceOpacity),
  controlsMode: z.union([...CONTROL_OPACITY_MODES]).default(DEFAULT_PREFERENCES.controlsMode),
  controlsOpacity: z.number().min(0.2).max(1).default(DEFAULT_PREFERENCES.controlsOpacity),
  overlapAware: z.boolean().default(DEFAULT_PREFERENCES.overlapAware),
  overlapIdleMode: z.union([...ADAPTIVE_OPACITY_MODES]).default(DEFAULT_PREFERENCES.overlapIdleMode),
  overlapIdleOpacity: z.number().min(0.2).max(1).default(DEFAULT_PREFERENCES.overlapIdleOpacity),
  overlapActiveMode: z.union([...ADAPTIVE_OPACITY_MODES]).default(DEFAULT_PREFERENCES.overlapActiveMode),
  overlapActiveOpacity: z.number().min(0.2).max(1).default(DEFAULT_PREFERENCES.overlapActiveOpacity),
})

export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      settingsNamespace(SETTINGS_NAMESPACE),
      InputAnywherePreferencesSchema,
    )
  })
}

export type {
  ControlOpacityMode,
  InputAnywherePreferences,
  SurfaceMode,
} from './preferences-contract.ts'
