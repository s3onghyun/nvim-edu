import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { preview } from 'vite'
import * as pw from 'playwright-core'
import { levels, tokenize } from '../src/levels.js'
import { GOATCOUNTER_INTEGRITY, GOATCOUNTER_SCRIPT } from '../src/analytics.js'
import { watchCsp } from './csp.mjs'

// 4173 은 `vite preview` 기본 포트라 띄워 둔 preview 와 겹치기 쉬움. strictPort: 포트가 차 있으면 다른 포트로 옮기지 않고 바로 실패
const server = await preview({ preview: { port: 4172, strictPort: true } })
const name = process.env.BROWSER ?? 'chromium'
const browser = await pw[name].launch()
const page = await browser.newPage()
const csp = await watchCsp(page)
const sent = []
await page.exposeFunction('__recordGoatEvent', (event) => sent.push(event))
await page.addInitScript(() => {
  window.goatcounter = { count(event) { window.__recordGoatEvent(event) } }
})
const events = () => sent
const key = (token) => ({ '<CR>': 'Enter', '<Esc>': 'Escape', '<C-a>': 'Control+a', '<C-b>': 'Control+b', '<C-u>': 'Control+u' }[token])

await page.goto('http://localhost:4172/?lang=ko#hjkl')
assert.deepEqual((await events()).at(-1), { path: '/main/hjkl', title: 'nvim-edu' })
await page.locator('#reset').click()
assert.equal((await events()).filter((event) => event.path === '/main/hjkl').length, 1)
for (const key of tokenize(levels.find((level) => level.id === 'hjkl').solution)) await page.keyboard.press(key === '<CR>' ? 'Enter' : key)
assert.ok((await events()).some((event) => event.path === 'level-cleared/hjkl' && event.event === true))
await page.locator('#lang').click()
await Promise.all([page.waitForNavigation(), page.locator('#lang-menu [data-lang="en"]').click()])
assert.ok((await events()).some((event) => event.path === 'language/en' && event.event === true))
await page.locator('#lang').click()
await Promise.all([page.waitForNavigation(), page.locator('#lang-menu [data-lang="zh-CN"]').click()])
assert.ok((await events()).some((event) => event.path === 'language/zh-CN' && event.event === true))
await page.goto('http://localhost:4172/#mission-move')
for (let round = 0; round < 10; round++) {
  for (const token of tokenize(await page.evaluate(() => window.__edu.level.solution))) key(token) ? await page.keyboard.press(key(token)) : await page.keyboard.type(token)
  await page.waitForFunction((r) => window.__edu.session.round === r + 1 && (r === 9 || !window.__edu.done), round)
}
assert.ok((await events()).some((event) => event.path === 'drill-finished/mission-move' && event.event === true))
// WebKit 은 두 번째 로드부터 격리가 안 돼 real/ 이 fallback 으로 뜨고 집계도 안 함 (real.e2e.mjs 와 같은 제약)
if (name !== 'webkit') {
  await page.goto('http://localhost:4172/real/#hjkl')
  await page.waitForFunction(() => window.crossOriginIsolated && window.__real, null, { timeout: 30000 })
  await Promise.all([page.waitForNavigation(), page.evaluate(() => { location.hash = 'sandbox' })])
  await page.waitForFunction(() => window.__real?.level.id === 'sandbox')
  assert.equal((await events()).filter((event) => event.path === 'real-vim-opened' && event.event === true).length, 1)
  assert.ok((await events()).some((event) => event.path === '/real/sandbox'))
  await page.goto('http://localhost:4172/#hjkl')
  await page.goto('http://localhost:4172/real/#hjkl')
  await page.waitForFunction(() => window.crossOriginIsolated && window.__real, null, { timeout: 30000 })
  assert.equal((await events()).filter((event) => event.path === 'real-vim-opened' && event.event === true).length, 2)
}

assert.deepEqual(csp, [], 'CSP violations on the main and real pages')

// The analytics script is a versioned URL pinned by integrity; a file with other content never runs
const assets = new URL('../dist/assets/', import.meta.url)
const bundle = readdirSync(assets).filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(f, assets), 'utf8')).join('\n')
assert.ok(bundle.includes(GOATCOUNTER_SCRIPT) && bundle.includes(GOATCOUNTER_INTEGRITY))
assert.ok(!bundle.includes('gc.zgo.at/count.js'))
const tampered = await browser.newContext()
const tamperedCsp = await watchCsp(tampered)
await tampered.route('https://gc.zgo.at/**', (route) => route.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: 'window.__tampered = true' }))
await tampered.route('https://*.goatcounter.com/**', (route) => route.fulfill({ status: 204 }))
await tampered.addInitScript(() => {
  addEventListener('error', (e) => { if (e.target?.src?.startsWith('https://gc.zgo.at/')) window.__goatScriptError = true }, true)
})
const tamperedPage = await tampered.newPage()
await tamperedPage.goto('http://localhost:4172/#hjkl')
const script = tamperedPage.locator('script[src^="https://gc.zgo.at/"]')
assert.equal(await script.getAttribute('src'), GOATCOUNTER_SCRIPT)
assert.equal(await script.getAttribute('integrity'), GOATCOUNTER_INTEGRITY)
assert.equal(await script.getAttribute('crossorigin'), 'anonymous')
await tamperedPage.waitForFunction(() => window.__goatScriptError)
assert.equal(await tamperedPage.evaluate(() => window.__tampered), undefined)
assert.deepEqual(tamperedCsp, [])
await tampered.close()

const dnt = await browser.newContext()
await dnt.addInitScript(() => {
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' })
  window.__goatEvents = []
  window.goatcounter = { count(event) { window.__goatEvents.push(event) } }
})
const dntPage = await dnt.newPage()
await dntPage.goto('http://localhost:4172/#hjkl')
assert.deepEqual(await dntPage.evaluate(() => window.__goatEvents), [])

await dnt.close()
await browser.close()
server.httpServer.close()
console.log('analytics: ALL PASS')
