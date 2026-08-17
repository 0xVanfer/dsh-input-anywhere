import { describe, expect, it, vi } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import {
  DEFAULT_PREFERENCES,
  PREFERENCE_FIELDS,
  normalizePreferences,
  type InputAnywherePreferences,
} from '../src/preferences-contract.ts'
import { PreferenceController } from '../src/client/preferences.ts'

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

class ScopeFixture implements SettingsScope<InputAnywherePreferences> {
  private listeners = new Set<() => void>()
  private failNext = false
  private blocked: Promise<void> | undefined
  private releaseBlocked: (() => void) | undefined

  snapshot: SettingsScopeSnapshot<InputAnywherePreferences>

  readonly set = vi.fn(async (field: string, value: unknown): Promise<void> => {
    const blocked = this.blocked
    this.blocked = undefined
    if (blocked !== undefined) await blocked
    if (this.failNext) {
      this.failNext = false
      this.replace({})
      return
    }
    this.replace({
      value: normalizePreferences({ ...this.snapshot.value, [field]: value }),
      user: { ...record(this.snapshot.user), [field]: value },
      revision: (this.snapshot.revision ?? 0) + 1,
    })
  })

  readonly unset = vi.fn(async (field: string): Promise<void> => {
    const blocked = this.blocked
    this.blocked = undefined
    if (blocked !== undefined) await blocked
    if (this.failNext) {
      this.failNext = false
      this.replace({})
      return
    }
    const user = { ...record(this.snapshot.user) }
    delete user[field]
    const value = { ...this.snapshot.value } as Record<string, unknown>
    delete value[field]
    this.replace({
      value: normalizePreferences(value),
      user,
      revision: (this.snapshot.revision ?? 0) + 1,
    })
  })

  constructor(snapshot: Partial<SettingsScopeSnapshot<InputAnywherePreferences>> = {}) {
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

  getSnapshot = (): SettingsScopeSnapshot<InputAnywherePreferences> => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  replace(patch: Partial<SettingsScopeSnapshot<InputAnywherePreferences>>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }

  resolveNextWriteWithoutCommit(): void {
    this.failNext = true
  }

  blockNextWrite(): () => void {
    this.blocked = new Promise<void>((resolve) => { this.releaseBlocked = resolve })
    return () => {
      this.releaseBlocked?.()
      this.releaseBlocked = undefined
    }
  }
}

function memoryStorage(initial: string | null = null): {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  read: () => string | null
} {
  let stored = initial
  return {
    storage: {
      getItem: () => stored,
      setItem: (_key, value) => { stored = value },
      removeItem: () => { stored = null },
    },
    read: () => stored,
  }
}

function localRecord(
  values: InputAnywherePreferences,
  operations: Partial<Record<keyof InputAnywherePreferences, 'set' | 'unset'>>,
): string {
  return JSON.stringify({ version: 1, values, operations })
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

  it('keeps settings writable locally and migrates reset as verified Host unsets', async () => {
    const stored = memoryStorage()
    const scope = new ScopeFixture({
      status: 'unavailable',
      value: undefined,
      user: undefined,
      revision: undefined,
      writable: false,
    })
    const controller = new PreferenceController(scope, stored.storage)

    expect(controller.getSnapshot()).toMatchObject({
      status: 'local',
      writable: true,
      persistence: 'browser',
    })
    await controller.set('enabled', false)
    expect(controller.getSnapshot().preferences.enabled).toBe(false)
    expect(JSON.parse(stored.read() ?? '{}')).toMatchObject({
      version: 1,
      values: { enabled: false },
      operations: { enabled: 'set' },
    })

    await controller.reset()
    expect(controller.getSnapshot().preferences).toEqual(DEFAULT_PREFERENCES)
    expect(JSON.parse(stored.read() ?? '{}')).toMatchObject({
      operations: Object.fromEntries(PREFERENCE_FIELDS.map(field => [field, 'unset'])),
    })

    scope.replace({
      status: 'ready',
      value: { ...DEFAULT_PREFERENCES, enabled: false },
      user: { enabled: false },
      writable: true,
      revision: 1,
    })
    await vi.waitFor(() => {
      expect(scope.unset).toHaveBeenCalledTimes(PREFERENCE_FIELDS.length)
      expect(stored.read()).toBeNull()
    })
    expect(scope.set).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('serializes reset behind an in-flight verified migration', async () => {
    const stored = memoryStorage(localRecord(
      { ...DEFAULT_PREFERENCES, enabled: false },
      { enabled: 'set' },
    ))
    const scope = new ScopeFixture()
    const release = scope.blockNextWrite()
    const controller = new PreferenceController(scope, stored.storage)

    const reset = controller.reset()
    await Promise.resolve()
    expect(scope.unset).not.toHaveBeenCalled()
    release()
    await reset

    expect(scope.set).toHaveBeenCalledTimes(1)
    expect(scope.set).toHaveBeenCalledWith('enabled', false)
    expect(scope.unset).toHaveBeenCalledTimes(PREFERENCE_FIELDS.length)
    expect(stored.read()).toBeNull()
    controller.dispose()
  })

  it('retains an online write journal when the real scope resolves without committing', async () => {
    const stored = memoryStorage()
    const scope = new ScopeFixture()
    const controller = new PreferenceController(scope, stored.storage)
    scope.resolveNextWriteWithoutCommit()

    await expect(controller.set('surfaceOpacity', 0.65)).rejects.toThrow('surfaceOpacity')
    await Promise.resolve()
    expect(scope.set).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot()).toMatchObject({
      status: 'local',
      preferences: { surfaceOpacity: 0.65 },
    })
    expect(JSON.parse(stored.read() ?? '{}')).toMatchObject({
      operations: { surfaceOpacity: 'set' },
    })

    scope.replace({})
    await vi.waitFor(() => {
      expect(stored.read()).toBeNull()
      expect(scope.snapshot.user).toMatchObject({ surfaceOpacity: 0.65 })
    })
    controller.dispose()
  })

  it('retains all pending reset operations when a Host unset resolves without committing', async () => {
    const stored = memoryStorage()
    const scope = new ScopeFixture({
      value: { ...DEFAULT_PREFERENCES, enabled: false },
      user: { enabled: false },
    })
    const controller = new PreferenceController(scope, stored.storage)
    scope.resolveNextWriteWithoutCommit()

    await expect(controller.reset()).rejects.toThrow('enabled')
    expect(controller.getSnapshot().preferences).toEqual(DEFAULT_PREFERENCES)
    expect(JSON.parse(stored.read() ?? '{}')).toMatchObject({
      operations: Object.fromEntries(PREFERENCE_FIELDS.map(field => [field, 'unset'])),
    })

    scope.replace({})
    await vi.waitFor(() => {
      expect(stored.read()).toBeNull()
      expect(scope.snapshot.user).toEqual({})
    })
    controller.dispose()
  })

  it('persists only unconfirmed operations after a partial migration', async () => {
    const stored = memoryStorage(localRecord(
      { ...DEFAULT_PREFERENCES, enabled: false, surfaceMode: 'custom' },
      { enabled: 'set', surfaceMode: 'set' },
    ))
    const scope = new ScopeFixture()
    let writes = 0
    scope.set.mockImplementation(async (field: string, value: unknown) => {
      writes += 1
      if (writes === 2) return
      scope.replace({
        value: normalizePreferences({ ...scope.snapshot.value, [field]: value }),
        user: { ...record(scope.snapshot.user), [field]: value },
        revision: (scope.snapshot.revision ?? 0) + 1,
      })
    })
    const controller = new PreferenceController(scope, stored.storage)

    await vi.waitFor(() => {
      expect(scope.set).toHaveBeenCalledTimes(2)
      expect(JSON.parse(stored.read() ?? '{}')).toMatchObject({
        operations: { surfaceMode: 'set' },
      })
    })
    expect(JSON.parse(stored.read() ?? '{}').operations).not.toHaveProperty('enabled')
    expect(scope.snapshot.user).toMatchObject({ enabled: false })

    scope.set.mockImplementation(async (field: string, value: unknown) => {
      scope.replace({
        value: normalizePreferences({ ...scope.snapshot.value, [field]: value }),
        user: { ...record(scope.snapshot.user), [field]: value },
        revision: (scope.snapshot.revision ?? 0) + 1,
      })
    })
    scope.replace({})
    await vi.waitFor(() => {
      expect(stored.read()).toBeNull()
      expect(scope.snapshot.user).toMatchObject({ enabled: false, surfaceMode: 'custom' })
    })
    controller.dispose()
  })

  it('preserves unrelated external fields across a revision-conflict retry', async () => {
    const stored = memoryStorage(localRecord(
      { ...DEFAULT_PREFERENCES, enabled: false },
      { enabled: 'set' },
    ))
    const scope = new ScopeFixture({
      value: { ...DEFAULT_PREFERENCES, controlsMode: 'custom' },
      user: { controlsMode: 'custom' },
      revision: 4,
    })
    scope.resolveNextWriteWithoutCommit()
    const controller = new PreferenceController(scope, stored.storage)

    await vi.waitFor(() => {
      expect(scope.set).toHaveBeenCalledTimes(1)
      expect(stored.read()).not.toBeNull()
    })
    await Promise.resolve()
    expect(scope.set).toHaveBeenCalledTimes(1)
    expect(scope.snapshot.user).toEqual({ controlsMode: 'custom' })

    scope.replace({ revision: 5 })
    await vi.waitFor(() => {
      expect(stored.read()).toBeNull()
      expect(scope.snapshot.user).toEqual({ controlsMode: 'custom', enabled: false })
    })
    controller.dispose()
  })

  it('does not clear or continue a journal after disposal during migration', async () => {
    const stored = memoryStorage(localRecord(
      { ...DEFAULT_PREFERENCES, enabled: false, surfaceMode: 'custom' },
      { enabled: 'set', surfaceMode: 'set' },
    ))
    const scope = new ScopeFixture()
    const release = scope.blockNextWrite()
    const controller = new PreferenceController(scope, stored.storage)

    await vi.waitFor(() => { expect(scope.set).toHaveBeenCalledTimes(1) })
    controller.dispose()
    release()
    await vi.waitFor(() => { expect(scope.snapshot.user).toMatchObject({ enabled: false }) })
    expect(scope.set).toHaveBeenCalledTimes(1)
    expect(JSON.parse(stored.read() ?? '{}').operations).toMatchObject({
      enabled: 'set',
      surfaceMode: 'set',
    })
  })

  it('removes a malformed record without misreporting writable storage as blocked', () => {
    let removed = false
    const scope = new ScopeFixture({
      status: 'unavailable',
      value: undefined,
      revision: undefined,
      writable: false,
    })
    const controller = new PreferenceController(scope, {
      getItem: () => '{malformed',
      setItem: () => {},
      removeItem: () => { removed = true },
    })

    expect(removed).toBe(true)
    expect(controller.getSnapshot()).toMatchObject({ status: 'local', persistence: 'browser' })
    controller.dispose()
  })

  it('marks fallback as memory-only when browser storage throws', async () => {
    const scope = new ScopeFixture({
      status: 'unavailable',
      value: undefined,
      revision: undefined,
      writable: false,
    })
    const controller = new PreferenceController(scope, {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    })

    expect(controller.getSnapshot()).toMatchObject({ status: 'local', persistence: 'memory' })
    await controller.set('enabled', false)
    expect(controller.getSnapshot()).toMatchObject({
      status: 'local',
      persistence: 'memory',
      preferences: { enabled: false },
    })
    controller.dispose()
  })

  it('leaves an empty tombstone when browser storage refuses journal removal', async () => {
    let stored = localRecord(
      { ...DEFAULT_PREFERENCES, enabled: false },
      { enabled: 'set' },
    )
    const scope = new ScopeFixture()
    const controller = new PreferenceController(scope, {
      getItem: () => stored,
      setItem: (_key, value) => { stored = value },
      removeItem: () => { throw new Error('blocked') },
    })

    await vi.waitFor(() => {
      expect(scope.snapshot.user).toMatchObject({ enabled: false })
      expect(controller.getSnapshot()).toMatchObject({ status: 'ready', persistence: 'host' })
    })
    expect(JSON.parse(stored).operations).toEqual({})
    controller.dispose()
  })

  it('exposes stable snapshots and confirms direct Host writes and resets', async () => {
    const scope = new ScopeFixture()
    const controller = new PreferenceController(scope)
    expect(controller.getSnapshot()).toBe(controller.getSnapshot())
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      writable: true,
      persistence: 'host',
    })

    await controller.set('surfaceOpacity', 0.65)
    expect(scope.set).toHaveBeenCalledWith('surfaceOpacity', 0.65)

    await controller.reset()
    expect(scope.unset.mock.calls.map(call => call[0])).toEqual([...PREFERENCE_FIELDS])
    expect(controller.getSnapshot().preferences).toEqual(DEFAULT_PREFERENCES)
    controller.dispose()
  })
})
