import { expect, test, type Page } from '@playwright/test'
import { pluginStyles } from '../../src/client/styles.ts'

const fixtureStyles = `
  body { margin: 40px; }
  .dsh-input-anywhere-card {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 800px;
    height: 220px;
    padding: 8px;
  }
  [data-input-scroll] { flex: 1 1 auto; }
  .toolbar { display: flex; align-items: center; justify-content: space-between; min-width: 0; height: 36px; }
  .tools, [data-input-anywhere-trailing] { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .permission, .extension-menu, .model-menu, .send { height: 28px; }
  .extension-menu, .model-menu { display: flex; align-items: center; gap: 4px; }
`

async function mountFixture(page: Page): Promise<void> {
  await page.setContent(`
    <style>${fixtureStyles}${pluginStyles}</style>
    <section class="dsh-input-anywhere-scroll" data-input-anywhere-floating-host style="--dsh-composer-height: 180px">
      <div class="dsh-input-anywhere-seat" data-input-anywhere-floating style="--dsh-input-anywhere-x: 40px; --dsh-input-anywhere-y: 40px; --dsh-input-anywhere-width: 800px">
        <div class="dsh-input-anywhere-card" data-input-anywhere-floating-card style="--dsh-input-anywhere-card-height: 220px">
          <div data-input-scroll></div>
          <div class="toolbar">
            <div class="tools">
              <button class="permission">Workspace Write</button>
              <div class="dsh-input-anywhere-controls">
                <button class="dsh-input-anywhere-button" aria-label="Move input"></button>
                <button class="dsh-input-anywhere-button" data-action="reset" aria-label="Reset input position"></button>
              </div>
            </div>
            <div data-input-anywhere-trailing>
              <button class="extension-menu" aria-haspopup="menu"><span>Extension</span><b>+</b></button>
              <button class="model-menu" aria-haspopup="menu"><span>GPT-5.6 Sol High</span><b>⌄</b></button>
              <button class="send" aria-label="Send message">↑</button>
            </div>
          </div>
          <div class="dsh-input-anywhere-resize-layer">
            <button class="dsh-input-anywhere-resize" data-direction="nw"></button>
            <button class="dsh-input-anywhere-resize" data-direction="ne"></button>
            <button class="dsh-input-anywhere-resize" data-direction="sw"></button>
            <button class="dsh-input-anywhere-resize" data-direction="se"></button>
          </div>
        </div>
      </div>
    </section>
  `)
}

test('container-width rules prevent toolbar overlap and compact every trailing menu', async ({ page }) => {
  await mountFixture(page)
  const card = page.locator('.dsh-input-anywhere-card')
  const controls = page.locator('.dsh-input-anywhere-controls')

  await expect(controls).toHaveCSS('position', 'static')

  await card.evaluate(element => { element.style.width = '650px' })
  await expect(controls).toHaveCSS('position', 'absolute')
  await expect(controls).toHaveCSS('top', '8px')
  await expect(page.locator('[data-input-scroll]')).toHaveCSS('margin-right', '104px')

  const permission = await page.locator('.permission').boundingBox()
  const controlBox = await controls.boundingBox()
  expect(permission).not.toBeNull()
  expect(controlBox).not.toBeNull()
  expect((permission?.y ?? 0) >= (controlBox?.y ?? 0) + (controlBox?.height ?? 0)).toBe(true)

  await card.evaluate(element => { element.style.width = '480px' })
  for (const selector of ['.extension-menu', '.model-menu']) {
    await expect(page.locator(selector)).toHaveCSS('width', '28px')
    await expect(page.locator(`${selector} > span`)).toHaveCSS('display', 'none')
  }
})

test('floating mode clears native trajectory clearance and stays below shell overlays', async ({ page }) => {
  await mountFixture(page)
  await expect(page.locator('.dsh-input-anywhere-scroll')).toHaveCSS('--dsh-composer-height', '0px')
  await expect(page.locator('.dsh-input-anywhere-seat')).toHaveCSS('z-index', '50')
})

test('resize corners remain hidden until the handle itself is engaged', async ({ page }) => {
  await mountFixture(page)
  const card = page.locator('.dsh-input-anywhere-card')
  const southeast = page.locator('.dsh-input-anywhere-resize[data-direction="se"]')

  await card.hover({ position: { x: 200, y: 100 } })
  await expect(southeast).toHaveCSS('opacity', '0')

  await southeast.hover()
  await expect(southeast).toHaveCSS('opacity', '1')

  await southeast.focus()
  await page.mouse.move(0, 0)
  await expect(southeast).toHaveCSS('opacity', '1')
})

test('coarse pointers receive 44px move and resize targets', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  await mountFixture(page)

  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
  await expect(page.locator('.dsh-input-anywhere-button').first()).toHaveCSS('width', '44px')
  await expect(page.locator('.dsh-input-anywhere-resize').first()).toHaveCSS('height', '44px')
  await context.close()
})
