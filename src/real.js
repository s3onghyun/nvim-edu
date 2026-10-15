// 진짜 Vim(vim.wasm) 모드: 에뮬레이터 대신 브라우저 안의 실제 Vim 8.2 로 레벨을 푼다.
// 상태는 Vim 의 titlestring 으로 받는다 — JS 가 명령 도중에 끼어들면 Vim 이 멈춰서(실측) Vim 이 스스로 그릴 때 보고하게 함
import { VimWasm, checkBrowserCompatibility } from 'vim-wasm'
import { chapters, levels, tokenize, stars } from './levels.js'
import { lang, t as tr, setLang, translateDom } from './i18n.js'
import { initializeAnalytics, trackEvent, trackPageView } from './analytics.js'
import './style.css'

const $ = (s) => document.querySelector(s)
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(`nvim-edu:${k}`)) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(`nvim-edu:${k}`, JSON.stringify(v)) } catch {} },
}
document.documentElement.dataset.scheme = store.get('scheme', 'tokyonight')
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
// 고정 문구 번역은 #chapter 등을 채우기 전에 (data-en 이 안쪽 span 을 새로 만듦)
translateDom()
const langText = lang === 'en' ? '한국어' : 'EN'
$('#lang').append(langText)
$('#lang').setAttribute('aria-label', `${langText} ${$('#lang').getAttribute('aria-label')}`)
$('#lang').onclick = () => setLang(lang === 'en' ? 'ko' : 'en')
const msg = (text, kind = '') => { $('#cmdline').textContent = text; $('#cmdline').className = kind }

const vimLevels = levels.filter((l) => !l.kind)
const SANDBOX = {
  id: 'sandbox', title: tr('자유 연습장', 'Free practice'), keys: [], lang: 'js', cursor: [0, 0],
  desc: tr('목표 없이 진짜 Vim 을 마음껏 써 보세요. <code>:help</code> 도 됩니다.', 'No goal: use real Vim freely. <code>:help</code> works too.'),
  start: tr('// 자유 연습장', '// free practice') + '\nfunction greet(name) {\n  const msg = "Hello, " + name;\n  console.log(msg);\n  return msg;\n}\n\ngreet("vim");',
}
const level = vimLevels.find((l) => l.id === location.hash.slice(1)) ?? (location.hash === '#sandbox' ? SANDBOX : vimLevels[0])
window.addEventListener('hashchange', () => location.reload()) // Vim 을 새 파일로 다시 띄움

// ── 화면 ──
$('#level').innerHTML = chapters.filter((c) => vimLevels.some((l) => l.chapter === c.id)).map((c) =>
  `<optgroup label="${c.title}">${vimLevels.filter((l) => l.chapter === c.id).map((l) => `<option value="${l.id}">${escapeHtml(l.title)}</option>`).join('')}</optgroup>`).join('') +
  `<option value="sandbox">${tr('자유 연습장', 'Free practice')}</option>`
$('#level').value = level.id
$('#level').onchange = (e) => { location.hash = e.target.value }
$('#back').href = `../#${level.id}`
$('#chapter').textContent = chapters.find((c) => c.id === level.chapter)?.title ?? 'playground'
$('#title').textContent = level.title
$('#desc').innerHTML = level.desc
$('#keychips').innerHTML = level.keys.map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join('')
$('#hint').hidden = !level.solution
$('#hint-text').innerHTML = level.solution ? `<code>${escapeHtml(level.solution)}</code>` : ''
$('#hint').onclick = () => { $('#hint-text').hidden = false; vim?.focus() }
$('#reset').onclick = () => location.reload()
const ext = { js: 'js', py: 'py', yaml: 'yaml' }[level.lang] ?? 'txt'
const file = `/work/${level.id}.${ext}`
$('#winbar').innerHTML = `<span class="crumb">real vim › </span>${level.id}.${ext}`
const par = level.solution ? tokenize(level.solution).length : null
const goalTexts = level.goal?.text != null ? [level.goal.text].flat() : null

let count = 0
let done = false
let state = null
const keyLog = []

function renderGoal(lines) {
  const g = level.goal
  if (!g) return ($('#goal').innerHTML = `<p class="dim">${tr('목표 없음. 자유롭게 연습하세요', 'No goal. Practice freely')}</p>`)
  if (g.cursor) {
    return ($('#goal').innerHTML = tr(`<p>커서를 <span class="target-sample">초록 칸</span>(${g.cursor[0] + 1}행 ${g.cursor[1] + 1}열)으로 옮기세요.</p><p class="dim">이동 과제라 텍스트는 바뀌지 않습니다 (nomodifiable).</p>`, `<p>Move the cursor to the <span class="target-sample">green cell</span> (line ${g.cursor[0] + 1}, column ${g.cursor[1] + 1}).</p><p class="dim">Text cannot change in motion tasks (nomodifiable).</p>`))
  }
  $('#goal').innerHTML = '<pre>' + goalTexts[0].split('\n').map((line, i) =>
    `<div class="${lines?.[i] === line ? 'ok' : 'diff'}">${escapeHtml(line) || ' '}</div>`).join('') + '</pre>'
}

const MODE = { n: 'normal', no: 'operator', i: 'insert', v: 'visual', V: 'visual line', '\x16': 'visual block', R: 'replace', c: 'command' }
function renderStatus() {
  const mode = MODE[state?.mode] ?? MODE[state?.mode?.[0]] ?? 'normal'
  $('#mode').textContent = mode.toUpperCase()
  $('#mode').dataset.mode = mode
  $('#keys').innerHTML = keyLog.slice(-40).map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join('')
  $('#count').textContent = par ? `${count}/${par}${tr('타', ' keys')}` : `${count}${tr('타', ' keys')}`
  if (state) $('#pos').textContent = `${state.line + 1}:${state.col + 1}`
}

function onState(st) {
  state = st
  renderStatus()
  renderGoal(st.lines)
  if (done || !level.goal || st.mode !== 'n') return
  const ok = goalTexts ? goalTexts.includes(st.lines.join('\n')) : st.line === level.goal.cursor[0] && st.col === level.goal.cursor[1]
  if (!ok) return
  done = true
  trackEvent(`level-cleared/${level.id}`)
  const s = stars(count, par)
  const progress = store.get('progress', {})
  progress[level.id] = Math.max(progress[level.id] ?? 0, s)
  store.set('progress', progress)
  const next = vimLevels[vimLevels.indexOf(level) + 1]
  msg(tr(`"${level.id}" 클리어 — 진짜 Vim 에서 ${count}타 (기준 ${par}타)`, `"${level.id}" cleared in real Vim — ${count} keys (par ${par})`), 'ok')
  $('#banner').innerHTML = `<span class="float-title">${tr('✔ 클리어 (진짜 Vim)', '✔ Cleared (real Vim)')}</span>
    <div class="stars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</div>
    <div>${tr(`<b>${count}</b>타 · 기준 ${par}타`, `<b>${count}</b> keys · par ${par}`)}${s < 3 ? `<br><span class="dim">${tr('모범 답안', 'Solution')}</span> <code>${escapeHtml(level.solution)}</code>` : ''}</div>
    <button id="next">${next ? `${tr('다음', 'Next')}: ${escapeHtml(next.title)} ⏎` : tr('자유 연습장 ⏎', 'Free practice ⏎')}</button>`
  $('#banner').hidden = false
  $('#next').onclick = () => { location.hash = next ? next.id : 'sandbox' }
  $('#next').focus()
}

// ── Vim 시작 ──
// 위치 → Vim 바이트 열 (한글 등 멀티바이트 대응)
const byteCol = (line, ch) => new TextEncoder().encode([...line].slice(0, ch).join('')).length + 1
const lines = level.start.split('\n')
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

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])
const LABEL = { Escape: 'Esc', Enter: '⏎', ' ': '␣', Backspace: '⌫' }
$('#vim-input').addEventListener('keydown', (e) => {
  if (MODIFIERS.has(e.key) || done) return
  if (e.isComposing || e.keyCode === 229 || /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(e.key)) return msg(tr('한/영 키로 영문 전환! Vim 명령은 영문으로만 동작해요', 'Switch your input method to English: Vim commands only work with Latin letters'), 'error')
  count++
  keyLog.push(e.ctrlKey ? `C-${e.key}` : LABEL[e.key] ?? e.key)
  renderStatus()
}, true)

function start() {
  const why = window.crossOriginIsolated ? checkBrowserCompatibility() : tr('SharedArrayBuffer 를 쓸 수 없음 (교차 출처 격리 실패)', 'SharedArrayBuffer unavailable (cross-origin isolation failed)')
  if (why) {
    // shortcut: GitHub Pages 는 헤더를 못 붙여 서비스 워커로 우회 중. Safari 는 이 우회가 첫 방문에만 먹힘(실측) → 헤더를 붙일 수 있는 호스팅으로 옮기면 해결
    const safari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent)
    $('#vim-loading').innerHTML = `<div class="fallback">${safari ? tr('Safari 에서는 아직 진짜 Vim 모드를 쓸 수 없어요.', 'Real Vim mode does not work in Safari yet.') : tr('이 브라우저에서는 진짜 Vim 을 실행할 수 없어요.', 'Real Vim cannot run in this browser.')}<br>
      <span class="dim">${escapeHtml(why)}</span><br>${tr('크롬 · 파이어폭스 · 엣지에서 열거나', 'Open it in Chrome, Firefox or Edge, or')} <a href="../#${level.id}">${tr('에뮬레이터로 연습하기 →', 'practice with the emulator →')}</a></div>`
    return
  }
  vim = new VimWasm({ canvas: $('#vim-canvas'), input: $('#vim-input'), workerScriptPath: workerUrl })
  vim.onVimInit = () => { $('#vim-loading').hidden = true; vim.focus(); msg(`${tr('진짜 Vim 시작', 'Real Vim started')} — ${file}`) }
  vim.onError = (e) => msg(`${tr('Vim 오류', 'Vim error')}: ${e.message}`, 'error')
  vim.onTitleUpdate = (t) => { try { onState(JSON.parse(t)) } catch { /* 시작 직후 기본 제목 */ } }
  vim.start({ dirs: ['/work'], files: { [file]: level.start + '\n', '/work/edu.vim': vimrc.join('\n') }, cmdArgs: ['-S', '/work/edu.vim', file] })
}
renderGoal(lines)
renderStatus()
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
window.__real = { level, get done() { return done }, get count() { return count }, get state() { return state }, get ready() { return $('#vim-loading').hidden } }
