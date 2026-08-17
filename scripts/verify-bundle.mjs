import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'

const packageUrl = process.argv[2] === undefined
  ? new URL('../', import.meta.url)
  : pathToFileURL(`${resolve(process.argv[2])}${sep}`)
const clientUrl = new URL('lib/client.js', packageUrl)
const hostUrl = new URL('lib/index.js', packageUrl)
const bundle = await readFile(clientUrl, 'utf8')
const host = await import(`${hostUrl.href}?verify=${Date.now()}`)

function check(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`)
  console.log(`PASS ${label}`)
}

check('host exports package name', host.name === 'dsh-input-anywhere')
check('host exports inert apply function', typeof host.apply === 'function' && host.apply() === undefined)

let registration
const styleTags = []
const document = {
  createElement(tagName) {
    return {
      tagName,
      dataset: {},
      textContent: '',
      remove() {
        const index = styleTags.indexOf(this)
        if (index >= 0) styleTags.splice(index, 1)
      },
    }
  },
  head: {
    appendChild(tag) {
      styleTags.push(tag)
      return tag
    },
  },
}
const context = vm.createContext({
  document,
  window: {
    __ModuleLoader__: {
      load(value) {
        if (registration !== undefined) throw new Error('client registered more than once')
        registration = value
      },
    },
  },
})
vm.runInContext(bundle, context, { filename: clientUrl.pathname })

check('client registers exactly one ModuleLoader package', registration !== undefined)
check('client package id matches manifest name', registration.id === 'dsh-input-anywhere')
check('client exposes a lazy factory', typeof registration.factory === 'function')

const nativeRequire = createRequire(import.meta.url)
const externalNames = []
const client = registration.factory((name) => {
  externalNames.push(name)
  if (name === '@deepseek-ai/dsh-client-ui-primitives') {
    return { IconRefreshOutline16: () => null }
  }
  return nativeRequire(name)
})
check('client factory returns apply', typeof client.apply === 'function')
check('client declares slots injection', Array.isArray(client.inject) && client.inject.length === 1 && client.inject[0] === 'slots')
check('client external set is deliberate', JSON.stringify(externalNames.sort()) === JSON.stringify([
  '@deepseek-ai/dsh-client-ui-primitives',
  'react',
  'react-dom',
  'react/jsx-runtime',
].sort()))

let effectLabel
let injectedSlot
let slotOptions
let slotComponent
const effectDisposers = []
const fakeContext = {
  effect(effect, label) {
    effectLabel = label
    const dispose = effect()
    if (typeof dispose === 'function') effectDisposers.push(dispose)
  },
  slots: {
    inject(name, register) {
      injectedSlot = name
      register()
    },
    register(options, component) {
      slotOptions = options
      slotComponent = component
      return () => {}
    },
  },
}
client.apply(fakeContext)
check('client owns its style effect', effectLabel === 'input-anywhere: styles')
check('client installs exactly one labeled stylesheet', styleTags.length === 1
  && styleTags[0]?.dataset.plugin === 'dsh-input-anywhere'
  && styleTags[0]?.dataset.pluginCss === 'dsh-input-anywhere/client'
  && styleTags[0]?.textContent.includes('.dsh-input-anywhere-seat'))
check('client waits for the additive input slot', injectedSlot === 'conversation.input.left')
check('client registers a unique ordered Slot item', slotOptions?.name === 'conversation.input.left'
  && slotOptions?.id === 'input-anywhere'
  && slotOptions?.order === 90)
check('client registers a renderable control component', typeof slotComponent === 'function')
for (const dispose of effectDisposers.reverse()) dispose()
check('client style effect disposes its stylesheet', styleTags.length === 0)
