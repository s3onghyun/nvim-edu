// 같은 키 입력을 실제 Neovim 과 이 사이트의 에디터에 넣고 결과를 비교한다.
// 사용: npm run build && node tests/nvim-diff.mjs   (nvim 이 PATH 에 있어야 함)
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { preview } from 'vite'
import * as pw from 'playwright-core'
import { cases } from './nvim-diff/cases.mjs'
import { tokenize } from '../src/levels.js'
import { expected } from './level-report.mjs'

const KEY = {
  '<Esc>': 'Escape', '<CR>': 'Enter', '<BS>': 'Backspace',
  '<C-a>': 'Control+a', '<C-x>': 'Control+x', '<C-r>': 'Control+r', '<C-v>': 'Control+v', '<C-w>': 'Control+w',
}

// 1) 실제 Neovim
const dir = mkdtempSync(join(tmpdir(), 'nvim-diff-'))
writeFileSync(join(dir, 'in.json'), JSON.stringify(cases.map(([, text, cursor, keys]) => ({ text, cursor, keys }))))
execFileSync('nvim', ['--clean', '--headless', '-l', new URL('./nvim-diff/runner.lua', import.meta.url).pathname, join(dir, 'in.json'), join(dir, 'out.json')], { stdio: 'inherit' })
const real = JSON.parse(readFileSync(join(dir, 'out.json'), 'utf8'))

// 2) 사이트 에디터 (케이스마다 새로 로드해서 레지스터·매크로가 섞이지 않게)
const server = await preview({ preview: { port: 4174 } })
const browser = await pw[process.env.BROWSER ?? 'chromium'].launch()
const page = await browser.newPage()
const ours = []
for (const [, text, cursor, keys] of cases) {
  await page.goto('http://localhost:4174/#sandbox')
  await page.reload()
  await page.waitForSelector('.cm-content')
  await page.evaluate(([t, c]) => window.__edu.mountText(t, c), [text, cursor])
  for (const k of tokenize(keys)) {
    if (KEY[k]) await page.keyboard.press(KEY[k])
    else await page.keyboard.type(k)
  }
  await page.waitForTimeout(30)
  ours.push(await page.evaluate(() => window.__edu.editor))
}
await browser.close()
server.httpServer.close()

// 3) 비교
const diffs = []
cases.forEach(([name, , , keys], i) => {
  const a = real[i], b = ours[i]
  const why = []
  if (a.text !== b.text) why.push('텍스트')
  if (a.cursor[0] !== b.cursor[0] || a.cursor[1] !== b.cursor[1]) why.push(`커서 nvim ${a.cursor} / 사이트 ${b.cursor}`)
  if (a.mode !== b.mode) why.push(`모드 nvim ${a.mode} / 사이트 ${b.mode}`)
  if (why.length) diffs.push({ name, keys, why, nvim: a, site: b })
})
// 기대 = 실제 Neovim, 실제 = 사이트 에디터. 레벨 케이스는 "레벨:<id>" 로 나옴
for (const d of diffs) {
  console.log(`DIFF ${d.name} [실제 Neovim 비교]  keys ${JSON.stringify(d.keys)}  다른 곳: ${d.why.join(', ')}`)
  if (d.nvim.text !== d.site.text) console.log(expected('버퍼', d.nvim.text, d.site.text).map((l) => `  ${l}`).join('\n'))
  console.log(expected('커서', d.nvim.cursor, d.site.cursor).map((l) => `  ${l}`).join('\n'))
}
console.log(`\n${cases.length}개 중 ${cases.length - diffs.length}개 일치, ${diffs.length}개 다름`)
process.exit(diffs.length ? 1 : 0)
