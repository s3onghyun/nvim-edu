import assert from 'node:assert/strict'
import { preview } from 'vite'
import * as pw from 'playwright-core'
import { levels, tokenize } from '../src/levels.js'

const server = await preview({ preview: { port: 4173 } })
const name = process.env.BROWSER ?? 'chromium'
const browser = await pw[name].launch()
const page = await browser.newPage()
const sent = []
await page.exposeFunction('__recordGoatEvent', (event) => sent.push(event))
await page.addInitScript(() => {
  window.goatcounter = { count(event) { window.__recordGoatEvent(event) } }
})
const events = () => sent
const key = (token) => ({ '<CR>': 'Enter', '<Esc>': 'Escape', '<C-a>': 'Control+a', '<C-b>': 'Control+b', '<C-u>': 'Control+u' }[token])

await page.goto('http://localhost:4173/?lang=ko#hjkl')
assert.deepEqual((await events()).at(-1), { path: '/main/hjkl', title: 'nvim-edu' })
await page.locator('#reset').click()
assert.equal((await events()).filter((event) => event.path === '/main/hjkl').length, 1)
for (const key of tokenize(levels.find((level) => level.id === 'hjkl').solution)) await page.keyboard.press(key === '<CR>' ? 'Enter' : key)
assert.ok((await events()).some((event) => event.path === 'level-cleared/hjkl' && event.event === true))
await Promise.all([page.waitForNavigation(), page.locator('#lang').click()])
assert.ok((await events()).some((event) => event.path === 'language/en' && event.event === true))
await page.goto('http://localhost:4173/#mission-move')
for (let round = 0; round < 10; round++) {
  for (const token of tokenize(await page.evaluate(() => window.__edu.level.solution))) key(token) ? await page.keyboard.press(key(token)) : await page.keyboard.type(token)
  await page.waitForFunction((r) => window.__edu.session.round === r + 1 && (r === 9 || !window.__edu.done), round)
}
assert.ok((await events()).some((event) => event.path === 'drill-finished/mission-move' && event.event === true))
// WebKit 은 두 번째 로드부터 격리가 안 돼 real/ 이 fallback 으로 뜨고 집계도 안 함 (real.e2e.mjs 와 같은 제약)
if (name !== 'webkit') {
  await page.goto('http://localhost:4173/real/#hjkl')
  await page.waitForFunction(() => window.crossOriginIsolated && window.__real, null, { timeout: 30000 })
  await Promise.all([page.waitForNavigation(), page.evaluate(() => { location.hash = 'sandbox' })])
  await page.waitForFunction(() => window.__real?.level.id === 'sandbox')
  assert.equal((await events()).filter((event) => event.path === 'real-vim-opened' && event.event === true).length, 1)
  assert.ok((await events()).some((event) => event.path === '/real/sandbox'))
  await page.goto('http://localhost:4173/#hjkl')
  await page.goto('http://localhost:4173/real/#hjkl')
  await page.waitForFunction(() => window.crossOriginIsolated && window.__real, null, { timeout: 30000 })
  assert.equal((await events()).filter((event) => event.path === 'real-vim-opened' && event.event === true).length, 2)
}

const dnt = await browser.newContext()
await dnt.addInitScript(() => {
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' })
  window.__goatEvents = []
  window.goatcounter = { count(event) { window.__goatEvents.push(event) } }
})
const dntPage = await dnt.newPage()
await dntPage.goto('http://localhost:4173/#hjkl')
assert.deepEqual(await dntPage.evaluate(() => window.__goatEvents), [])

await dnt.close()
await browser.close()
server.httpServer.close()
console.log('analytics: ALL PASS')
