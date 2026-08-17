/** Browser half: enhance the native composer and expose a dedicated settings section. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { SETTINGS_NAMESPACE, type InputAnywherePreferences } from '../preferences-contract.ts'
import { InputAnywhereControls } from './InputAnywhereControls.tsx'
import { InputAnywhereSettings } from './InputAnywhereSettings.tsx'
import { en, LOCALE_NAMESPACE, zh } from './locales.ts'
import { PreferenceController } from './preferences.ts'
import { pluginStyles } from './styles.ts'

export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

function installStyles(): () => void {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-input-anywhere'
  tag.dataset.pluginCss = 'dsh-input-anywhere/client'
  tag.textContent = pluginStyles
  document.head.appendChild(tag)
  return () => { tag.remove() }
}

export function apply(ctx: ClientContext): void {
  ctx.effect(installStyles, 'input-anywhere: styles')
  ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, { zh, en }), 'input-anywhere: dictionaries')

  const t = ctx.locale.bind(LOCALE_NAMESPACE)
  const scope = ctx.settingsScope.bind<InputAnywherePreferences>({ namespace: SETTINGS_NAMESPACE })
  const preferences = new PreferenceController(scope)
  ctx.effect(() => () => { preferences.dispose() }, 'input-anywhere: preference fallback')

  ctx.slots.inject('settings.section', () => ctx.slots.register(
    {
      name: 'settings.section',
      id: 'input-anywhere',
      order: 36,
      label: () => t('title'),
      inject: () => ({ preferences, t }),
    },
    InputAnywhereSettings,
  ))

  ctx.slots.inject('conversation.input.left', () => ctx.slots.register(
    {
      name: 'conversation.input.left',
      id: 'input-anywhere',
      order: 90,
      label: () => t('moveInput'),
      inject: () => ({ preferences, t }),
    },
    InputAnywhereControls,
  ))
}
