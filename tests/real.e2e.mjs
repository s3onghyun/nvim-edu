// 진짜 Vim(vim.wasm) 페이지: 모든 Vim 레벨을 모범 답안으로 풀어서 클리어되는지, 타수가 par 와 같은지
import { preview } from 'vite'
import * as pw from 'playwright-core'
import { levels, tokenize } from '../src/levels.js'
import { solveReport } from './level-report.mjs'

const KEY_GAP = Number(process.env.KEY_GAP ?? 40)
const KEY = { '<Esc>': 'Escape', '<CR>': 'Enter', '<C-a>': 'Control+a', '<C-v>': 'Control+v' }
const BASE = process.env.BASE_URL ?? 'http://localhost:4171/'
const server = process.env.BASE_URL ? null : await preview({ preview: { port: 4171 } })
const name = process.env.BROWSER ?? 'chromium'
// UI_LANG=en 이면 영어 화면으로 (레벨 데이터도 node 쪽에서 같은 언어로 불러옴)
const QS = process.env.UI_LANG ? `?lang=${process.env.UI_LANG}` : ''
const browser = await pw[name].launch()
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('pageerror:', e.message))
let failed = 0

// 첫 방문: 서비스 워커 설치 후 한 번 새로고침되어 crossOriginIsolated 가 됨
await page.goto(`${BASE}real/${QS}`)
await page.waitForFunction(() => window.crossOriginIsolated, null, { timeout: 30000 })
console.log(`${name}: crossOriginIsolated OK`)

// WebKit(Safari): GitHub Pages + 서비스 워커 방식에선 두 번째 방문부터 격리가 안 됨(실측) → 오류 대신 안내가 떠야 함
if (name === 'webkit') {
  const p2 = await browser.newPage()
  const errors = []
  p2.on('pageerror', (e) => errors.push(e.message))
  await p2.goto(`${BASE}real/${QS}#x`)
  await p2.waitForFunction(() => window.__real?.ready || document.querySelector('.fallback'), null, { timeout: 15000 })
  const r = await p2.evaluate(() => (window.__real.ready ? 'vim 실행' : 'fallback 안내'))
  const ok = errors.length === 0
  console.log(`${ok ? 'PASS' : 'FAIL'} webkit 두 번째 방문: ${r}${errors.length ? ` errors=${errors}` : ''}`)
  console.log(`real ${name}: ${ok ? 'ALL PASS' : '1 FAIL'}`)
  await browser.close(); server?.httpServer.close(); process.exit(ok ? 0 : 1)
}

for (const level of levels.filter((l) => !l.kind)) {
  await page.goto('about:blank') // 해시만 바뀌면 페이지가 스스로 새로고침하므로, 깨끗하게 새로 연다
  await page.goto(`${BASE}real/${QS}#${level.id}`)
  await page.waitForFunction(() => window.__real?.ready && window.__real.state, null, { timeout: 30000 })
  await page.focus('#vim-input')
  const tokens = tokenize(level.solution)
  // 사람 속도(키 사이 40ms)로 입력. 0ms 연타에서는 vim.wasm 이 키를 섞는 경우가 있었음(실측: df. 가 다른 결과)
  for (const t of tokens) {
    if (KEY[t]) await page.keyboard.press(KEY[t])
    else await page.keyboard.press(t === ' ' ? 'Space' : t)
    await page.waitForTimeout(KEY_GAP)
  }
  await page.waitForFunction(() => window.__real.done, null, { timeout: 3000 }).catch(() => {})
  const { done, count, state } = await page.evaluate(() => ({ done: window.__real.done, count: window.__real.count, state: window.__real.state }))
  const ok = done && count === tokens.length
  if (!ok) failed++
  const got = { done, count, text: state?.lines.join('\n'), cursor: state && [state.line, state.col], mode: state?.mode }
  console.log(ok ? `PASS real:${level.id} done=${done} count=${count}/${tokens.length}` : solveReport('진짜 Vim(vim.wasm) 풀이', level, tokens, got))
}

await browser.close()
server?.httpServer.close()
console.log(`real ${name}: ${failed ? `${failed} FAIL` : 'ALL PASS'}`)
process.exit(failed ? 1 : 0)
