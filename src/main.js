import { EditorView, lineNumbers, drawSelection, highlightActiveLine, highlightActiveLineGutter, Decoration } from '@codemirror/view'
import { EditorState, Compartment, Prec } from '@codemirror/state'
import { history } from '@codemirror/commands'
import { HighlightStyle, syntaxHighlighting, bracketMatching } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { vim, getCM, Vim, CodeMirror } from '@replit/codemirror-vim'
import { chapters, levels, tokenize, stars, difficultyLabel, difficultyText } from './levels.js'
import { missions, createSession, streak, ymd, rngFrom } from './drill.js'
import { createTmux, press as tmuxPress, tmuxTask, AGENT_LOG } from './tmux.js'
import { renderTmux, tmuxMode, tmuxTarget } from './tmux-view.js'
import { lang, t as tr, setLang, translateDom } from './i18n.js'
import { initializeAnalytics, trackEvent, trackPageView } from './analytics.js'
import { replay } from './explain.js'
import './style.css'

// 문법 강조는 레벨이 쓸 때만 불러옴 (첫 화면 번들에서 빼서 따로 받음)
const LANGS = {
  js: () => import('@codemirror/lang-javascript').then((m) => m.javascript()),
  py: () => import('@codemirror/lang-python').then((m) => m.python()),
  yaml: () => import('@codemirror/lang-yaml').then((m) => m.yaml()),
}
const language = new Compartment()
const SANDBOX = {
  id: 'sandbox', title: tr('자유 연습장', 'Free practice'), keys: [], file: 'scratch.js',
  desc: tr('목표 없이 마음껏 연습하세요. <code>:s</code>, 매크로, 텍스트 오브젝트 무엇이든.', 'No goal: practice anything. <code>:s</code>, macros, text objects…'), lang: 'js',
  start: tr('// 자유 연습장', '// free practice') + '\nfunction greet(name) {\n  const msg = "Hello, " + name;\n  console.log(msg);\n  return msg;\n}\n\ngreet("vim");',
  cursor: [0, 0],
}
const SCHEMES = ['tokyonight', 'catppuccin', 'gruvbox', 'tokyonight-day']
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])
const HANGUL = /[ㄱ-ㅎㅏ-ㅣ가-힣]/
const IME_MSG = tr('한/영 키로 영문 전환! NORMAL 모드 명령은 영문으로만 동작해요', 'Switch your input method to English: NORMAL-mode commands only work with Latin letters')
const KEYS_UNIT = tr('타', ' keys')
const $ = (s) => document.querySelector(s)

// 구문 색은 CSS 변수를 참조 → 컬러스킴을 바꿔도 에디터 재구성 불필요
const highlight = syntaxHighlighting(HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.definitionKeyword], color: 'var(--magenta)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--green)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--orange)' },
  { tag: t.comment, color: 'var(--fg-dim)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--blue)' },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: 'var(--cyan)' },
  { tag: [t.typeName, t.className], color: 'var(--yellow)' },
  { tag: [t.operator, t.punctuation, t.separator], color: 'var(--cyan)' },
  { tag: t.definition(t.variableName), color: 'var(--fg)' },
  { tag: t.heading, color: 'var(--blue)', fontWeight: 'bold' },
]))

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(`nvim-edu:${k}`)) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(`nvim-edu:${k}`, JSON.stringify(v)) } catch {} },
}
const progress = store.get('progress', {})
const records = store.get('records', {}) // 미션별 최고 기록 { time, keys }
const days = store.get('days', []) // 미션을 완료한 날짜들
const buffers = [] // 최근 연 화면들 (bufferline)

let view, level, count, keyLog, keyTokens, done
let session = null // 미션 진행 중일 때만
let tm = null // tmux 시뮬레이터 상태 (tmux 레벨/미션일 때만)
const relNumbers = new Compartment()

// ── 컬러스킴 ──
function setScheme(name) {
  if (!SCHEMES.includes(name)) return msg(tr(`E185: 컬러스킴 '${name}' 을(를) 찾을 수 없습니다. 사용 가능: ${SCHEMES.join(', ')}`, `E185: Cannot find color scheme '${name}'. Available: ${SCHEMES.join(', ')}`), 'error')
  document.documentElement.dataset.scheme = name
  $('#scheme').value = name
  store.set('scheme', name)
  msg(`colorscheme ${name}`, 'ok')
}
$('#scheme').innerHTML = SCHEMES.map((s) => `<option>${s}</option>`).join('')
$('#scheme').onchange = (e) => { setScheme(e.target.value); focusMain() }
setScheme(store.get('scheme', null) ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'tokyonight-day' : 'tokyonight'))
const cycleScheme = () => setScheme(SCHEMES[(SCHEMES.indexOf($('#scheme').value) + 1) % SCHEMES.length])

// f/F 가 글자를 못 찾으면 실제 Vim 처럼 아무 일도 없어야 함.
// 원본은 제자리를 반환해서 df{없는 글자} 가 커서 아래 글자를 지움 (@replit/codemirror-vim 6.4.0)
Vim.defineMotion('moveToCharacter', (cm, head, args) => {
  Object.assign(Vim.getVimGlobalState_().lastCharacterSearch, { increment: 0, forward: args.forward, selectedCharacter: args.selectedCharacter })
  const line = cm.getLine(head.line)
  let idx = head.ch
  for (let i = 0; i < args.repeat; i++) {
    if (!args.forward && idx === 0) return null
    idx = args.forward ? line.indexOf(args.selectedCharacter, idx + 1) : line.lastIndexOf(args.selectedCharacter, idx - 1)
    if (idx === -1) return null
  }
  return new CodeMirror.Pos(head.line, idx)
})

// NORMAL 모드에서 한글 IME 로 조합된 글자는 문서에 넣지 않고 조합 자체를 끝낸다.
// (트랜잭션을 거부하는 방식은 브라우저의 조합 상태와 어긋나서 커서가 튀고 다음 영문 키가 글자로 들어갔음)
const FIREFOX_LINUX = /Firefox/.test(navigator.userAgent) && /Linux/.test(navigator.platform)
function endComposition(view) {
  if (FIREFOX_LINUX) {
    view.contentDOM.textContent = '\0\0' // vim 확장이 이 값을 무시하도록 되어 있음
    view.contentDOM.dispatchEvent(new CustomEvent('compositionend'))
    return
  }
  // @replit/codemirror-vim 의 forceEndComposition 과 같은 방식: DOM 을 떼었다 붙여 조합을 강제로 끝냄
  const parent = view.scrollDOM.parentElement
  const next = view.scrollDOM.nextSibling
  view.scrollDOM.remove()
  parent.insertBefore(view.scrollDOM, next)
  view.focus()
  view.contentDOM.dispatchEvent(new CustomEvent('compositionend'))
}
const blockHangul = Prec.highest(EditorView.inputHandler.of((view, _from, _to, text) => {
  if (getCM(view)?.state.vim.insertMode || !HANGUL.test(text)) return false
  msg(IME_MSG, 'error')
  // 핸들러 안에서 DOM 을 건드리면 진행 중인 업데이트와 충돌하므로 다음 틱에
  setTimeout(() => endComposition(view))
  return true
}))

// 에뮬레이터에 없는 Ex 명령: :m(ove) · :t / :co(py) — 실제 Neovim 과 비교 테스트로 동작 확인
const firstNonBlank = (cm, line) => Math.max(0, cm.getLine(line).search(/\S|$/))
function exAddress(cm, s) {
  const m = /^(\d+|\.|\$)?([+-]\d*)?$/.exec(s.trim())
  if (!m) return null
  const cur = cm.getCursor().line
  let n = m[1] === undefined || m[1] === '.' ? cur : m[1] === '$' ? cm.lastLine() : +m[1] - 1 // 0 → -1 = 첫 줄 위
  if (m[2]) n += m[2].length === 1 ? (m[2] === '+' ? 1 : -1) : +m[2]
  return Math.max(-1, Math.min(cm.lastLine(), n))
}
function moveOrCopy(cm, p, copy) {
  const a = p.line ?? cm.getCursor().line
  const b = p.lineEnd ?? a
  let t = exAddress(cm, p.argString ?? '')
  if (t === null) return msg(tr(`E14: 잘못된 주소: ${p.argString}`, `E14: Invalid address: ${p.argString}`), 'error')
  if (!copy && t >= a && t < b) return msg(tr('E134: 범위 안으로는 옮길 수 없습니다', 'E134: Cannot move a range of lines into itself'), 'error')
  const lines = []
  for (let i = a; i <= b; i++) lines.push(cm.getLine(i))
  const len = (l) => cm.getLine(l).length
  cm.operation(() => {
    if (!copy) {
      if (b < cm.lastLine()) cm.replaceRange('', { line: a, ch: 0 }, { line: b + 1, ch: 0 })
      else if (a > 0) cm.replaceRange('', { line: a - 1, ch: len(a - 1) }, { line: b, ch: len(b) })
      else cm.replaceRange('', { line: 0, ch: 0 }, { line: b, ch: len(b) })
      if (t > b) t -= b - a + 1
    }
    if (t < 0) cm.replaceRange(lines.join('\n') + '\n', { line: 0, ch: 0 })
    else cm.replaceRange('\n' + lines.join('\n'), { line: t, ch: len(t) })
  })
  const last = t + lines.length
  cm.setCursor(last, firstNonBlank(cm, last))
}
// 라이브러리 기본은 JS 정규식(pcre). 실제 Vim 처럼 \( \) \< \> 를 쓰게 Vim 정규식으로
Vim.setOption('pcre', false)
Vim.defineEx('move', 'm', (cm, p) => moveOrCopy(cm, p, false))
Vim.defineEx('copy', 'co', (cm, p) => moveOrCopy(cm, p, true))
Vim.defineEx('t', 't', (cm, p) => moveOrCopy(cm, p, true))
// & : 마지막 :s 를 현재 줄에 다시 (Neovim 기본 매핑 & → :&&)
Vim.defineAction('repeatSubstitute', (cm) => {
  const last = Vim.getVimGlobalState_().lastSubstituteArgString
  if (last) Vim.handleEx(cm, 's' + last)
})
Vim.mapCommand('&', 'action', 'repeatSubstitute', {}, { context: 'normal' })

Vim.defineEx('colorscheme', 'colo', (_cm, p) => (p.args?.[0] ? setScheme(p.args[0]) : msg(`${$('#scheme').value} — ${tr('사용 가능', 'available')}: ${SCHEMES.join(' ')}`)))
Vim.defineEx('quit', 'q', () => msg(tr('E37: 여기선 :q 로 탈출할 수 없습니다. 계속 연습하세요 :)', 'E37: No escaping with :q here. Keep practicing :)'), 'error'))
Vim.defineEx('write', 'w', () => msg(tr(`"${fileName()}" 저장할 필요 없어요. 진행 상황은 자동 저장됩니다`, `"${fileName()}" no need to save. Progress is saved automatically`), 'ok'))

// ── cmdline 메시지 영역 (nvim 의 echo area) ──
function msg(text, kind = '') {
  $('#cmdline').textContent = text
  $('#cmdline').className = kind
}

// 해설 리플레이용 Vim 표기 (<Esc>, <CR>, <C-a>)
const NAMED = { Escape: '<Esc>', Enter: '<CR>', Backspace: '<BS>', Tab: '<Tab>', ArrowLeft: '<Left>', ArrowRight: '<Right>', ArrowUp: '<Up>', ArrowDown: '<Down>' }
function keyToken(e) {
  if (e.ctrlKey && e.key.length === 1) return `<C-${e.key.toLowerCase()}>`
  return NAMED[e.key] ?? (e.key.length === 1 ? e.key : null)
}

function keyLabel(e) {
  if (e.key === 'Escape') return 'Esc'
  if (e.key === 'Enter') return '⏎'
  if (e.key === ' ') return '␣'
  if (e.key === 'Backspace') return '⌫'
  if (e.ctrlKey) return `C-${e.key}`
  return e.key
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
// 위치는 [줄, 열] 또는 절대 오프셋
const posOf = (state, p) => (typeof p === 'number' ? p : state.doc.line(p[0] + 1).from + p[1])
const goalTexts = (g) => [g.text].flat()
const EXT = { js: 'js', py: 'py', yaml: 'yaml' }
const fileFor = (id) => {
  if (id === 'sandbox') return SANDBOX.file
  if (missions.some((m) => m.id === id)) return `${id.replace('mission-', '')}.drill`
  const l = levels.find((x) => x.id === id)
  if (l?.kind === 'tmux') return `${id}.tmux`
  return `${id}.${EXT[l?.lang] ?? 'txt'}`
}
const currentId = () => session?.mission.id ?? level?.id
const fileName = () => fileFor(currentId())
const crumb = () => session ? 'missions' : chapters.find((c) => c.id === level?.chapter)?.title ?? 'playground'

// ── neo-tree ──
function renderNav() {
  const active = currentId()
  const file = (id, title, { meta = '', cls = '', ico = '○' } = {}) =>
    `<a href="#${id}" class="${cls} ${id === active ? 'active' : ''}"><span class="ico">${ico}</span><span class="name">${title}</span><span class="meta">${meta}</span></a>`
  const cleared = levels.filter((l) => progress[l.id]).length
  const s = streak(days)
  $('#nav').innerHTML =
    `<div class="root">nvim-edu/ <span class="dim">${s ? `🔥${s} · ` : ''}${cleared}/${levels.length}</span></div>` +
    `<div class="dir">missions/</div>` +
    missions.map((m) => file(m.id, m.title, { cls: 'drill', ico: '◆', meta: records[m.id] ? `${records[m.id].time.toFixed(1)}s` : '' })).join('') +
    chapters.map((c) => `<div class="dir" data-chapter="${c.id}">${c.title}/ <span class="difficulty" aria-label="${difficultyText(c.difficulty)}">${difficultyLabel(c.difficulty)}</span></div>` +
      levels.filter((l) => l.chapter === c.id).map((l) => file(l.id, l.title, {
        cls: progress[l.id] ? 'cleared' : '', ico: progress[l.id] ? '●' : '○', meta: '★'.repeat(progress[l.id] ?? 0),
      })).join('')).join('') +
    `<div class="dir">playground/</div>` + file('sandbox', SANDBOX.title, { ico: '∞' })
  $('#dash-stats').textContent = tr(`${s ? `🔥 ${s}일 연속 · ` : ''}레벨 ${cleared} / ${levels.length} 클리어`, `${s ? `🔥 ${s}-day streak · ` : ''}${cleared} / ${levels.length} levels cleared`)
}

// ── bufferline / winbar / lualine ──
function renderBars() {
  const id = currentId()
  const modified = view && !session && level && view.state.doc.toString() !== level.start
  $('#buffers').innerHTML = buffers.map((b) =>
    `<a class="buf ${b === id ? 'active' : ''}" href="#${b}">${fileFor(b)}${b === id && modified ? ' <span class="mod">●</span>' : ''}</a>`).join('')
  $('#winbar').innerHTML = `<span class="crumb">${escapeHtml(crumb())} › </span>${fileName()}${modified ? ' <span class="mod">[+]</span>' : ''}`
  $('#ll-chapter').textContent = `⎇ ${crumb()}`
  $('#ll-file').textContent = fileName() + (modified ? ' [+]' : '')
}

function renderPos() {
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)
  $('#pos').textContent = `${line.number}:${head - line.from + 1}`
}

// 상대 줄 번호 (set relativenumber): 5j 같은 이동 연습의 핵심
const numbersFor = (cur) => lineNumbers({ formatNumber: (n) => String(n === cur ? n : Math.abs(n - cur)) })

function renderGoal() {
  const g = level.goal
  if (!g) return ($('#goal').innerHTML = `<p class="dim">${tr('목표 없음. 자유롭게 연습하세요', 'No goal. Practice freely')}</p>`)
  if (g.cursor != null) {
    return ($('#goal').innerHTML = tr(`<p>커서를 에디터의 <span class="target-sample">초록 칸</span>으로 옮기세요.</p><p class="dim">이동 과제에서는 텍스트가 바뀌지 않습니다. 왼쪽 상대 줄 번호를 보고 <b>{n}j</b> 를 써보세요.</p>`, `<p>Move the cursor to the <span class="target-sample">green cell</span> in the editor.</p><p class="dim">Text cannot change in motion tasks. Read the relative line numbers on the left and try <b>{n}j</b>.</p>`))
  }
  const cur = view.state.doc.toString().split('\n')
  $('#goal').innerHTML = '<pre>' + goalTexts(g)[0].split('\n').map((line, i) =>
    `<div class="${cur[i] === line ? 'ok' : 'diff'}">${escapeHtml(line) || ' '}</div>`).join('') + '</pre>'
}

function renderStatus(mode = $('#mode').dataset.mode) {
  $('#mode').textContent = mode.toUpperCase()
  $('#mode').dataset.mode = mode
  $('#keys').innerHTML = keyLog.slice(-40).map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join('')
  if (session) {
    const sec = session.t0 ? (performance.now() - session.t0) / 1000 : 0
    $('#count').textContent = `${session.round + 1}/${session.total} · ${sec.toFixed(1)}s · ${session.keys + count}${KEYS_UNIT}`
  } else {
    const par = level.solution ? tokenize(level.solution).length : null
    $('#count').textContent = par ? `${count}/${par}${KEYS_UNIT}` : `${count}${KEYS_UNIT}`
  }
}

function check() {
  if (done || !level.goal) return
  const v = getCM(view).state.vim
  if (v.insertMode || v.visualMode) return
  const { goal } = level
  const ok = goal.text != null
    ? goalTexts(goal).includes(view.state.doc.toString())
    : view.state.selection.main.head === posOf(view.state, goal.cursor)
  if (!ok) return
  done = true
  session ? roundCleared() : levelCleared()
}

// ── 풀이 해설: 보이지 않는 에디터로 명령마다 다시 실행해 결과를 보여 줌 ──
function replayView() {
  const parent = document.createElement('div')
  parent.className = 'offscreen'
  parent.setAttribute('aria-hidden', 'true')
  document.body.append(parent)
  const state = EditorState.create({ doc: level.start })
  const v = new EditorView({
    parent,
    state: EditorState.create({
      doc: level.start,
      selection: { anchor: Math.min(posOf(state, level.cursor), state.doc.length) },
      extensions: [vim(), EditorState.allowMultipleSelections.of(true), history()],
    }),
  })
  const destroy = v.destroy.bind(v)
  v.destroy = () => { destroy(); parent.remove() }
  return { view: v, start: level.start }
}

function resultHtml(text, [line, col], prevText) {
  const lines = text.split('\n')
  const chars = [...(lines[line] ?? '')]
  const cur = chars.map((c, i) => (i === col ? `<span class="ex-cur">${escapeHtml(c)}</span>` : escapeHtml(c))).join('') + (col >= chars.length ? '<span class="ex-cur"> </span>' : '')
  const n = prevText.split('\n').length
  const delta = lines.length !== n ? ` <span class="dim">${tr(`${n}줄 → ${lines.length}줄`, `${n} → ${lines.length} lines`)}</span>` : ''
  return `<span class="dim">${line + 1}:</span> ${cur}${delta}`
}

function explainHtml(title, tokens, open) {
  if (!tokens.length) return ''
  const { start, steps } = replay(tokens, replayView, Vim, getCM)
  let prev = start
  const rows = steps.map((st, i) => {
    const changed = st.text !== prev
    const row = `<tr class="${changed ? 'ex-changed' : ''}"><td class="dim">${i + 1}</td><td>${st.keys.map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join('')}</td><td>${st.html}</td><td class="ex-result">${resultHtml(st.text, st.cursor, prev)}</td></tr>`
    prev = st.text
    return row
  }).join('')
  return `<details class="explain"${open ? ' open' : ''}><summary>${title}</summary><div class="ex-scroll"><table>
    <thead><tr><th>#</th><th>${tr('키', 'Keys')}</th><th>${tr('뜻', 'Meaning')}</th><th>${tr('결과 (커서 줄)', 'Result (cursor line)')}</th></tr></thead><tbody>${rows}</tbody></table></div></details>`
}

function levelCleared() {
  trackEvent(`level-cleared/${level.id}`)
  const par = tokenize(level.solution).length
  const s = stars(count, par)
  progress[level.id] = Math.max(progress[level.id] ?? 0, s)
  store.set('progress', progress)
  renderNav()
  const next = levels[levels.indexOf(level) + 1]
  msg(tr(`"${fileName()}" 클리어 — ${count}타 (기준 ${par}타)`, `"${fileName()}" cleared — ${count} keys (par ${par})`), 'ok')
  // 해설은 Vim 레벨만 (tmux 는 키 의미가 달라 제외)
  const explain = !level.kind
  if (explain) $('#explain').innerHTML = explainHtml(tr(`내 풀이 (${count}타)`, `Your keys (${count})`), keyTokens, false) +
    explainHtml(tr(`모범 답안 (${par}타)`, `Solution (${par} keys)`), tokenize(level.solution), false)
  showBanner(tr('✔ 클리어', '✔ Cleared'), `
    <div class="stars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</div>
    <div>${tr(`<b>${count}</b>타 · 기준 ${par}타`, `<b>${count}</b> keys · par ${par}`)}${s < 3 ? `<br><span class="dim">${tr('모범 답안', 'Solution')}</span> <code>${escapeHtml(level.solution)}</code>` : ''}</div>
    <div class="banner-actions">${explain ? `<button id="explain-btn" class="ghost">${tr('📖 풀이 해설', '📖 Step by step')}</button>` : ''}
    <button id="next">${next ? `${tr('다음', 'Next')}: ${next.title} ⏎` : tr('미션 하러 가기 ⏎', 'Try the drills ⏎')}</button></div>`,
  () => { location.hash = next ? next.id : missions[0].id })
}

function roundCleared() {
  session.keys += count
  if (view) session.cursor = view.state.selection.main.head
  session.round++
  const box = session.tmux ? '#term' : '#editor'
  $(box).classList.add('flash')
  setTimeout(() => $(box).classList.remove('flash'), 250)
  if (session.round < session.total) return setTimeout(() => (session.tmux ? nextTmuxRound() : startRound()), 250)

  const time = (performance.now() - session.t0) / 1000
  const id = session.mission.id
  // A drill is one complete ten-round session, not each individual round.
  const best = records[id]
  const isBest = !best || time < best.time
  if (isBest) records[id] = { time, keys: session.keys }
  store.set('records', records)
  if (!days.includes(ymd(new Date()))) days.push(ymd(new Date()))
  store.set('days', days)
  clearInterval(session.timer)
  trackEvent(`drill-finished/${id}`)
  renderNav()
  msg(`${session.mission.title} ${tr('완료', 'done')} — ${time.toFixed(1)}s, ${session.keys}${KEYS_UNIT}`, 'ok')
  showBanner(isBest ? tr('🏆 최고 기록', '🏆 New best') : tr('✔ 미션 완료', '✔ Drill complete'), `
    <div><b>${session.mission.title}</b> ${time.toFixed(1)}s · ${session.keys}${KEYS_UNIT} <span class="dim">(${tr('라운드당', 'per round')} ${(session.keys / session.total).toFixed(1)}${KEYS_UNIT})</span></div>
    <div class="dim">${isBest ? tr('최고 기록 갱신!', 'New personal best!') : `${tr('최고 기록', 'Best')} ${best.time.toFixed(1)}s`} · 🔥 ${tr(`${streak(days)}일 연속`, `${streak(days)}-day streak`)}</div>
    <button id="next">${tr('한 번 더 ⏎', 'Again ⏎')}</button>`,
  () => startMission(session.mission))
}

function showBanner(title, html, onNext) {
  $('#banner').innerHTML = `<span class="float-title">${title}</span>${html}`
  $('#banner').hidden = false
  $('#next').onclick = onNext
  const ex = $('#explain-btn')
  if (ex) ex.onclick = () => { $('#banner').hidden = true; $('#explain details')?.setAttribute('open', ''); $('#explain').scrollIntoView({ block: 'nearest' }) }
  $('#next').focus()
}

function mount(lvl) {
  level = lvl
  count = 0
  keyLog = []
  keyTokens = []
  done = false
  view?.destroy()
  tm = null
  showWorkspace('vim')

  const state = EditorState.create({ doc: lvl.start })
  const marks = lvl.marks ?? (lvl.goal?.cursor ? [{ from: posOf(state, lvl.goal.cursor), cls: 'cm-target' }] : [])
  const isMove = lvl.goal?.cursor != null
  const anchor = Math.min(posOf(state, lvl.cursor), state.doc.length)
  let curLine = state.doc.lineAt(anchor).number
  view = new EditorView({
    parent: $('#editor'),
    state: EditorState.create({
      doc: lvl.start,
      selection: { anchor },
      extensions: [
        vim(), // 다른 keymap보다 먼저 와야 함
        EditorState.allowMultipleSelections.of(true), // Ctrl-v 블록 입력에 필요
        relNumbers.of(numbersFor(curLine)),
        drawSelection(), highlightActiveLine(), highlightActiveLineGutter(), bracketMatching(), highlight,
        language.of([]),
        marks.length ? EditorView.decorations.of(Decoration.set(marks.map((m) => Decoration.mark({ class: m.cls }).range(m.from, m.to ?? m.from + 1)))) : [],
        // 이동 과제는 텍스트 변경 금지: 목표 좌표가 밀리지 않게
        isMove ? EditorState.transactionFilter.of((tx) => (tx.docChanged ? [] : tx)) : [],
        history(), // u / Ctrl-r 이 동작하려면 필요
        blockHangul,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) { renderGoal(); renderBars() }
          if (u.docChanged || u.selectionSet) {
            renderPos()
            const line = u.state.doc.lineAt(u.state.selection.main.head).number
            // 업데이트 도중 dispatch 불가 → 마이크로태스크로 미룸
            if (line !== curLine) { curLine = line; queueMicrotask(() => view.dispatch({ effects: relNumbers.reconfigure(numbersFor(line)) })) }
            check()
          }
        }),
      ],
    }),
  })
  const v = view // 불러오는 사이 다른 레벨로 넘어갔으면 무시
  LANGS[lvl.lang]?.().then((ext) => { if (view === v) v.dispatch({ effects: language.reconfigure(ext) }) })

  // 키 카운트 + 방향키/마우스/한글 입력 차단 (손가락을 홈row에 두는 습관)
  // 방향키는 hjkl 을 익히는 1장(이동)과 이동 미션에서만 막음. 그 뒤로는 실제 Vim 처럼 허용
  view.dom.addEventListener('keydown', (e) => {
    if (MODIFIERS.has(e.key) || done) return
    const inEditor = e.target === view.contentDOM
    const noArrows = session ? session.mission.id === 'mission-move' : lvl.chapter === 'move'
    if (inEditor && noArrows && e.key.startsWith('Arrow')) {
      e.preventDefault(); e.stopPropagation()
      return msg(tr('방향키 대신 h j k l 을 쓰세요', 'Use h j k l instead of the arrow keys'), 'error')
    }
    if (inEditor && !getCM(view).state.vim.insertMode && (e.isComposing || e.keyCode === 229 || HANGUL.test(e.key))) {
      e.preventDefault(); e.stopPropagation()
      return msg(IME_MSG, 'error')
    }
    if (session && !session.t0) session.t0 = performance.now()
    count++
    keyLog.push(keyLabel(e))
    const tok = keyToken(e)
    if (tok) keyTokens.push(tok)
    queueMicrotask(() => renderStatus(getCM(view).state.vim.insertMode ? 'insert' : undefined))
  }, true)
  view.contentDOM.addEventListener('mousedown', (e) => { e.preventDefault(); view.focus(); msg(tr('마우스 대신 키보드로 이동하세요', 'Move with the keyboard, not the mouse'), 'error') })
  getCM(view).on('vim-mode-change', (e) => { renderStatus(e.subMode ? `${e.mode} ${e.subMode}` : e.mode); check() })

  $('#desc').innerHTML = lvl.desc
  $('#banner').hidden = true
  renderGoal(); renderStatus('normal'); renderPos(); renderBars()
  view.focus()
}

function startRound() {
  mount(session.next())
  $('#hint').hidden = true
}

function startMission(mission) {
  $('#real-link').hidden = true
  $('#difficulty').hidden = true
  if (mission.tmux) return startTmuxMission(mission)
  clearInterval(session?.timer)
  session = createSession(mission)
  session.timer = setInterval(() => session.t0 && !done && renderStatus(), 100)
  $('#chapter').textContent = tr('missions · 10라운드 연속, 빠르고 적은 타수로', 'drills · 10 rounds in a row, fast and with few keys')
  $('#title').textContent = mission.title + (mission.daily ? ` (${ymd(new Date())})` : '')
  $('#keychips').innerHTML = mission.keys.map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join('')
  startRound()
}

// ── tmux ──
const showWorkspace = (kind) => {
  $('.workspace').hidden = kind === 'tmux'
  $('#term-wrap').hidden = kind !== 'tmux'
  $('#checks').hidden = kind !== 'tmux'
}
const focusMain = () => (tm ? $('#term').focus() : view?.focus())

function renderTerm() {
  renderTmux(tm, $('#term'), { target: level.target })
  $('#pos').textContent = tmuxTarget(tm)
  $('#checks').innerHTML = level.checks.map((c) => `<li class="${c.test(tm) ? 'ok' : ''}">${c.label}</li>`).join('')
}

function mountTmux(lvl) {
  level = lvl
  count = 0
  keyLog = []
  done = false
  view?.destroy()
  view = null
  if (lvl.init) tm = createTmux(lvl.init())
  tm.lastAction = null
  showWorkspace('tmux')
  $('#desc').innerHTML = lvl.desc
  $('#banner').hidden = true
  renderTerm(); renderStatus(tmuxMode(tm)); renderBars()
  $('#term').focus()
}

function checkTmux() {
  if (done || !level.checks.every((c) => c.test(tm))) return
  done = true
  session ? roundCleared() : levelCleared()
}

function startTmuxMission(mission) {
  clearInterval(session?.timer)
  session = { mission, total: 10, round: 0, keys: 0, t0: null, tmux: true, rng: rngFrom(Date.now()) }
  session.timer = setInterval(() => session.t0 && !done && renderStatus(), 100)
  tm = createTmux({ attached: 'drill', sessions: [{ name: 'drill', windows: [{ panes: [{ program: 'claude', lines: AGENT_LOG }] }] }] })
  $('#chapter').textContent = tr('missions · 10라운드 연속, 빠르고 적은 타수로', 'drills · 10 rounds in a row, fast and with few keys')
  $('#title').textContent = mission.title
  nextTmuxRound()
}

function nextTmuxRound() {
  const task = tmuxTask(session.rng, tm)
  $('#keychips').innerHTML = task.keys.map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join('')
  $('#hint').hidden = true
  mountTmux({ kind: 'tmux', desc: task.desc, solution: task.solution, target: task.target, checks: [{ label: task.desc, test: task.test }] })
  $('#checks').hidden = true // 미션은 설명 한 줄이 곧 목표
}

const TKEYS = { Enter: 'Enter', Escape: 'Escape', Backspace: 'Backspace', ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down' }
const TLABEL = { ' ': '␣', Enter: '⏎', Escape: 'Esc', Backspace: '⌫', Left: '←', Right: '→', Up: '↑', Down: '↓' }
$('#term').addEventListener('keydown', (e) => {
  if (!tm || done || e.metaKey || e.altKey || MODIFIERS.has(e.key)) return
  if (e.isComposing || e.keyCode === 229 || HANGUL.test(e.key)) {
    e.preventDefault()
    return msg(tr('한/영 키로 영문 전환! 터미널 키는 영문으로만 동작해요', 'Switch your input method to English: terminal keys only work with Latin letters'), 'error')
  }
  const k = e.ctrlKey ? (e.key.length === 1 ? `C-${e.key.toLowerCase()}` : null) : TKEYS[e.key] ?? (e.key.length === 1 ? e.key : null)
  if (!k) return
  e.preventDefault() // C-b(굵게/북마크), 방향키 스크롤 등 브라우저 기본 동작 막기
  if (session && !session.t0) session.t0 = performance.now()
  count++
  keyLog.push(TLABEL[k] ?? k)
  tmuxPress(tm, k)
  renderTerm(); renderStatus(tmuxMode(tm)); checkTmux()
})

function showDashboard() {
  clearInterval(session?.timer)
  session = null
  level = null
  view?.destroy()
  view = null
  tm = null
  $('#dashboard').hidden = false
  $('#work').hidden = true
  $('#mode').textContent = 'NORMAL'
  $('#ll-chapter').textContent = '⎇ main'
  $('#ll-file').textContent = 'dashboard'
  $('#keys').innerHTML = ''
  $('#count').textContent = ''
  $('#pos').textContent = '1:1'
  $('#buffers').innerHTML = buffers.map((b) => `<a class="buf" href="#${b}">${fileFor(b)}</a>`).join('')
  renderNav()
}

function load(id) {
  if (!id) {
    showDashboard()
    return 'dashboard'
  }
  $('#dashboard').hidden = true
  $('#work').hidden = false
  const known = id === 'sandbox' || levels.some((l) => l.id === id) || missions.some((m) => m.id === id)
  if (!known) id = levels[0].id
  if (!buffers.includes(id)) buffers.push(id)
  if (buffers.length > 4) buffers.shift()
  msg(`"${fileFor(id)}" — ${tr(':colo <이름> 으로 테마 변경', ':colo <name> changes the theme')}`)

  const mission = missions.find((m) => m.id === id)
  if (mission) { startMission(mission); renderNav(); return id }
  clearInterval(session?.timer)
  session = null
  const lvl = levels.find((l) => l.id === id) ?? SANDBOX
  const chapter = chapters.find((c) => c.id === lvl.chapter)
  $('#chapter').textContent = chapter?.title ?? 'playground'
  $('#difficulty').hidden = !chapter
  $('#difficulty').textContent = chapter ? difficultyText(chapter.difficulty) : ''
  $('#title').textContent = lvl.title
  $('#keychips').innerHTML = lvl.keys.map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join('')
  $('#hint').hidden = !lvl.solution
  $('#hint-text').hidden = true
  $('#hint-text').innerHTML = lvl.solution ? `<code>${escapeHtml(lvl.solution)}</code>` : ''
  $('#explain').innerHTML = ''
  // 같은 레벨을 진짜 Vim(vim.wasm)으로 — tmux 레벨은 해당 없음
  $('#real-link').hidden = lvl.kind === 'tmux'
  $('#real-link').href = `real/#${lvl.id}`
  lvl.kind === 'tmux' ? mountTmux(lvl) : mount(lvl)
  renderNav()
  return id
}

// alpha-nvim 로고: 박스 문자는 웹폰트마다 폭이 달라 깨지므로 칸 단위 그리드로 그림
const LOGO = `███╗   ██╗██╗   ██╗██╗███╗   ███╗
████╗  ██║██║   ██║██║████╗ ████║
██╔██╗ ██║██║   ██║██║██╔████╔██║
██║╚██╗██║╚██╗ ██╔╝██║██║╚██╔╝██║
██║ ╚████║ ╚████╔╝ ██║██║ ╚═╝ ██║
╚═╝  ╚═══╝  ╚═══╝  ╚═╝╚═╝     ╚═╝`
$('#logo').innerHTML = LOGO.split('\n').map((row) => [...row.padEnd(33)].map((c) =>
  `<i class="${c === '█' ? 'on' : c === ' ' ? '' : 'shade'}"></i>`).join('')).join('')

// 대시보드 단축키 (alpha-nvim 처럼)
const DASH_KEYS = { n: 'hjkl', d: 'mission-daily', m: 'mission-move', s: 'sandbox' }
document.addEventListener('keydown', (e) => {
  if ($('#dashboard').hidden || e.ctrlKey || e.metaKey || e.altKey) return
  if (DASH_KEYS[e.key]) location.hash = DASH_KEYS[e.key]
  if (e.key === 'c') cycleScheme()
  if (e.key === 'r') location.href = 'real/'
})
$('#dash-scheme').onclick = (e) => { e.preventDefault(); cycleScheme() }

$('#reset').onclick = () => (session ? startMission(session.mission) : load(level.id))
$('#hint').onclick = () => {
  $('#hint-text').hidden = false
  if (!level.kind && level.solution) $('#explain').innerHTML = explainHtml(tr('모범 답안 단계별', 'Solution, step by step'), tokenize(level.solution), true)
  focusMain()
}
$('#menu').onclick = () => document.body.classList.toggle('nav-open')
$('#nav').onclick = (e) => { if (e.target.closest('a')) document.body.classList.remove('nav-open') }
translateDom()
const langText = lang === 'en' ? '한국어' : 'EN'
$('#lang').append(langText)
$('#lang').setAttribute('aria-label', `${langText} ${$('#lang').getAttribute('aria-label')}`)
$('#lang').onclick = () => setLang(lang === 'en' ? 'ko' : 'en')
const route = () => trackPageView(`/main/${load(location.hash.slice(1))}`)
window.addEventListener('hashchange', route)
initializeAnalytics()
route()

// e2e 테스트용 훅
window.__edu = {
  levels, missions,
  get done() { return done }, get count() { return count },
  get level() { return level }, get session() { return session && { round: session.round, total: session.total } },
  // 실제 Neovim 과 비교 테스트용: 임의 텍스트로 에디터를 띄우고 결과를 읽음
  mountText(text, cursor) { mount({ id: 'diff', keys: [], desc: '', start: text, cursor }) },
  // 해설 리플레이 검증용: 내 키·모범 답안을 다시 실행한 마지막 상태가 실제 에디터와 같은지
  explainCheck() {
    const last = (tokens) => { const st = replay(tokens, replayView, Vim, getCM).steps.at(-1); return st && { text: st.text, cursor: st.cursor } }
    return { mine: last(keyTokens), solution: last(tokenize(level.solution)), rows: document.querySelectorAll('#explain tbody tr').length }
  },
  get editor() {
    const head = view.state.selection.main.head
    const line = view.state.doc.lineAt(head)
    const v = getCM(view).state.vim
    return { text: view.state.doc.toString(), cursor: [line.number - 1, head - line.from], mode: v.insertMode ? 'i' : v.visualMode ? 'v' : 'n' }
  },
}
