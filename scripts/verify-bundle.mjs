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
let hostInject
let registeredNamespace
let registeredSchema
host.apply({
  inject(dependencies, callback) {
    hostInject = dependencies
    callback({
      settings: {
        register(namespace, schema) {
          registeredNamespace = namespace
          registeredSchema = schema
        },
      },
    })
  },
})
check('host waits for the optional settings service', JSON.stringify(hostInject) === JSON.stringify(['settings']))
check('host registers its durable settings namespace', registeredNamespace === 'dsh-input-anywhere'
  && registeredSchema === host.InputAnywherePreferencesSchema)

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
check('client declares settings, locale, transport, and slots services', JSON.stringify(client.inject) === JSON.stringify([
  'slots',
  'locale',
  'connection',
  'remote',
  'settingsScope',
]))
check('client external set is deliberate', JSON.stringify(externalNames.sort()) === JSON.stringify([
  '@deepseek-ai/dsh-client-ui-primitives',
  'react',
  'react-dom',
  'react/jsx-runtime',
].sort()))

const effectLabels = []
const injectedSlots = []
const registrations = []
const effectDisposers = []
let boundSettingsNamespace
let registeredLocale
const settingsSnapshot = {
  status: 'ready',
  value: undefined,
  base: undefined,
  user: undefined,
  revision: 0,
  writable: true,
  mode: 'host',
}
const fakeContext = {
  effect(effect, label) {
    effectLabels.push(label)
    const dispose = effect()
    if (typeof dispose === 'function') effectDisposers.push(dispose)
  },
  locale: {
    register(namespace) {
      registeredLocale = namespace
      return () => {}
    },
    bind() {
      return key => key
    },
  },
  settingsScope: {
    bind({ namespace }) {
      boundSettingsNamespace = namespace
      return {
        getSnapshot: () => settingsSnapshot,
        subscribe: () => () => {},
        set: async () => {},
        unset: async () => {},
      }
    },
  },
  slots: {
    inject(name, register) {
      injectedSlots.push(name)
      return register()
    },
    register(options, component) {
      registrations.push({ options, component })
      return () => {}
    },
  },
}
client.apply(fakeContext)
check('client owns style and locale effects', effectLabels.includes('input-anywhere: styles')
  && effectLabels.includes('input-anywhere: dictionaries'))
check('client installs exactly one labeled stylesheet', styleTags.length === 1
  && styleTags[0]?.dataset.plugin === 'dsh-input-anywhere'
  && styleTags[0]?.dataset.pluginCss === 'dsh-input-anywhere/client'
  && styleTags[0]?.textContent.includes('.dsh-input-anywhere-seat'))
check('client registers its locale and binds the durable namespace', registeredLocale === 'input-anywhere'
  && boundSettingsNamespace === 'dsh-input-anywhere')
check('client waits for settings and additive input slots', JSON.stringify(injectedSlots) === JSON.stringify([
  'settings.section',
  'conversation.input.left',
]))
const settingsRegistration = registrations.find(entry => entry.options.name === 'settings.section')
const inputRegistration = registrations.find(entry => entry.options.name === 'conversation.input.left')
check('client registers a dedicated ordered settings section', settingsRegistration?.options.id === 'input-anywhere'
  && settingsRegistration?.options.order === 36
  && typeof settingsRegistration?.component === 'function')
check('client registers a unique ordered Slot control', inputRegistration?.options.id === 'input-anywhere'
  && inputRegistration?.options.order === 90
  && typeof inputRegistration?.component === 'function')
check('both Slot entries receive the shared preference store', typeof settingsRegistration?.options.inject === 'function'
  && typeof inputRegistration?.options.inject === 'function'
  && settingsRegistration.options.inject().preferences === inputRegistration.options.inject().preferences)
for (const dispose of effectDisposers.reverse()) dispose()
check('client style effect disposes its stylesheet', styleTags.length === 0)
