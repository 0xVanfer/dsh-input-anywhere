import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  AdaptiveOpacityMode,
  ControlOpacityMode,
  InputAnywherePreferences,
  SurfaceMode,
} from '../preferences-contract.ts'
import type { InputAnywhereTranslate } from './locales.ts'
import type { PreferenceStore } from './preferences.ts'

export interface InputAnywhereSettingsInjected {
  preferences: PreferenceStore
  t: InputAnywhereTranslate
}

export type InputAnywhereSettingsProps = InputAnywhereSettingsInjected

function SettingGroup({ title, children }: { title: string, children: ReactNode }): ReactNode {
  return <section className="dsh-input-anywhere-settings-group">
    <h3>{title}</h3>
    <div className="dsh-input-anywhere-settings-group-body">{children}</div>
  </section>
}

function ToggleRow({ label, checked, disabled, onChange }: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}): ReactNode {
  return <label className="dsh-input-anywhere-settings-row">
    <span>{label}</span>
    <span className="dsh-input-anywhere-switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => { onChange(event.currentTarget.checked) }}
      />
      <span aria-hidden="true" />
    </span>
  </label>
}

function Segmented<T extends string>({ label, name, value, disabled, options, onChange }: {
  label: string
  name: string
  value: T
  disabled: boolean
  options: readonly { value: T, label: string }[]
  onChange: (value: T) => void
}): ReactNode {
  return <div className="dsh-input-anywhere-settings-stack">
    <span className="dsh-input-anywhere-settings-label" id={`${name}-label`}>{label}</span>
    <div className="dsh-input-anywhere-segments" role="radiogroup" aria-labelledby={`${name}-label`}>
      {options.map(option => <label key={option.value} className="dsh-input-anywhere-segment">
        <input
          type="radio"
          name={name}
          value={option.value}
          checked={value === option.value}
          disabled={disabled}
          onChange={() => { onChange(option.value) }}
        />
        <span>{option.label}</span>
      </label>)}
    </div>
  </div>
}

function OpacitySlider({ label, value, disabled, onChange }: {
  label: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}): ReactNode {
  const percent = Math.round(value * 100)
  return <label className="dsh-input-anywhere-settings-slider">
    <span>{label}</span>
    <input
      type="range"
      min="20"
      max="100"
      step="5"
      value={percent}
      disabled={disabled}
      onChange={(event) => { onChange(Number(event.currentTarget.value) / 100) }}
    />
    <output>{percent}%</output>
  </label>
}

export function InputAnywhereSettings({ preferences: store, t }: InputAnywhereSettingsProps): ReactNode {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [saveError, setSaveError] = useState(false)
  useEffect(() => {
    if (snapshot.persistence === 'host') setSaveError(false)
  }, [snapshot.persistence])
  const values = snapshot.preferences
  const disabled = !snapshot.writable

  const set = <K extends keyof InputAnywherePreferences>(
    field: K,
    value: InputAnywherePreferences[K],
  ): void => {
    setSaveError(false)
    void store.set(field, value).catch(() => { setSaveError(true) })
  }

  const surfaceOptions: readonly { value: SurfaceMode, label: string }[] = [
    { value: 'theme', label: t('surfaceTheme') },
    { value: 'custom', label: t('surfaceCustom') },
    { value: 'opaque', label: t('surfaceOpaque') },
  ]
  const controlOptions: readonly { value: ControlOpacityMode, label: string }[] = [
    { value: 'surface', label: t('controlsSurface') },
    { value: 'custom', label: t('controlsCustom') },
    { value: 'opaque', label: t('controlsOpaque') },
  ]
  const adaptiveOptions: readonly { value: AdaptiveOpacityMode, label: string }[] = [
    { value: 'surface', label: t('adaptiveSurface') },
    { value: 'custom', label: t('adaptiveCustom') },
  ]

  return <div className="dsh-input-anywhere-settings">
    <header className="dsh-input-anywhere-settings-header">
      <h2>{t('title')}</h2>
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<IconRefreshOutline16 />}
        disabled={disabled}
        onClick={() => {
          setSaveError(false)
          void store.reset().catch(() => { setSaveError(true) })
        }}
      >{t('resetSettings')}</Button>
    </header>

    <SettingGroup title={t('group.general')}>
      <ToggleRow
        label={t('enabled')}
        checked={values.enabled}
        disabled={disabled}
        onChange={(value) => { set('enabled', value) }}
      />
    </SettingGroup>

    <fieldset disabled={disabled || !values.enabled}>
      <legend className="dsh-input-anywhere-sr-only">{t('title')}</legend>
      <SettingGroup title={t('group.surface')}>
        <Segmented
          label={t('surfaceMode')}
          name="dsh-input-anywhere-surface-mode"
          value={values.surfaceMode}
          disabled={disabled || !values.enabled}
          options={surfaceOptions}
          onChange={(value) => { set('surfaceMode', value) }}
        />
        {values.surfaceMode === 'custom' && <OpacitySlider
          label={t('surfaceOpacity')}
          value={values.surfaceOpacity}
          disabled={disabled || !values.enabled}
          onChange={(value) => { set('surfaceOpacity', value) }}
        />}
      </SettingGroup>

      <SettingGroup title={t('group.controls')}>
        <Segmented
          label={t('controlsMode')}
          name="dsh-input-anywhere-controls-mode"
          value={values.controlsMode}
          disabled={disabled || !values.enabled}
          options={controlOptions}
          onChange={(value) => { set('controlsMode', value) }}
        />
        {values.controlsMode === 'custom' && <OpacitySlider
          label={t('controlsOpacity')}
          value={values.controlsOpacity}
          disabled={disabled || !values.enabled}
          onChange={(value) => { set('controlsOpacity', value) }}
        />}
      </SettingGroup>

      <SettingGroup title={t('group.overlap')}>
        <ToggleRow
          label={t('overlapAware')}
          checked={values.overlapAware}
          disabled={disabled || !values.enabled}
          onChange={(value) => { set('overlapAware', value) }}
        />
        {values.overlapAware && <>
          <Segmented
            label={t('overlapIdleMode')}
            name="dsh-input-anywhere-overlap-idle-mode"
            value={values.overlapIdleMode}
            disabled={disabled || !values.enabled}
            options={adaptiveOptions}
            onChange={(value) => { set('overlapIdleMode', value) }}
          />
          {values.overlapIdleMode === 'custom' && <OpacitySlider
            label={t('overlapIdleOpacity')}
            value={values.overlapIdleOpacity}
            disabled={disabled || !values.enabled}
            onChange={(value) => { set('overlapIdleOpacity', value) }}
          />}
          <Segmented
            label={t('overlapActiveMode')}
            name="dsh-input-anywhere-overlap-active-mode"
            value={values.overlapActiveMode}
            disabled={disabled || !values.enabled}
            options={adaptiveOptions}
            onChange={(value) => { set('overlapActiveMode', value) }}
          />
          {values.overlapActiveMode === 'custom' && <OpacitySlider
            label={t('overlapActiveOpacity')}
            value={values.overlapActiveOpacity}
            disabled={disabled || !values.enabled}
            onChange={(value) => { set('overlapActiveOpacity', value) }}
          />}
        </>}
      </SettingGroup>
    </fieldset>

    {snapshot.status === 'loading' && <p className="dsh-input-anywhere-settings-status">{t('loading')}</p>}
    {snapshot.status === 'local' && snapshot.persistence === 'memory'
      && <p className="dsh-input-anywhere-settings-status">{t('memoryOnly')}</p>}
    {saveError && <p className="dsh-input-anywhere-settings-status" role="alert">{t('saveError')}</p>}
  </div>
}
