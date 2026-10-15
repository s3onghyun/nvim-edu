import assert from 'node:assert/strict'
import { preview } from 'vite'
import * as pw from 'playwright-core'
import { levels, tokenize } from '../src/levels.js'

const server = await preview({ preview: { port: 4173 } })
const browser = await pw.chromium.launch()
const page = await browser.newPage()
const sent = []
await page.exposeFunction('__recordGoatEvent', (event) => sent.push(event))
await page.addInitScript(() => {
  window.goatcounter = { count(event) { window.__recordGoatEvent(event) } }
})
const events = () => sent
const key = (token) => ({ '<CR>': 'Enter', '<Esc>': 'Escape', '<C-a>': 'Control+a', '<C-b>': 'Control+b', '<C-u>': 'Control+u' }[token] ?? token)

await page.goto('http://localhost:4173/?lang=ko#hjkl')
assert.deepEqual((await events()).at(-1), { path: '/main/hjkl', title: 'nvim-edu' })
for (const key of tokenize(levels.find((level) => level.id === 'hjkl').solution)) await page.keyboard.press(key === '<CR>' ? 'Enter' : key)
assert.ok((await events()).some((event) => event.path === 'level-cleared/hjkl' && event.event === true))
await Promise.all([page.waitForNavigation(), page.locator('#lang').click()])
assert.ok((await events()).some((event) => event.path === 'language/en' && event.event === true))
await page.goto('http://localhost:4173/#mission-move')
for (let round = 0; round < 10; round++) {
  for (const token of tokenize(await page.evaluate(() => window.__edu.level.solution))) await page.keyboard.press(key(token))
  await page.waitForTimeout(round < 9 ? 300 : 50)
}
assert.ok((await events()).some((event) => event.path === 'drill-finished/mission-move' && event.event === true))
await page.goto('http://localhost:4173/real/#hjkl')
assert.ok((await events()).some((event) => event.path === 'real-vim-opened' && event.event === true))

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
