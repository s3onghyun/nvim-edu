// 진짜 Neovim(nvim-wasm) 페이지:
// 1) 메인 화면은 wasm 을 받지 않음(지연 로딩)  2) 작은 화면 · 미지원 브라우저는 안내만 띄우고 받지 않음
// 3) 모든 Vim 레벨을 모범 답안으로 풀어서 클리어되는지, 타수가 par 와 같은지  4) CSP 위반 없음
import { preview } from 'vite'
import * as pw from 'playwright-core'
import { levels, tokenize } from '../src/levels.js'
import { solveReport } from './level-report.mjs'
import { watchCsp } from './csp.mjs'

const KEY_GAP = Number(process.env.KEY_GAP ?? 20)
const KEY = { '<Esc>': 'Escape', '<CR>': 'Enter', '<C-a>': 'Control+a', '<C-v>': 'Control+v' }
const BASE = process.env.BASE_URL ?? 'http://localhost:4177/'
const server = process.env.BASE_URL ? null : await preview({ preview: { port: 4177, strictPort: true } })
const name = process.env.BROWSER ?? 'chromium'
const QS = process.env.UI_LANG ? `?lang=${process.env.UI_LANG}` : ''
const browser = await pw[name].launch({ executablePath: process.env.BROWSER_PATH || undefined })
let failed = 0
const check = (ok, label, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${!ok && detail ? `\n  ${detail}` : ''}`)
}
const NVIM_ASSET = /nvim-wasm\/|nvim-worker|\.wasm(\?|$)/
const watchRequests = (page) => {
  const urls = []
  page.on('request', (r) => urls.push(r.url()))
  return urls
}

// 1) 메인 화면(대시보드 · 레벨)은 nvim 파일을 하나도 받지 않음
{
  const page = await browser.newPage()
  const urls = watchRequests(page)
  await page.goto(`${BASE}${QS}`)
  await page.waitForFunction(() => window.__edu)
  await page.goto(`${BASE}${QS}#hjkl`)
  await page.waitForFunction(() => window.__edu?.level?.id === 'hjkl')
  await page.waitForLoadState('networkidle')
  const hit = urls.filter((u) => NVIM_ASSET.test(u))
  check(hit.length === 0, 'main page loads no nvim-wasm file', JSON.stringify(hit))
  const nvimLink = await page.getAttribute('#nvim-link', 'href')
  check(nvimLink === 'nvim/#hjkl', 'level page links to real Neovim', nvimLink)
  await page.goto(`${BASE}${QS}`)
  const credits = await page.$$eval('.credits a', (as) => as.map((a) => a.getAttribute('href')))
  check(['https://github.com/MuNeNiCK/nvim-wasm', 'https://neovim.io/', 'THIRD_PARTY_NOTICES.txt'].every((h) => credits.includes(h)), 'dashboard credits nvim-wasm and Neovim', JSON.stringify(credits))
  const notices = await page.request.get(`${BASE}THIRD_PARTY_NOTICES.txt`)
  check(notices.ok() && (await notices.text()).includes('Copyright (c) 2025 MuNeNiCK'), 'THIRD_PARTY_NOTICES.txt is deployed')
  await page.close()
}

// 2) 대체 경로: 작은 터치 화면은 묻고, 미지원 브라우저는 에뮬레이터 안내. 둘 다 wasm 을 받지 않음
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await context.newPage()
  const urls = watchRequests(page)
  await page.goto(`${BASE}nvim/${QS}#hjkl`)
  await page.waitForSelector('.fallback #nvim-anyway')
  await page.waitForTimeout(500)
  const emulator = await page.getAttribute('.fallback a', 'href')
  check(!urls.some((u) => NVIM_ASSET.test(u)) && emulator === '../#hjkl' && !(await page.evaluate(() => window.__real.started)), 'small screen: notice + emulator link, no download', JSON.stringify(urls.filter((u) => NVIM_ASSET.test(u))))
  await context.close()
}
{
  const context = await browser.newContext()
  await context.addInitScript(() => { delete window.DecompressionStream })
  const page = await context.newPage()
  const urls = watchRequests(page)
  await page.goto(`${BASE}nvim/${QS}#hjkl`)
  await page.waitForSelector('.fallback')
  const text = await page.textContent('.fallback')
  check(!urls.some((u) => NVIM_ASSET.test(u)) && text.includes('DecompressionStream') && !(await page.$('#nvim-anyway')), 'unsupported browser: notice, no download', text)
  await context.close()
}

// 3) 모든 Vim 레벨을 진짜 Neovim 에서
const page = await browser.newPage()
const csp = await watchCsp(page)
page.on('pageerror', (e) => console.log('pageerror:', e.message))
const times = []
for (const level of levels.filter((l) => !l.kind)) {
  await page.goto('about:blank') // 해시만 바뀌면 페이지가 스스로 새로고침하므로, 깨끗하게 새로 연다
  await page.goto(`${BASE}nvim/${QS}#${level.id}`)
  await page.waitForFunction(() => window.__real?.ready || document.querySelector('.fallback'), null, { timeout: 60000 })
  if (!(await page.evaluate(() => window.__real.ready))) {
    check(false, `nvim:${level.id} started`, await page.textContent('.fallback'))
    break
  }
  times.push(await page.evaluate(() => window.__real.timing))
  if (level.id === 'dd') {
    // 문법 강조: nvim-wasm 은 디렉터리를 못 읽어 syntax/javascript.vim 을 src/nvim.js 가 직접 불러옴 — 문자열이 색으로 칠해져야 함
    await page.waitForFunction(() => [...document.querySelectorAll('#nvim-grid span')].some((s) => s.textContent === '"debug 1"' && s.style.color), null, { timeout: 5000 }).catch(() => {})
    check(await page.evaluate(() => [...document.querySelectorAll('#nvim-grid span')].some((s) => s.textContent === '"debug 1"' && s.style.color)), 'nvim:dd syntax highlighting (javascript strings)')
  }
  await page.focus('#nvim-grid')
  const tokens = tokenize(level.solution)
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
  console.log(ok ? `PASS nvim:${level.id} done=${done} count=${count}/${tokens.length}` : solveReport('진짜 Neovim(nvim-wasm) 풀이', level, tokens, got))
}
if (times.length) {
  const ms = (k, list) => Math.round(list.reduce((a, t) => a + t[k], 0) / list.length)
  console.log(`timing ${name}: first load interactive=${Math.round(times[0].interactive)}ms (download+compile ${Math.round(times[0].loaded)}ms); cached avg interactive=${ms('interactive', times.slice(1))}ms over ${times.length - 1} loads`)
}

// 4) nvim/index.html 의 Content-Security-Policy: 모든 레벨을 푸는 동안 위반 0건
check(csp.length === 0, 'CSP: no violations', JSON.stringify(csp))

await browser.close()
server?.httpServer.close()
console.log(`nvim ${name}: ${failed ? `${failed} FAIL` : 'ALL PASS'}`)
process.exit(failed ? 1 : 0)
