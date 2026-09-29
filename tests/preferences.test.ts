import { describe, expect, it, vi } from 'vitest'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  DEFAULT_PREFERENCES,
  PREFERENCE_FIELDS,
  normalizePreferences,
  type InputAnywherePreferences,
} from '../src/preferences-contract.ts'
import { PreferenceController } from '../src/client/preferences.ts'

type Snapshot = ConfigFormSnapshot<InputAnywherePreferences>

/**
 * Stand-in for the settings provider's shared form. Mirrors the real contract:
 * snapshots are replaced on change, `set`/`unset` report Host acceptance, and
 * `mutate` applies ordered path operations against the current section.
 */
class FormFixture implements ConfigForm<InputAnywherePreferences> {
  private listeners = new Set<() => void>()

  snapshot: Snapshot

  readonly set = vi.fn(async (field: string, value: unknown): Promise<boolean> => {
    if (!this.snapshot.writable) return false
    const next = { ...(this.snapshot.value ?? DEFAULT_PREFERENCES), [field]: value }
    this.replace({
      value: next as InputAnywherePreferences,
      user: { ...record(this.snapshot.user), [field]: value },
      revision: (this.snapshot.revision ?? 0) + 1,
    })
    return true
  })

  readonly unset = vi.fn(async (field: string): Promise<boolean> => {
    if (!this.snapshot.writable) return false
    const value = { ...(this.snapshot.value ?? DEFAULT_PREFERENCES) } as Record<string, unknown>
    delete value[field]
    const user = { ...record(this.snapshot.user) }
    delete user[field]
    this.replace({
      value: normalizePreferences(value),
      user,
      revision: (this.snapshot.revision ?? 0) + 1,
    })
    return true
  })

  readonly mutate = vi.fn(async (ops: readonly SettingsPathOpView[]): Promise<boolean> => {
    if (!this.snapshot.writable) return false
    let value = { ...(this.snapshot.value ?? DEFAULT_PREFERENCES) } as Record<string, unknown>
    const user = { ...record(this.snapshot.user) }
    for (const op of ops) {
      const field = op.path[0]
      if (field === undefined) continue
      if (op.op === 'set') value[field] = op.value
      else {
        delete value[field]
        delete user[field]
      }
    }
    this.replace({
      value: normalizePreferences(value),
      user,
      revision: (this.snapshot.revision ?? 0) + 1,
    })
    return true
  })

  constructor(snapshot: Partial<Snapshot> = {}) {
    this.snapshot = {
      status: 'ready',
      value: { ...DEFAULT_PREFERENCES },
      base: undefined,
      user: undefined,
      revision: 1,
      writable: true,
      mode: 'host',
      ...snapshot,
    }
  }

  getSnapshot = (): Snapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  replace(patch: Partial<Snapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }

  refuseNextWrite(): void {
    this.set.mockResolvedValueOnce(false)
    this.mutate.mockResolvedValueOnce(false)
  }

  hideNamespace(): void {
    this.replace({ status: 'unavailable', value: undefined })
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

describe('input-anywhere preferences', () => {
  it('fills defaults and clamps persisted opacity values', () => {
    expect(normalizePreferences({
      enabled: false,
      surfaceMode: 'invalid',
      surfaceOpacity: -2,
      controlsMode: 'custom',
      controlsOpacity: 2,
      overlapAware: false,
      overlapIdleOpacity: Number.NaN,
      overlapActiveOpacity: 0.6,
    })).toEqual({
      ...DEFAULT_PREFERENCES,
      enabled: false,
      surfaceOpacity: 0.2,
      controlsMode: 'custom',
      controlsOpacity: 1,
      overlapAware: false,
      overlapActiveOpacity: 0.6,
    })
  })

  it('derives the render snapshot from the shared form and keeps it stable', () => {
    const form = new FormFixture()
    const controller = new PreferenceController(form)

    expect(controller.getSnapshot()).toBe(controller.getSnapshot())
    expect(controller.getSnapshot()).toEqual({
      preferences: { ...DEFAULT_PREFERENCES },
      status: 'ready',
      writable: true,
      persistence: 'host',
    })
  })

  it('reports loading and host-only transport states before the first accepted section', () => {
    const form = new FormFixture({
      status: 'loading',
      value: undefined,
      revision: undefined,
      writable: false,
      mode: 'memory',
    })
    const controller = new PreferenceController(form)

    expect(controller.getSnapshot()).toMatchObject({ status: 'loading', persistence: 'memory' })
    form.replace({ status: 'ready', mode: 'host', writable: true })
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', persistence: 'host' })
  })

  it('falls back to defaults while the Host serves no section for the namespace', () => {
    const form = new FormFixture({ status: 'unavailable', value: undefined, writable: false })
    const controller = new PreferenceController(form)

    expect(controller.getSnapshot()).toEqual({
      preferences: { ...DEFAULT_PREFERENCES },
      status: 'unavailable',
      writable: false,
      persistence: 'host',
    })
  })

  it('notifies subscribers when the form publishes a new section', () => {
    const form = new FormFixture()
    const controller = new PreferenceController(form)
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)

    form.replace({ value: { ...DEFAULT_PREFERENCES, enabled: false } })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().preferences.enabled).toBe(false)

    unsubscribe()
    form.replace({ value: { ...DEFAULT_PREFERENCES } })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('writes one field through the shared form', async () => {
    const form = new FormFixture()
    const controller = new PreferenceController(form)

    await controller.set('surfaceOpacity', 0.65)
    expect(form.set).toHaveBeenCalledWith('surfaceOpacity', 0.65)
    expect(controller.getSnapshot().preferences.surfaceOpacity).toBe(0.65)
  })

  it('surfaces a Host refusal as a rejected write', async () => {
    const form = new FormFixture()
    const controller = new PreferenceController(form)
    form.refuseNextWrite()

    await expect(controller.set('enabled', false)).rejects.toThrow('enabled')
    expect(controller.getSnapshot().preferences.enabled).toBe(true)
  })

  it('resets every field in one atomic unset mutation', async () => {
    const form = new FormFixture({
      value: { ...DEFAULT_PREFERENCES, enabled: false, surfaceMode: 'custom' },
      user: { enabled: false, surfaceMode: 'custom' },
    })
    const controller = new PreferenceController(form)

    await controller.reset()
    expect(form.mutate).toHaveBeenCalledTimes(1)
    expect(form.mutate.mock.calls[0]?.[0]).toEqual(
      PREFERENCE_FIELDS.map(field => ({ op: 'unset', path: [field] })),
    )
    expect(controller.getSnapshot().preferences).toEqual(DEFAULT_PREFERENCES)
    expect(form.snapshot.user).toEqual({})
  })

  it('surfaces a refused reset', async () => {
    const form = new FormFixture({
      value: { ...DEFAULT_PREFERENCES, enabled: false },
      user: { enabled: false },
    })
    const controller = new PreferenceController(form)
    form.refuseNextWrite()

    await expect(controller.reset()).rejects.toThrow('reset')
  })

  it('stops deriving and rejects writes after disposal', async () => {
    const form = new FormFixture()
    const controller = new PreferenceController(form)
    const listener = vi.fn()
    controller.subscribe(listener)
    controller.dispose()

    form.replace({ value: { ...DEFAULT_PREFERENCES, enabled: false } })
    expect(listener).not.toHaveBeenCalled()
    await expect(controller.set('enabled', false)).rejects.toThrow('disposed')
    await expect(controller.reset()).rejects.toThrow('disposed')
  })
})
