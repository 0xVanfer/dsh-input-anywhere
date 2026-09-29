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
check('host exports a Config schema', typeof host.Config?.toJSON === 'function')

// `toJSON()` is a ref envelope: the root and every field is either an inline
// node or an integer reference into `refs`.
function nodeOf(envelope, value) {
  return typeof value === 'object' && value !== null
    ? value
    : envelope.refs?.[String(value)]
}

// Every preference field must be volatile, otherwise the settings service
// refuses the Client's writes and projects no editable form at all.
const configJson = host.Config.toJSON()
const configRoot = nodeOf(configJson, configJson.uid)
const configFields = Object.entries(configRoot?.dict ?? {})
check('the Config form exposes every live preference field', configFields.length === 10)
check('every Config field is live-writable', configFields.every(([, ref]) => {
  const node = nodeOf(configJson, ref)
  return node?.meta?.volatile === true && node?.meta?.default !== undefined
}))

let hostInject
let configuredPage
const hostFiber = { uid: 'dsh-input-anywhere' }
host.apply({
  fiber: hostFiber,
  inject(dependencies, callback) {
    hostInject = dependencies
    callback({
      effect(effect) {
        const dispose = effect()
        if (typeof dispose === 'function') dispose()
      },
      settings: {
        configure(presentation, owner) {
          configuredPage = { presentation, owner }
          return () => {}
        },
      },
    })
  },
})
check('host waits for the optional settings service', JSON.stringify(hostInject) === JSON.stringify(['settings']))
check('host suppresses the schema-generated settings page', configuredPage?.presentation?.auto === false
  && configuredPage?.owner === hostFiber)

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
    return { Button: () => null, IconRefreshOutlineRegular: () => null }
  }
  return nativeRequire(name)
})
check('client factory returns apply', typeof client.apply === 'function')
check('client declares slots, locale, and the settings form service', JSON.stringify(client.inject) === JSON.stringify([
  'slots',
  'locale',
  'configForms',
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
  configForms: {
    get(namespace) {
      boundSettingsNamespace = namespace
      return {
        getSnapshot: () => settingsSnapshot,
        subscribe: () => () => {},
        set: async () => true,
        unset: async () => true,
        mutate: async () => true,
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
check('client registers its locale and binds the config-form namespace', registeredLocale === 'input-anywhere'
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
