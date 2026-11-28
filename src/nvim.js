// 진짜 Neovim(nvim-wasm) 모드: 브라우저 안의 실제 Neovim(0.12-dev, WASI) 으로 레벨을 푼다.
// wasm 은 이 페이지에서, 지원 브라우저 · 큰 화면일 때만 받는다(메인 화면은 받지 않음). Asyncify 빌드라 COOP/COEP 가 필요 없음.
// 상태는 Neovim 이 SafeState · ModeChanged 때 rpcnotify 로 보고 (명령 도중에 JS 가 끼어들지 않게)
import { encode } from '../vendor/nvim-wasm/msgpack.js'
import { t as tr } from './i18n.js'
import { initializeAnalytics, trackEvent, trackPageView } from './analytics.js'
import { $, escapeHtml, setupLevelPage } from './real-level.js'
import { NvimGrid } from './nvim-grid.js'

const page = setupLevelPage({
  engine: { name: tr('진짜 Neovim', 'real Neovim', '真正的 Neovim'), short: tr('진짜 Neovim', 'real Neovim', '真 Neovim'), crumb: 'real nvim' },
  sandboxDesc: tr('목표 없이 진짜 Neovim 을 마음껏 써 보세요. 문서(<code>:help</code>)는 다운로드 크기 때문에 빠져 있어요.', 'No goal: use real Neovim freely. The docs (<code>:help</code>) are left out to keep the download small.', '没有目标：尽情使用真正的 Neovim。为了减小下载量，没有包含文档（<code>:help</code>）。'),
})
const { level, msg } = page
const file = `work/${level.id}.${page.ext}`
const gridEl = $('#nvim-grid')
const loading = $('#vim-loading')
$('#hint').onclick = () => { $('#hint-text').hidden = false; gridEl.focus() }
$('#vim-box').addEventListener('click', () => gridEl.focus())

const SIZE = tr('처음 한 번 약 2.9MB', 'about 2.9MB the first time', '首次约 2.9MB')
const emulatorLink = `<a href="../#${level.id}">${tr('에뮬레이터로 연습하기 →', 'practice with the emulator →', '用模拟器练习 →')}</a>`

// 이 브라우저에서 못 돌리는 이유 (없으면 null). wasm 예외 처리(setjmp/longjmp) · 모듈 워커 · gzip 해제가 필요
function unsupportedReason() {
  if (typeof WebAssembly !== 'object' || typeof WebAssembly.Tag !== 'function' || typeof WebAssembly.Exception !== 'function') return 'WebAssembly exception handling'
  if (typeof Worker !== 'function') return 'Web Worker'
  if (typeof DecompressionStream !== 'function') return 'DecompressionStream'
  return null
}
// 작은 화면 · 터치 전용 기기: 물리 키보드가 없을 가능성이 크고 다운로드도 커서 먼저 묻는다
const smallScreen = () => matchMedia('(max-width: 720px)').matches || (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches)

function showFallback(html) {
  loading.hidden = false
  loading.innerHTML = `<div class="fallback">${html}</div>`
}

// ── 키 → Neovim 키 표기 (nvim_input) ──
const SPECIAL = {
  Escape: 'Esc', Enter: 'CR', Backspace: 'BS', Tab: 'Tab', Delete: 'Del', Insert: 'Insert', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
}
function toNvimKey(e) {
  if (e.metaKey) return null // ⌘ 단축키(복사 · 탭 닫기 등)는 브라우저에
  const altGr = e.getModifierState?.('AltGraph')
  const mods = altGr ? '' : `${e.ctrlKey ? 'C-' : ''}${e.altKey ? 'M-' : ''}`
  const special = SPECIAL[e.key] ?? (/^F\d{1,2}$/.test(e.key) ? e.key : null)
  if (special) return `<${mods}${e.shiftKey ? 'S-' : ''}${special}>`
  if ([...e.key].length !== 1) return null // Shift · Dead · Process(IME) 등
  if (!mods) return e.key === '<' ? '<lt>' : e.key
  return `<${mods}${e.key === '<' ? 'lt' : e.key === ' ' ? 'Space' : e.key}>`
}

// ── 시작할 때 (--cmd, 파일을 읽기 전) ──
// nvim-wasm 의 libuv 는 디렉터리를 못 읽어서(uv_fs_scandir = ENOSYS) glob 을 쓰는 :runtime! 과 runtimepath 의 Lua 모듈 찾기가 안 됨.
// 1) 런타임 Lua 모듈은 package.path 로 찾게 하고 2) 문법 파일은 정확한 이름으로 불러옴 (Syntax 자동 명령 뒤에, 아직 안 불렸을 때만).
// 3) 파일 형식 플러그인 · 들여쓰기 스크립트는 끔: 진짜 Vim 페이지 · tests/nvim-diff 처럼 모든 레벨이 같은 조건(형식별 설정 없음)에서 동작하게
const BOOT_LUA = [
  "local rt = vim.env.VIMRUNTIME",
  "package.path = rt .. '/lua/?.lua;' .. rt .. '/lua/?/init.lua;' .. package.path",
  "vim.cmd('filetype plugin indent off')",
  // 자기 augroup 에 둠: syntax/synload.vim 의 `au! Syntax` 가 기본 그룹을 지움
  "vim.api.nvim_create_autocmd('Syntax', { group = vim.api.nvim_create_augroup('edu_runtime', {}), callback = function(a)",
  "  if not a.match:match('^[%w_]+$') or a.match == 'OFF' or a.match == 'ON' then return end",
  "  vim.schedule(function()",
  "    if vim.api.nvim_buf_is_valid(a.buf) and vim.b[a.buf].current_syntax == nil then",
  "      vim.api.nvim_buf_call(a.buf, function() vim.cmd('runtime syntax/' .. a.match .. '.vim') end)",
  "    end",
  "  end)",
  "end })",
].join(' ')

// ── Neovim 쪽 설정: 기본값에 레벨 화면용 몇 가지만 (에뮬레이터 · tests/nvim-diff 와 같은 shiftwidth=2) ──
const SETUP_LUA = `
local chan, cursor, target = ...
local function setup()
  vim.o.number = true
  vim.o.relativenumber = true
  vim.o.shiftwidth = 2
  vim.o.expandtab = true
  vim.o.mouse = ''
  local buf = vim.api.nvim_get_current_buf()
  vim.bo[buf].readonly = false -- WASI 가상 파일은 쓰기 권한이 안 보여 [RO] 로 열림 (W10 경고가 뜨지 않게)
  vim.fn.setcursorcharpos(cursor[1] + 1, cursor[2] + 1)
  if target ~= vim.NIL then
    local line = vim.api.nvim_buf_get_lines(buf, target[1], target[1] + 1, true)[1]
    local ch = vim.fn.strcharpart(line, target[2], 1)
    vim.api.nvim_set_hl(0, 'EduTarget', { bg = '#9ece6a', fg = '#16161e' })
    vim.fn.matchaddpos('EduTarget', { { target[1] + 1, vim.fn.byteidx(line, target[2]) + 1, math.max(#ch, 1) } })
    vim.bo[buf].modifiable = false -- 이동 과제는 텍스트를 바꿀 수 없게
  end
  local function report()
    local pos = vim.api.nvim_win_get_cursor(0)
    vim.rpcnotify(chan, 'edu_state', {
      lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false),
      line = pos[1] - 1,
      col = vim.fn.charcol('.') - 1,
      mode = vim.api.nvim_get_mode().mode,
    })
  end
  vim.api.nvim_create_autocmd({ 'SafeState', 'ModeChanged' }, { callback = report })
  report()
end
if vim.v.vim_did_enter == 1 then setup() else vim.api.nvim_create_autocmd('VimEnter', { once = true, callback = setup }) end
`

const timing = { start: 0, loaded: 0, interactive: 0 }
let worker = null
let reqId = 0
const pending = new Map()
const send = (msg) => worker.postMessage({ type: 'stdin', chunk: encode(msg) })
const notify = (method, params) => send([2, method, params])
const request = (method, params) => new Promise((resolve, reject) => {
  pending.set(reqId, { resolve, reject })
  send([0, reqId++, method, params])
})

function measureGrid() {
  const probe = document.createElement('span')
  probe.textContent = 'M'.repeat(20)
  gridEl.appendChild(probe)
  const box = probe.getBoundingClientRect()
  probe.remove()
  const cell = box.width / 20
  const line = Math.ceil(box.height)
  gridEl.style.setProperty('--nvim-cell', `${cell}px`)
  gridEl.style.setProperty('--nvim-line', `${line}px`)
  return { cols: Math.max(20, Math.floor(gridEl.clientWidth / cell)), rows: Math.max(8, Math.floor(gridEl.clientHeight / line)) }
}

function start() {
  loading.hidden = false
  loading.textContent = `${tr('진짜 Neovim 불러오는 중…', 'Loading real Neovim…', '正在加载真正的 Neovim…')} (${SIZE})`
  timing.start = performance.now()
  const grid = new NvimGrid(gridEl)
  const size = measureGrid()
  worker = new Worker(new URL('./nvim-worker.js', import.meta.url), { type: 'module' })
  worker.onerror = (e) => fail(e.message)
  worker.onmessage = ({ data }) => {
    if (data.type === 'loaded') timing.loaded = performance.now() - timing.start
    else if (data.type === 'ready') attach(size).catch((e) => fail(e.message))
    else if (data.type === 'rpc') onRpc(data.msg, grid)
    else if (data.type === 'fatal') fail(data.message)
    else if (data.type === 'exit') msg(`${tr('Neovim 종료', 'Neovim exited', 'Neovim 已退出')} (${data.code}) — ${tr('↺ 처음부터 를 누르면 다시 시작해요', 'press ↺ Restart to start again', '按 ↺ 重新开始 可以再启动')}`, data.code ? 'error' : '')
  }
  worker.postMessage({
    type: 'start',
    wasmUrl: new URL('./nvim-wasm/nvim.wasm', location.href).href,
    runtimeUrl: new URL('./nvim-wasm/runtime.tar.gz', location.href).href,
    args: ['--embed', '--clean', '-n', '--cmd', `lua ${BOOT_LUA}`, `/nvim/${file}`],
    files: { [file]: level.start + '\n' },
  })
  window.addEventListener('resize', () => {
    const { cols, rows } = measureGrid()
    if (cols !== grid.width || rows !== grid.height) notify('nvim_ui_try_resize', [cols, rows])
  })
}

// nvim_get_api_info 는 RPC 전용이라 Lua 에서 못 부름 → 채널 번호를 받아서 설정 Lua 에 넘김
async function attach(size) {
  const [chan] = await request('nvim_get_api_info', [])
  await request('nvim_ui_attach', [size.cols, size.rows, { rgb: true, ext_linegrid: true }])
  await request('nvim_exec_lua', [SETUP_LUA, [chan, level.cursor, level.goal?.cursor ?? null]])
}

function onRpc(m, grid) {
  if (m[0] === 2 && m[1] === 'redraw') grid.redraw(m[2])
  else if (m[0] === 2 && m[1] === 'edu_state') {
    if (!timing.interactive) {
      timing.interactive = performance.now() - timing.start
      loading.hidden = true
      gridEl.focus()
      msg(`${tr('진짜 Neovim 시작', 'Real Neovim started', '真正的 Neovim 已启动')} — ${file}`)
    }
    page.onState(m[2][0])
  } else if (m[0] === 1) {
    const { resolve, reject } = pending.get(m[1]) ?? {}
    pending.delete(m[1])
    if (m[2]) reject?.(new Error(m[2][1] ?? JSON.stringify(m[2])))
    else resolve?.(m[3])
  }
  else if (m[0] === 0) send([1, m[1], 'not supported in nvim-edu', null]) // 클립보드 등 UI 에 묻는 요청
}

function fail(message) {
  worker?.terminate()
  showFallback(`${tr('진짜 Neovim 을 시작하지 못했어요.', 'Real Neovim could not start.', '真正的 Neovim 没能启动。')}<br><span class="dim">${escapeHtml(message ?? '')}</span><br>${emulatorLink}`)
}

gridEl.addEventListener('keydown', (e) => {
  if (!timing.interactive) return
  const key = toNvimKey(e)
  if (!key && !e.isComposing && e.keyCode !== 229) return
  const counted = page.countKey(e)
  if (!key || (!counted && !page.done)) return // 수식 키 · 한글 입력은 보내지 않음
  e.preventDefault()
  notify('nvim_input', [key])
})
gridEl.addEventListener('paste', (e) => {
  e.preventDefault()
  if (worker) notify('nvim_paste', [e.clipboardData.getData('text/plain'), false, -1])
})

initializeAnalytics()
trackPageView(`/nvim/${level.id}`)
try {
  // 레벨 전환 · 다시 시작도 새로고침이라, 진입 이벤트는 새로 들어온 로드(또는 탭의 첫 로드)만 셈
  if (performance.getEntriesByType('navigation')[0]?.type === 'navigate' || !sessionStorage.getItem('nvim-edu:nvim-opened')) {
    sessionStorage.setItem('nvim-edu:nvim-opened', '1')
    trackEvent('real-nvim-opened')
  }
} catch {}

const why = unsupportedReason()
if (why) {
  showFallback(`${tr('이 브라우저에서는 진짜 Neovim 을 실행할 수 없어요.', 'Real Neovim cannot run in this browser.', '这个浏览器跑不了真正的 Neovim。')}<br>
    <span class="dim">${tr('필요한 기능', 'Missing', '缺少功能')}: ${escapeHtml(why)}</span><br>${tr('최신 크롬 · 파이어폭스 · 사파리 · 엣지에서 열거나', 'Open it in a recent Chrome, Firefox, Safari or Edge, or', '请用最新的 Chrome、Firefox、Safari 或 Edge 打开，或者')} ${emulatorLink}`)
} else if (smallScreen()) {
  showFallback(`${tr('진짜 Neovim 은 물리 키보드와 넓은 화면이 필요하고, 내려받을 파일이 커요', 'Real Neovim needs a physical keyboard and a wider screen, and the download is large', '真正的 Neovim 需要实体键盘和更宽的屏幕，下载量也比较大')} (${SIZE}).<br>
    ${emulatorLink}<br><button id="nvim-anyway">${tr('그래도 시작하기', 'Start anyway', '仍然启动')}</button>`)
  $('#nvim-anyway').onclick = start
} else start()

// e2e 테스트용 (real/ 의 window.__real 과 같은 모양 + 로딩 시간)
window.__real = { level, timing, get started() { return worker !== null }, get done() { return page.done }, get count() { return page.count }, get state() { return page.state }, get ready() { return timing.interactive > 0 } }
