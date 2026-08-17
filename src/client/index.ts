/** Browser half: enhance the native composer through an additive tool-row Slot. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { InputAnywhereControls } from './InputAnywhereControls.tsx'
import { pluginStyles } from './styles.ts'

export const inject = ['slots']

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
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register(
    {
      name: 'conversation.input.left',
      id: 'input-anywhere',
      order: 90,
      label: 'Move and resize input',
    },
    InputAnywhereControls,
  ))
}
