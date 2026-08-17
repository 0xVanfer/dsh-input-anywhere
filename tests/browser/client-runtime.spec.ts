import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { ComponentType, ElementType, Key } from 'react'

interface ClientRegistration {
  readonly factory: (require: (name: string) => unknown) => {
    readonly apply: (context: unknown) => void
  }
}

interface RuntimeWindow extends Window {
  readonly React: typeof import('react')
  readonly ReactDOM: typeof import('react-dom/client')
  __clientRegistration?: ClientRegistration
  __disposeInputAnywhere?: () => void
  __ModuleLoader__: {
    readonly load: (registration: ClientRegistration) => void
  }
}

const require = createRequire(import.meta.url)
const reactUmd = join(dirname(require.resolve('react/package.json')), 'umd/react.development.js')
const reactDomUmd = join(dirname(require.resolve('react-dom/package.json')), 'umd/react-dom.development.js')
const clientBundle = resolve('lib/client.js')

const fixture = `
  <style>
    html, body { width: 100%; height: 100%; margin: 0; }
    body {
      --dsw-specific-input-major: rgb(30, 40, 50);
      --dsw-specific-tip: rgb(60, 70, 80);
      --dsw-specific-menu: rgb(90, 100, 110);
      --dsw-alias-bg-layer-1: rgb(20, 30, 40);
      --dsw-alias-bg-layer-2: rgb(50, 60, 70);
      --dsw-alias-bg-base: rgb(10, 20, 30);
      --dsw-alias-label-secondary: rgb(220, 220, 220);
      --dsw-alias-label-primary: rgb(255, 255, 255);
      --dsw-alias-label-tertiary: rgb(180, 180, 180);
      --dsw-alias-interactive-bg-hover: rgba(255, 255, 255, 0.1);
      --dsw-alias-state-business-primary: rgb(80, 130, 255);
    }
    body.theme-translucent {
      --test-layer-1: rgba(10, 20, 30, 0.35);
      --test-layer-2: rgba(40, 50, 60, 0.45);
      --dsw-alias-bg-layer-1: var(--test-layer-1);
      --dsw-alias-bg-layer-2: var(--test-layer-2);
    }
    [data-phase] { position: fixed; inset: 40px 80px; }
    [data-conversation-scroll] { position: relative; width: 100%; height: 100%; }
    [data-chat-flow] { position: absolute; inset: 0; pointer-events: none; }
    [data-composer-seat] { display: flex; flex-direction: column; gap: 6px; }
    [data-composer-card] {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      width: 640px;
      height: 160px;
      margin: 0 auto;
      background-color: var(--dsw-specific-input-major);
    }
    [data-input-scroll] { flex: 1 1 auto; min-height: 48px; }
    .toolbar { display: flex; justify-content: space-between; height: 36px; }
    .tools, .trailing { display: flex; align-items: center; gap: 4px; }
    .dock-panel { height: 28px; background-color: var(--dsw-specific-tip); }
    .context-panel { position: absolute; width: 80px; height: 24px; background-color: var(--dsw-specific-menu); }
  </style>
  <main data-phase="active">
    <section data-conversation-scroll>
      <div data-chat-flow></div>
      <div data-composer-seat>
        <div class="dock-panel">Queued message</div>
        <div id="composer-card" data-composer-card>
          <div class="context-panel">Context</div>
          <div data-input-scroll><textarea></textarea></div>
          <div class="toolbar">
            <div class="tools"><button>Extension</button><div id="slot-mount"></div></div>
            <div class="trailing"><button aria-haspopup="menu"><span>Model</span></button><button>Send</button></div>
          </div>
        </div>
      </div>
    </section>
  </main>
`

async function mountPackedClient(page: import('@playwright/test').Page): Promise<void> {
  await page.setContent(fixture)
  await page.addScriptTag({ path: reactUmd })
  await page.addScriptTag({ path: reactDomUmd })
  await page.evaluate(() => {
    const scope = window as unknown as RuntimeWindow
    scope.__ModuleLoader__ = {
      load(registration) {
        scope.__clientRegistration = registration
      },
    }
  })
  await page.addScriptTag({ path: clientBundle })
  await page.evaluate(() => {
    const scope = window as unknown as RuntimeWindow
    const registration = scope.__clientRegistration
    if (registration === undefined) throw new Error('client bundle did not register')
    const React = scope.React
    const ReactDOM = scope.ReactDOM
    const jsx = (type: ElementType, props: Record<string, unknown>, key?: Key) => React.createElement(
      type,
      key === undefined ? props : { ...props, key },
    )
    const externals: Record<string, unknown> = {
      react: React,
      'react-dom': ReactDOM,
      'react/jsx-runtime': { Fragment: React.Fragment, jsx, jsxs: jsx },
      '@deepseek-ai/dsh-client-ui-primitives': {
        Button: ({ children, icon, ...props }: Record<string, unknown>) => React.createElement(
          'button',
          props,
          icon as React.ReactNode,
          children as React.ReactNode,
        ),
        IconRefreshOutline16: () => React.createElement('span', { 'data-test-icon': 'refresh' }),
      },
    }
    const client = registration.factory((name) => {
      if (!(name in externals)) throw new Error(`unexpected external: ${name}`)
      return externals[name]
    })
    const mount = document.querySelector<HTMLElement>('#slot-mount')
    if (mount === null) throw new Error('slot mount is missing')
    const root = ReactDOM.createRoot(mount)
    const disposers: Array<() => void> = []
    const settingsSnapshot = {
      status: 'unavailable',
      value: undefined,
      base: undefined,
      user: undefined,
      revision: 0,
      writable: false,
      mode: 'memory',
    }
    client.apply({
      effect(factory: () => unknown) {
        const dispose = factory()
        if (typeof dispose === 'function') disposers.push(dispose as () => void)
      },
      locale: {
        register() { return () => {} },
        bind() {
          return (key: string) => ({
            moveInput: 'Move input',
            resetPosition: 'Reset input position',
          })[key] ?? key
        },
      },
      settingsScope: {
        bind() {
          return {
            getSnapshot: () => settingsSnapshot,
            subscribe: () => () => {},
            set: async () => {},
            unset: async () => {},
          }
        },
      },
      slots: {
        inject(_name: string, register: () => unknown) {
          const dispose = register()
          if (typeof dispose === 'function') disposers.push(dispose as () => void)
        },
        register(
          options: { name: string, inject?: () => Record<string, unknown> },
          Component: ComponentType<Record<string, unknown>>,
        ) {
          if (options.name !== 'conversation.input.left') return () => {}
          root.render(React.createElement(Component, {
            ...options.inject?.(),
            input: { draft: '' },
          }))
          return () => { root.unmount() }
        },
      },
    })
    scope.__disposeInputAnywhere = () => {
      for (const dispose of disposers.reverse()) dispose()
    }
  })
}

test('packed client mounts, rebinds, inherits surfaces, and disposes in Chromium', async ({ page }) => {
  await mountPackedClient(page)
  const move = page.getByRole('button', { name: 'Move input' })
  const seat = page.locator('[data-composer-seat]')
  const card = page.locator('#composer-card')
  const dock = page.locator('.dock-panel')
  const menu = page.locator('.context-panel')

  await expect(move).toBeVisible()
  await move.click()
  await expect(seat).toHaveAttribute('data-input-anywhere-floating', '')
  await expect(card).toHaveCSS('position', 'relative')

  await page.locator('body').evaluate((body) => {
    body.classList.add('theme-translucent')
    body.setAttribute('data-ds-dark-theme', 'test-theme')
  })
  await expect(seat).toHaveAttribute('data-input-anywhere-themed', '')
  await expect(card).toHaveCSS('background-color', 'rgba(10, 20, 30, 0.35)')
  await expect(dock).toHaveCSS('background-color', 'rgba(10, 20, 30, 0.35)')
  await expect(menu).toHaveCSS('background-color', 'rgba(40, 50, 60, 0.45)')
  await expect(move).toHaveCSS('opacity', '0.35')

  const textarea = page.locator('textarea')
  await textarea.focus()
  await expect(card).toHaveCSS('background-color', 'rgba(10, 20, 30, 0.92)')
  await expect(move).toHaveCSS('opacity', '0.92')
  await textarea.evaluate(element => { element.blur() })
  await expect(card).toHaveCSS('background-color', 'rgba(10, 20, 30, 0.35)')

  await page.locator('body').evaluate((body) => {
    body.classList.remove('theme-translucent')
    body.removeAttribute('data-ds-dark-theme')
  })
  await expect(seat).not.toHaveAttribute('data-input-anywhere-themed', '')
  await expect(card).toHaveCSS('background-color', 'rgb(30, 40, 50)')
  await expect(dock).toHaveCSS('background-color', 'rgb(60, 70, 80)')
  await expect(menu).toHaveCSS('background-color', 'rgb(90, 100, 110)')

  await page.locator('body').evaluate((body) => {
    body.classList.add('theme-translucent')
    body.setAttribute('data-ds-dark-theme', 'test-theme')
  })
  await expect(seat).toHaveAttribute('data-input-anywhere-themed', '')

  const box = await move.boundingBox()
  if (box === null) throw new Error('move control has no box')
  const xBeforeRebind = await seat.evaluate(element => element.style.getPropertyValue('--dsh-input-anywhere-x'))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(page.locator('html')).toHaveClass(/dsh-input-anywhere-interacting/)
  await move.evaluate((button, point) => {
    button.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      pointerId: 1,
      isPrimary: true,
      buttons: 1,
      clientX: point.x + 160,
      clientY: point.y,
    }))
    document.querySelector('#composer-card')?.removeAttribute('data-composer-card')
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
  await expect(page.locator('html')).not.toHaveClass(/dsh-input-anywhere-interacting/)
  await expect(seat).not.toHaveAttribute('data-input-anywhere-floating', '')
  await page.mouse.up()

  await card.evaluate(element => { element.setAttribute('data-composer-card', '') })
  await expect(seat).toHaveAttribute('data-input-anywhere-floating', '')
  await expect.poll(() => seat.evaluate(element => element.style.getPropertyValue('--dsh-input-anywhere-x')))
    .toBe(xBeforeRebind)

  await page.evaluate(() => {
    const scope = window as unknown as RuntimeWindow
    scope.__disposeInputAnywhere?.()
  })
  await expect(page.locator('style[data-plugin-css="dsh-input-anywhere/client"]')).toHaveCount(0)
  await expect(seat).not.toHaveAttribute('data-input-anywhere-floating', '')
})
