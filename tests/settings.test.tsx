// @vitest-environment happy-dom

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFERENCES, type InputAnywherePreferences } from '../src/preferences-contract.ts'
import { InputAnywhereSettings } from '../src/client/InputAnywhereSettings.tsx'
import { en, type InputAnywhereTranslate } from '../src/client/locales.ts'
import type { PreferenceSnapshot, PreferenceStore } from '../src/client/preferences.ts'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ children, icon, variant: _variant, size: _size, ...props }: {
    children?: ReactNode
    icon?: ReactNode
    variant?: string
    size?: string
  } & ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{icon}{children}</button>,
  IconRefreshOutline16: () => null,
}))

const t: InputAnywhereTranslate = key => en[key]

class TestPreferenceStore implements PreferenceStore {
  readonly setCalls: Array<readonly [keyof InputAnywherePreferences, unknown]> = []
  resetCalls = 0
  private listeners = new Set<() => void>()
  private snapshot: PreferenceSnapshot

  constructor(
    preferences: InputAnywherePreferences = { ...DEFAULT_PREFERENCES },
    writable = true,
    persistence: PreferenceSnapshot['persistence'] = 'host',
    status: PreferenceSnapshot['status'] = 'ready',
  ) {
    this.snapshot = { preferences, status, writable, persistence }
  }

  getSnapshot = (): PreferenceSnapshot => this.snapshot

  updateSnapshot(patch: Partial<PreferenceSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async set<K extends keyof InputAnywherePreferences>(
    field: K,
    value: InputAnywherePreferences[K],
  ): Promise<void> {
    this.setCalls.push([field, value])
    this.snapshot = {
      ...this.snapshot,
      preferences: { ...this.snapshot.preferences, [field]: value },
    }
    for (const listener of this.listeners) listener()
  }

  async reset(): Promise<void> {
    this.resetCalls += 1
    this.snapshot = { ...this.snapshot, preferences: { ...DEFAULT_PREFERENCES } }
    for (const listener of this.listeners) listener()
  }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('InputAnywhereSettings', () => {
  it('edits feature, mode, and opacity fields through the preference store', async () => {
    const store = new TestPreferenceStore()
    render(<InputAnywhereSettings preferences={store} t={t} />)

    fireEvent.click(screen.getByRole('switch', { name: en.enabled }))
    expect(store.setCalls).toContainEqual(['enabled', false])
    fireEvent.click(screen.getByRole('switch', { name: en.enabled }))

    const surfaceGroup = screen.getByRole('radiogroup', { name: en.surfaceMode })
    fireEvent.click(within(surfaceGroup).getByRole('radio', { name: en.surfaceCustom }))
    expect(store.setCalls).toContainEqual(['surfaceMode', 'custom'])
    const slider = screen.getByRole('slider', { name: en.surfaceOpacity })
    fireEvent.change(slider, { target: { value: '65' } })
    expect(store.setCalls).toContainEqual(['surfaceOpacity', 0.65])

    fireEvent.click(screen.getByRole('button', { name: en.resetSettings }))
    expect(store.resetCalls).toBe(1)
  })

  it('disables writes when the settings transport is read-only', () => {
    const store = new TestPreferenceStore({ ...DEFAULT_PREFERENCES }, false)
    render(<InputAnywhereSettings preferences={store} t={t} />)

    expect((screen.getByRole('switch', { name: en.enabled }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: en.resetSettings }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('reports when fallback settings cannot persist beyond the page', () => {
    const store = new TestPreferenceStore({ ...DEFAULT_PREFERENCES }, true, 'memory', 'local')
    render(<InputAnywhereSettings preferences={store} t={t} />)

    expect(screen.getByText(en.memoryOnly)).toBeDefined()
    expect((screen.getByRole('switch', { name: en.enabled }) as HTMLInputElement).disabled).toBe(false)
  })

  it('surfaces a failed settings write and clears it after Host confirmation', async () => {
    const store = new TestPreferenceStore()
    store.updateSnapshot({ status: 'local', persistence: 'browser' })
    vi.spyOn(store, 'set').mockRejectedValueOnce(new Error('write denied'))
    render(<InputAnywhereSettings preferences={store} t={t} />)

    fireEvent.click(screen.getByRole('switch', { name: en.enabled }))
    expect((await screen.findByRole('alert')).textContent).toBe(en.saveError)

    act(() => { store.updateSnapshot({ status: 'ready', persistence: 'host' }) })
    await vi.waitFor(() => { expect(screen.queryByRole('alert')).toBeNull() })
  })
})
