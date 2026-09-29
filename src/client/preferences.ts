/**
 * Client preference adapter over the settings domain's shared config form.
 *
 * The Host owns durability (the profile patch layer); this module owns the
 * shape the composer and the settings page render: resolved preference values,
 * plus the transport state the page reports.
 */
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  DEFAULT_PREFERENCES,
  PREFERENCE_FIELDS,
  normalizePreferences,
  type InputAnywherePreferences,
} from '../preferences-contract.ts'

export interface PreferenceSnapshot {
  preferences: InputAnywherePreferences
  status: 'loading' | 'ready' | 'unavailable'
  writable: boolean
  persistence: 'host' | 'memory'
}

export interface PreferenceStore {
  getSnapshot(): PreferenceSnapshot
  subscribe(listener: () => void): () => void
  set<K extends keyof InputAnywherePreferences>(field: K, value: InputAnywherePreferences[K]): Promise<void>
  reset(): Promise<void>
}

const DEFAULT_SNAPSHOT: PreferenceSnapshot = Object.freeze({
  preferences: { ...DEFAULT_PREFERENCES },
  status: 'loading',
  writable: false,
  persistence: 'memory',
})

export const defaultPreferenceStore: PreferenceStore = {
  getSnapshot: () => DEFAULT_SNAPSHOT,
  subscribe: () => () => {},
  set: async () => {},
  reset: async () => {},
}

type FormSnapshot = ReturnType<ConfigForm<InputAnywherePreferences>['getSnapshot']>

/**
 * Derive the render snapshot from one config-form snapshot. The form snapshot
 * is the change currency: an unchanged form snapshot reuses the derived object,
 * which keeps `useSyncExternalStore` from re-rendering on unrelated ticks.
 * @param snapshot - current shared config-form snapshot.
 * @returns the derived preference snapshot.
 */
function derive(snapshot: FormSnapshot): PreferenceSnapshot {
  return {
    preferences: normalizePreferences(snapshot.value),
    status: snapshot.status,
    writable: snapshot.writable,
    persistence: snapshot.mode === 'host' ? 'host' : 'memory',
  }
}

export class PreferenceController implements PreferenceStore {
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribe: () => void
  private source: FormSnapshot | undefined
  private snapshot: PreferenceSnapshot = DEFAULT_SNAPSHOT
  private disposed = false

  /** @param form - the settings provider's shared form for this plugin's namespace. */
  constructor(private readonly form: ConfigForm<InputAnywherePreferences>) {
    this.unsubscribe = form.subscribe(() => { this.publish() })
  }

  getSnapshot = (): PreferenceSnapshot => {
    const source = this.form.getSnapshot()
    if (source === this.source) return this.snapshot
    this.source = source
    this.snapshot = derive(source)
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
    if (this.disposed) throw new Error('Preference controller is disposed')
    if (!await this.form.set(field, value)) {
      throw new Error(`Host refused preference field: ${field}`)
    }
  }

  /** Clear every user override in one atomic mutation so the form re-inherits its defaults. */
  async reset(): Promise<void> {
    if (this.disposed) throw new Error('Preference controller is disposed')
    const ops = PREFERENCE_FIELDS.map(field => ({ op: 'unset' as const, path: [field] }))
    if (!await this.form.mutate(ops)) throw new Error('Host refused the preference reset')
  }

  /** Stop deriving. The shared form belongs to the settings provider, so it is not disposed here. */
  dispose(): void {
    this.disposed = true
    this.unsubscribe()
    this.listeners.clear()
  }

  private publish(): void {
    if (this.disposed) return
    for (const listener of this.listeners) listener()
  }
}
