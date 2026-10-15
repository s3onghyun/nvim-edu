// 사용자 실사용에서 나온 버그 재발 방지: undo/redo, df{없는 글자}, 한글 IME 조합 후 키 입력
import { preview } from 'vite'
import * as pw from 'playwright-core'
import { levels } from '../src/levels.js'

const BASE = process.env.BASE_URL ?? 'http://localhost:4178/'
const server = process.env.BASE_URL ? null : await preview({ preview: { port: 4178 } })
const name = process.env.BROWSER ?? 'chromium'
const browser = await pw[name].launch()
const page = await browser.newPage()
let failed = 0

const state = () => page.evaluate(() => ({ doc: document.querySelector('.cm-content').innerText, pos: document.querySelector('#pos').textContent }))
// 메시지 문구를 한국어로 검사하므로 언어 고정
async function open(id) { await page.goto(`${BASE}?lang=ko#${id}`); await page.reload(); await page.waitForSelector('.cm-content') }
function expect(label, actual, want) {
  const ok = JSON.stringify(actual) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : `\n  got  ${JSON.stringify(actual)}\n  want ${JSON.stringify(want)}`}`)
}

// 1) u / Ctrl-r
await open('x')
await page.keyboard.type('x')
expect('x 후 한 글자 삭제', (await state()).doc, 'elllo, Vimm!')
await page.keyboard.type('u')
expect('u 로 되돌리기', (await state()).doc, 'Helllo, Vimm!')
await page.keyboard.press('Control+r')
expect('Ctrl-r 로 다시 하기', (await state()).doc, 'elllo, Vimm!')
await open('dd')
await page.keyboard.type('jddu')
expect('dd 후 u', (await state()).doc.split('\n').length, 6)

// 2) f 가 실패하면 아무 일도 없어야 함 (실제 Vim 동작)
await open('x')
await page.keyboard.type('dfd')
expect('dfd (d 없음) → 변화 없음', await state(), { doc: 'Helllo, Vimm!', pos: '1:1' })
await page.keyboard.type('Fx')
expect('줄 맨 앞에서 F → 변화 없음', (await state()).pos, '1:1')
await page.keyboard.type('fl;')
expect('f 와 ; 반복은 그대로 동작', (await state()).pos, '1:4')
await page.keyboard.type(',')
expect(', 역방향 반복', (await state()).pos, '1:3')

// 2-1) 방향키: 1장(이동)에선 막고, 그 뒤 레벨에선 실제 Vim 처럼 동작
await open('hjkl')
await page.keyboard.press('ArrowRight')
expect('1장에선 방향키 막힘', (await state()).pos, '1:1')
await open('x')
await page.keyboard.press('ArrowRight')
expect('2장부터는 방향키 이동', (await state()).pos, '1:2')

// 2-2) 언어 버튼: #레벨 이 붙은 주소에서도 바로 전환 (전엔 해시만 같은 주소라 새로고침이 안 됐음)
await open('hjkl')
const langButton = () => page.evaluate(() => {
  const button = document.querySelector('#lang')
  button.focus()
  const style = getComputedStyle(button)
  return {
    text: button.innerText.trim(),
    label: button.getAttribute('aria-label'),
    hasIcon: !!button.querySelector('.lang-icon'),
    focused: document.activeElement === button,
    bordered: style.borderTopColor !== 'rgba(0, 0, 0, 0)' && style.borderTopStyle !== 'none',
  }
})
const langKo = { text: 'EN', label: 'EN 언어 전환', hasIcon: true, focused: true, bordered: true }
const langEn = { text: '한국어', label: '한국어 Switch language', hasIcon: true, focused: true, bordered: true }
expect('언어 버튼은 아이콘·이름·테두리·키보드 포커스를 제공', await langButton(), langKo)
await Promise.all([page.waitForEvent('load'), page.click('#lang')])
expect('레벨 화면에서 언어 버튼 → 영어', await langButton(), langEn)
await Promise.all([page.waitForEvent('load'), page.click('#lang')])
expect('다시 누르면 한국어', await langButton(), langKo)
for (const [l, want] of [['ko', langKo], ['en', langEn]]) {
  await page.goto(`${BASE}real/?lang=${l}#x`)
  // 첫 방문은 서비스 워커가 한 번 새로고침하므로, 격리(또는 안내)까지 기다려야 다음 goto 가 끊기지 않음
  await page.waitForFunction(() => document.querySelector('#lang').innerText.trim() && (window.crossOriginIsolated || document.querySelector('.fallback')), null, { timeout: 30000 })
  expect(`진짜 Vim 화면 언어 버튼 (${l})`, await langButton(), want)
}

// 3) 한글 IME (Chromium 만: CDP 로 실제 IME 와 같은 순서의 이벤트를 보냄)
if (name === 'chromium') {
  const cdp = await page.context().newCDPSession(page)
  const key229 = () => cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Process', code: 'KeyJ', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 })
  // 2벌식 ㅓ ㅓ ㅣ: 첫 ㅓ 조합 → 확정 후 새 ㅓ 조합 → ㅓ+ㅣ=ㅔ 조합 중인 채로 끝
  async function koreanTyping() {
    await key229(); await cdp.send('Input.imeSetComposition', { text: 'ㅓ', selectionStart: 1, selectionEnd: 1 })
    await key229(); await cdp.send('Input.insertText', { text: 'ㅓ' }); await cdp.send('Input.imeSetComposition', { text: 'ㅓ', selectionStart: 1, selectionEnd: 1 })
    await key229(); await cdp.send('Input.imeSetComposition', { text: 'ㅔ', selectionStart: 1, selectionEnd: 1 })
    await page.waitForTimeout(100)
  }
  await open('x')
  await page.keyboard.type('dfdf')
  await koreanTyping()
  expect('dfdf + ㅓㅓㅣ → 문서·커서 그대로', await state(), { doc: 'Helllo, Vimm!', pos: '1:1' })
  expect('한/영 전환 안내', await page.locator('#cmdline').innerText(), '한/영 키로 영문 전환! NORMAL 모드 명령은 영문으로만 동작해요')
  await page.keyboard.press('Escape')
  await page.keyboard.type('l')
  expect('영문으로 돌아와 l → 글자 입력이 아니라 이동', await state(), { doc: 'Helllo, Vimm!', pos: '1:2' })
  await page.keyboard.type('3lx')
  expect('이어서 3lx 정상', (await state()).doc, 'Hello, Vimm!')
  await page.keyboard.type('i')
  await cdp.send('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 })
  await cdp.send('Input.insertText', { text: '한' })
  await page.keyboard.press('Escape')
  expect('INSERT 모드 한글 입력은 정상', (await state()).doc.includes('한'), true)
  await page.keyboard.type('u')
  expect('한글 입력도 u 로 되돌리기', (await state()).doc, 'Hello, Vimm!')
}

// 5) 폰 폭(390px)에서 페이지가 가로로 밀리지 않음 (긴 레벨 제목·정규식 때문에 생겼던 문제). 해설 표도 펼쳐서 확인
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } })
const wide = []
for (const id of ['', ...levels.map((l) => l.id)]) {
  for (const lang of ['ko', 'en']) {
    await phone.goto('about:blank'); await phone.goto(`${BASE}?lang=${lang}#${id}`); await phone.waitForTimeout(150)
    if (id && !levels.find((l) => l.id === id).kind) await phone.click('#hint')
    const w = await phone.evaluate(() => document.documentElement.scrollWidth)
    if (w > 390) wide.push(`${lang}#${id} ${w}px`)
  }
}
expect('390px 폭에서 가로 스크롤 없음', wide, [])

await browser.close()
server?.httpServer.close()
console.log(`regress ${name}: ${failed ? `${failed} FAIL` : 'ALL PASS'}`)
process.exit(failed ? 1 : 0)
