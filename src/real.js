// 진짜 Vim(vim.wasm) 모드: 에뮬레이터 대신 브라우저 안의 실제 Vim 8.2 로 레벨을 푼다.
// 상태는 Vim 의 titlestring 으로 받는다 — JS 가 명령 도중에 끼어들면 Vim 이 멈춰서(실측) Vim 이 스스로 그릴 때 보고하게 함
import { VimWasm, checkBrowserCompatibility } from 'vim-wasm'
import { t as tr } from './i18n.js'
import { initializeAnalytics, trackEvent, trackPageView } from './analytics.js'
import { $, escapeHtml, setupLevelPage } from './real-level.js'

const page = setupLevelPage({
  engine: { name: tr('진짜 Vim', 'real Vim', '真正的 Vim'), short: tr('진짜 Vim', 'real Vim', '真 Vim'), crumb: 'real vim' },
  sandboxDesc: tr('목표 없이 진짜 Vim 을 마음껏 써 보세요. <code>:help</code> 도 됩니다.', 'No goal: use real Vim freely. <code>:help</code> works too.', '没有目标：尽情使用真正的 Vim。<code>:help</code> 也能用。'),
})
const { level, lines, msg } = page
const file = `/work/${level.id}.${page.ext}`
$('#hint').onclick = () => { $('#hint-text').hidden = false; vim?.focus() }

// ── Vim 시작 ──
// 위치 → Vim 바이트 열 (한글 등 멀티바이트 대응)
const byteCol = (line, ch) => new TextEncoder().encode([...line].slice(0, ch).join('')).length + 1
const [cl, cc] = level.cursor
const vimrc = [
  // Neovim 기본값에 맞춤 — 여기서 익힌 손버릇이 Neovim 에서도 같게
  'set nocompatible number relativenumber shiftwidth=2 expandtab autoindent laststatus=2 ruler showcmd',
  'set nostartofline nrformats=bin,hex backspace=indent,eol,start hlsearch incsearch belloff=all',
  'nnoremap Y y$',
  'nnoremap & :&&<CR>',
  'syntax on',
  'set guifont=Menlo:h15', // 캔버스 글꼴 (COEP 때문에 웹폰트 없이 시스템 고정폭 글꼴)
  'function! EduState()',
  "  return json_encode({'lines': getline(1, '$'), 'line': line('.') - 1, 'col': strchars(strpart(getline('.'), 0, col('.') - 1)), 'mode': mode(1)})",
  'endfunction',
  'set title titlelen=0 titlestring=%{EduState()}',
  `call cursor(${cl + 1}, ${byteCol(lines[cl], cc)})`,
]
if (level.goal?.cursor) {
  const [tl, tc] = level.goal.cursor
  const ch = [...lines[tl]][tc] ?? ' '
  vimrc.push(
    'highlight EduTarget guibg=#9ece6a guifg=#16161e',
    `call matchaddpos('EduTarget', [[${tl + 1}, ${byteCol(lines[tl], tc)}, ${new TextEncoder().encode(ch).length}]])`,
    'setlocal nomodifiable', // 이동 과제는 텍스트를 바꿀 수 없게
  )
}

// 워커를 blob: URL 로 만든다. WebKit(Safari)은 워커 스크립트 요청을 서비스 워커에 태우지 않아 워커가 격리되지 않는데(실측),
// blob 워커는 페이지의 격리 상태를 물려받음. vim.js 는 importScripts 로 불러오고 wasm/data 위치는 locateFile 로 알려 줌
const base = new URL('./vim-wasm/', location.href).href
const workerSrc = `self.Module = { locateFile: (p) => ${JSON.stringify(base)} + p }; importScripts(${JSON.stringify(base + 'vim.js')});`
const workerUrl = URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' }))
let vim = null // SharedArrayBuffer 를 바로 만들므로 격리 확인 뒤 start() 안에서 생성
$('#vim-box').addEventListener('click', () => vim?.focus())

$('#vim-input').addEventListener('keydown', page.countKey, true)

function start() {
  const why = window.crossOriginIsolated ? checkBrowserCompatibility() : tr('SharedArrayBuffer 를 쓸 수 없음 (교차 출처 격리 실패)', 'SharedArrayBuffer unavailable (cross-origin isolation failed)', '无法使用 SharedArrayBuffer（跨源隔离失败）')
  if (why) {
    // shortcut: GitHub Pages 는 헤더를 못 붙여 서비스 워커로 우회 중. Safari 는 이 우회가 첫 방문에만 먹힘(실측) → 헤더를 붙일 수 있는 호스팅으로 옮기면 해결
    const safari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent)
    $('#vim-loading').innerHTML = `<div class="fallback">${safari ? tr('Safari 에서는 아직 진짜 Vim 모드를 쓸 수 없어요.', 'Real Vim mode does not work in Safari yet.', 'Safari 暂时还用不了真 Vim 模式。') : tr('이 브라우저에서는 진짜 Vim 을 실행할 수 없어요.', 'Real Vim cannot run in this browser.', '这个浏览器跑不了真正的 Vim。')}<br>
      <span class="dim">${escapeHtml(why)}</span><br>${tr('크롬 · 파이어폭스 · 엣지에서 열거나', 'Open it in Chrome, Firefox or Edge, or', '请用 Chrome、Firefox 或 Edge 打开，或者')} <a href="../#${level.id}">${tr('에뮬레이터로 연습하기 →', 'practice with the emulator →', '用模拟器练习 →')}</a></div>`
    return
  }
  vim = new VimWasm({ canvas: $('#vim-canvas'), input: $('#vim-input'), workerScriptPath: workerUrl })
  vim.onVimInit = () => { $('#vim-loading').hidden = true; vim.focus(); msg(`${tr('진짜 Vim 시작', 'Real Vim started', '真正的 Vim 已启动')} — ${file}`) }
  vim.onError = (e) => msg(`${tr('Vim 오류', 'Vim error', 'Vim 错误')}: ${e.message}`, 'error')
  vim.onTitleUpdate = (t) => { try { page.onState(JSON.parse(t)) } catch { /* 시작 직후 기본 제목 */ } }
  vim.start({ dirs: ['/work'], files: { [file]: level.start + '\n', '/work/edu.vim': vimrc.join('\n') }, cmdArgs: ['-S', '/work/edu.vim', file] })
}
initializeAnalytics()
// 이 페이지는 coi-serviceworker 설치·레벨 전환·언어 변경·다시 시작 때마다 새로고침되므로, 페이지 뷰는 격리된 로드마다, 진입 이벤트는 새로 들어온 로드(또는 탭의 첫 격리 로드)만 셈
if (window.crossOriginIsolated) {
  trackPageView(`/real/${level.id}`)
  try {
    if (performance.getEntriesByType('navigation')[0]?.type === 'navigate' || !sessionStorage.getItem('nvim-edu:real-opened')) {
      sessionStorage.setItem('nvim-edu:real-opened', '1')
      trackEvent('real-vim-opened')
    }
  } catch {}
}
// coi-serviceworker 가 처음 설치될 땐 페이지를 한 번 새로고침하므로, 격리된 상태에서만 시작
if (window.crossOriginIsolated) start()
else setTimeout(start, 6000) // 서비스 워커가 새로고침해 주지 않으면(미지원 브라우저 등) 6초 뒤 안내만 띄움

// e2e 테스트용
window.__real = { level, get done() { return page.done }, get count() { return page.count }, get state() { return page.state }, get ready() { return $('#vim-loading').hidden } }
