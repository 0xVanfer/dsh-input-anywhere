import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import {
  DEFAULT_PREFERENCES,
  PREFERENCE_FIELDS,
  normalizePreferences,
  type InputAnywherePreferences,
} from '../preferences-contract.ts'

export const LOCAL_PREFERENCES_KEY = 'dsh-input-anywhere:preferences:v1'

export interface PreferenceSnapshot {
  preferences: InputAnywherePreferences
  status: Exclude<SettingsScopeSnapshot<InputAnywherePreferences>['status'], 'unavailable'> | 'default' | 'local'
  writable: boolean
  persistence: 'host' | 'browser' | 'memory'
}

export interface PreferenceStore {
  getSnapshot(): PreferenceSnapshot
  subscribe(listener: () => void): () => void
  set<K extends keyof InputAnywherePreferences>(field: K, value: InputAnywherePreferences[K]): Promise<void>
  reset(): Promise<void>
}

type LocalOperation = 'set' | 'unset'
type LocalOperations = Partial<Record<keyof InputAnywherePreferences, LocalOperation>>

interface LocalPreferenceRecord {
  version: 1
  values: InputAnywherePreferences
  operations: LocalOperations
}

const DEFAULT_SNAPSHOT: PreferenceSnapshot = Object.freeze({
  preferences: { ...DEFAULT_PREFERENCES },
  status: 'default',
  writable: false,
  persistence: 'memory',
})

export const defaultPreferenceStore: PreferenceStore = {
  getSnapshot: () => DEFAULT_SNAPSHOT,
  subscribe: () => () => {},
  set: async () => {},
  reset: async () => {},
}

function defaultStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

function allOperations(operation: LocalOperation): LocalOperations {
  return Object.fromEntries(PREFERENCE_FIELDS.map(field => [field, operation])) as LocalOperations
}

function decodeLocalRecord(value: unknown): LocalPreferenceRecord | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const input = value as Record<string, unknown>
  if (input.version === 1 && typeof input.operations === 'object' && input.operations !== null) {
    const source = input.operations as Record<string, unknown>
    const operations: LocalOperations = {}
    for (const field of PREFERENCE_FIELDS) {
      const operation = source[field]
      if (operation === 'set' || operation === 'unset') operations[field] = operation
    }
    return { version: 1, values: normalizePreferences(input.values), operations }
  }

  // Development builds before the operation log stored a complete preference object.
  if (!PREFERENCE_FIELDS.some(field => field in input)) return undefined
  return {
    version: 1,
    values: normalizePreferences(input),
    operations: allOperations('set'),
  }
}

function userRecord(snapshot: SettingsScopeSnapshot<InputAnywherePreferences>): Record<string, unknown> | undefined {
  return typeof snapshot.user === 'object' && snapshot.user !== null
    ? snapshot.user as Record<string, unknown>
    : undefined
}

export class PreferenceController implements PreferenceStore {
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribeScope: () => void
  private wireSnapshot: SettingsScopeSnapshot<InputAnywherePreferences> | undefined
  private localPreferences: InputAnywherePreferences | undefined
  private localOperations: LocalOperations = {}
  private snapshot: PreferenceSnapshot = DEFAULT_SNAPSHOT
  private migrationTask: Promise<void> | undefined
  private storagePersistent: boolean
  private disposed = false

  constructor(
    private readonly scope: SettingsScope<InputAnywherePreferences>,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined = defaultStorage(),
  ) {
    this.storagePersistent = storage !== undefined
    const local = this.readLocal()
    this.localPreferences = local?.values
    this.localOperations = local?.operations ?? {}
    this.unsubscribeScope = this.scope.subscribe(() => {
      if (this.disposed) return
      this.invalidate()
      this.publish()
      void this.migrateLocal().catch(() => {})
    })
    void this.migrateLocal().catch(() => {})
  }

  getSnapshot = (): PreferenceSnapshot => {
    const wire = this.scope.getSnapshot()
    if (wire === this.wireSnapshot) return this.snapshot
    this.wireSnapshot = wire
    this.snapshot = this.localPreferences !== undefined || wire.status === 'unavailable'
      ? {
          preferences: this.localPreferences ?? { ...DEFAULT_PREFERENCES },
          status: 'local',
          writable: true,
          persistence: this.storagePersistent ? 'browser' : 'memory',
        }
      : {
          preferences: normalizePreferences(wire.value),
          status: wire.status,
          writable: wire.writable,
          persistence: wire.status === 'ready' ? 'host' : 'memory',
        }
    return this.snapshot
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async set<K extends keyof InputAnywherePreferences>(
    field: K,
    value: InputAnywherePreferences[K],
  ): Promise<void> {
    await this.migrationTask?.catch(() => {})
    if (this.disposed) throw new Error('Preference controller is disposed')
    const wire = this.scope.getSnapshot()
    const preferences = normalizePreferences({
      ...(this.localPreferences ?? normalizePreferences(wire.value)),
      [field]: value,
    })
    this.localPreferences = preferences
    this.localOperations = { ...this.localOperations, [field]: 'set' }
    this.persistAndPublish()
    await this.migrateLocal()
  }

  async reset(): Promise<void> {
    await this.migrationTask?.catch(() => {})
    if (this.disposed) throw new Error('Preference controller is disposed')
    this.localPreferences = { ...DEFAULT_PREFERENCES }
    this.localOperations = allOperations('unset')
    this.persistAndPublish()
    await this.migrateLocal()
  }

  dispose(): void {
    this.disposed = true
    this.unsubscribeScope()
    this.listeners.clear()
  }

  private invalidate(): void {
    this.wireSnapshot = undefined
  }

  private publish(): void {
    if (this.disposed) return
    for (const listener of this.listeners) listener()
  }

  private persistAndPublish(): void {
    this.writeLocal()
    this.invalidate()
    this.publish()
  }

  private readLocal(): LocalPreferenceRecord | undefined {
    if (this.storage === undefined) return undefined
    let raw: string | null
    try {
      raw = this.storage.getItem(LOCAL_PREFERENCES_KEY)
    } catch {
      this.storagePersistent = false
      return undefined
    }
    if (raw === null) return undefined
    try {
      const decoded = decodeLocalRecord(JSON.parse(raw))
      if (decoded !== undefined) return decoded
    } catch {
      // Remove malformed records below when storage remains writable.
    }
    try {
      this.storage.removeItem(LOCAL_PREFERENCES_KEY)
      this.storagePersistent = true
    } catch {
      this.storagePersistent = false
    }
    return undefined
  }

  private writeLocal(): void {
    if (this.storage === undefined || this.localPreferences === undefined) {
      this.storagePersistent = false
      return
    }
    try {
      this.storage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify({
        version: 1,
        values: this.localPreferences,
        operations: this.localOperations,
      } satisfies LocalPreferenceRecord))
      this.storagePersistent = true
    } catch {
      this.storagePersistent = false
    }
  }

  private clearLocal(): void {
    this.localPreferences = undefined
    this.localOperations = {}
    if (this.storage !== undefined) {
      try {
        this.storage.removeItem(LOCAL_PREFERENCES_KEY)
      } catch {
        this.storagePersistent = false
      }
    }
  }

  private operationCommitted(
    field: keyof InputAnywherePreferences,
    operation: LocalOperation,
    value: InputAnywherePreferences[keyof InputAnywherePreferences],
  ): boolean {
    const snapshot = this.scope.getSnapshot()
    if (snapshot.status !== 'ready' || snapshot.revision === undefined) return false
    const user = userRecord(snapshot)
    if (operation === 'unset') return user === undefined || !Object.hasOwn(user, field)
    return user !== undefined
      && Object.hasOwn(user, field)
      && Object.is(user[field], value)
      && Object.is(normalizePreferences(snapshot.value)[field], value)
  }

  private migrateLocal(): Promise<void> {
    if (this.migrationTask !== undefined) return this.migrationTask
    if (this.localPreferences === undefined || this.disposed) return Promise.resolve()
    const wire = this.scope.getSnapshot()
    if (wire.status !== 'ready' || !wire.writable) return Promise.resolve()

    const migration = Promise.resolve().then(async () => {
      for (const field of PREFERENCE_FIELDS) {
        if (this.disposed || this.localPreferences === undefined) return
        const operation = this.localOperations[field]
        if (operation === undefined) continue
        const value = this.localPreferences[field]
        if (operation === 'set') await this.scope.set(field, value)
        else await this.scope.unset(field)
        if (this.disposed) return
        if (!this.operationCommitted(field, operation, value)) {
          throw new Error(`Host did not commit preference field: ${field}`)
        }
        const remaining = { ...this.localOperations }
        delete remaining[field]
        this.localOperations = remaining
        this.writeLocal()
      }
      if (this.disposed || PREFERENCE_FIELDS.some(field => this.localOperations[field] !== undefined)) return
      this.clearLocal()
      this.invalidate()
      this.publish()
    })
    const task = migration.finally(() => {
      if (this.migrationTask === task) this.migrationTask = undefined
    })
    this.migrationTask = task
    return task
  }
}
