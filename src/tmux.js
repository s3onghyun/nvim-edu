// tmux 시뮬레이터 (DOM 없는 순수 상태 머신). 기본 키 바인딩(prefix C-b, vi copy-mode)을 따른다.
// 키 표기: 'C-b', 'Enter', 'Escape', 'Backspace', 'Left'/'Right'/'Up'/'Down', 그 외는 글자 그대로.

import { t as tr } from './i18n.js'

// AI 에이전트 출력 예시 (특정 제품을 흉내 내지 않는 일반적인 형태)
export const AGENT_LOG = [
  '✻ AI agent (simulated) — /help for commands',
  '',
  tr('> 테스트가 깨졌어. 원인 찾아서 고쳐줘', '> The tests are broken. Find the cause and fix it'),
  '',
  tr('● Plan: 1) 테스트 실행 2) 원인 분석 3) 수정 4) 재실행', '● Plan: 1) run tests 2) find the cause 3) fix 4) re-run'),
  '',
  '● Bash(npm test)',
  '  ⎿  > app@1.0.0 test',
  '  ⎿  > vitest run',
  '  ⎿  ',
  '  ⎿  FAIL  src/config.test.ts',
  "  ⎿  Error: Cannot find module 'zod'",
  '  ⎿    at src/config.ts:1:1',
  '  ⎿  Tests  1 failed | 4 passed (5)',
  '',
  tr('● 의존성이 빠져 있습니다. package.json 에 zod 가 없어요.', '● A dependency is missing: zod is not in package.json.'),
  '',
  tr('● 다음 명령을 실행해도 될까요?', '● May I run the following command?'),
  '  npm install zod',
  '',
  '  1. Yes',
  '  2. No, tell the agent what to do differently',
  '',
  tr('● 사용자 확인을 기다리는 중…', '● Waiting for your confirmation…'),
]

const SHELL_OUT = {
  ls: ['README.md  package.json  src  tests'],
  pwd: ['/home/dev/app'],
  'git status': ['On branch main', 'Changes not staged for commit:', '        modified:   src/config.ts'],
  'npm test': ['FAIL  src/config.test.ts', "Error: Cannot find module 'zod'", 'Tests  1 failed | 4 passed (5)'],
  'npm install zod': ['added 1 package in 812ms'],
}

let seq = 0
const newPane = (program = 'zsh', lines = []) => ({ id: ++seq, program, lines: [...lines], input: '', copy: null })
const newWindow = (pane, name) => ({ name, renamed: !!name, layout: { pane: pane.id }, active: pane.id, last: null, zoomed: false })

// init: { attached?: name, sessions?: [{ name, windows: [{ name?, panes: [{ program, lines }], split?: 'h'|'v'|'hv', active? }] }], outer?: [lines] }
export function createTmux(init = {}) {
  const s = {
    sessions: [], attached: null, panes: {}, buffer: '',
    outer: { lines: [...(init.outer ?? [])], input: '', program: 'zsh' },
    prefix: false, prompt: null, confirm: null, chooser: null, showNumbers: false, message: '',
    flags: { detachedOnce: false }, lastAction: null, lastSession: null,
  }
  for (const def of init.sessions ?? []) {
    const sess = { name: def.name, windows: [], active: 0 }
    for (const w of def.windows) {
      const panes = w.panes.map((p) => newPane(p.program, p.lines))
      panes.forEach((p) => (s.panes[p.id] = p))
      const win = newWindow(panes[0], w.name)
      if (w.split === 'h') win.layout = { dir: 'h', children: [{ pane: panes[0].id }, { pane: panes[1].id }] }
      if (w.split === 'hv') win.layout = { dir: 'h', children: [{ pane: panes[0].id }, { dir: 'v', children: [{ pane: panes[1].id }, { pane: panes[2].id }] }] }
      win.active = panes[w.active ?? panes.length - 1].id
      sess.windows.push(win)
    }
    sess.active = def.activeWindow ?? 0
    s.sessions.push(sess)
  }
  s.attached = init.attached ?? null
  return s
}

// ── 조회 ──
export const session = (s) => s.sessions.find((x) => x.name === s.attached)
export const win = (s) => { const x = session(s); return x?.windows[x.active] }
export const pane = (s) => (s.attached ? s.panes[win(s).active] : s.outer)
export function paneIds(node) { return node.pane ? [node.pane] : node.children.flatMap(paneIds) }
export function shape(node) { return node.pane ? 'p' : `${node.dir}(${node.children.map(shape).join(',')})` }
export const windowName = (s, w) => (w.renamed ? w.name : s.panes[w.active].program)

// 각 pane 의 정규화된 사각형 (0~1). 분할은 활성 pane 을 반으로 나누는 tmux 방식이라 이진 트리로 충분
export function rects(node, x = 0, y = 0, w = 1, h = 1, out = []) {
  if (node.pane) { out.push({ id: node.pane, x, y, w, h }); return out }
  const [a, b] = node.children
  if (node.dir === 'h') { rects(a, x, y, w / 2, h, out); rects(b, x + w / 2, y, w / 2, h, out) }
  else { rects(a, x, y, w, h / 2, out); rects(b, x, y + h / 2, w, h / 2, out) }
  return out
}

// ── 레이아웃 조작 ──
function replaceNode(node, id, fn) {
  if (node.pane === id) return fn(node)
  if (node.pane) return node
  return { ...node, children: node.children.map((c) => replaceNode(c, id, fn)) }
}
function removeNode(node, id) {
  if (node.pane) return node.pane === id ? null : node
  const kids = node.children.map((c) => removeNode(c, id)).filter(Boolean)
  return kids.length === 1 ? kids[0] : { ...node, children: kids }
}

function selectPane(s, id) {
  const w = win(s)
  if (id === w.active) return
  w.last = w.active
  w.active = id
  w.zoomed = false // tmux: 다른 pane 을 고르면 zoom 해제
  s.lastAction = 'select-pane'
}

function split(s, dir) {
  const w = win(s)
  const p = newPane()
  s.panes[p.id] = p
  w.layout = replaceNode(w.layout, w.active, (n) => ({ dir, children: [n, { pane: p.id }] }))
  w.zoomed = false
  w.last = w.active
  w.active = p.id
  s.lastAction = `split-${dir}`
}

function killPane(s, id) {
  const sess = session(s)
  const w = win(s)
  delete s.panes[id]
  w.layout = removeNode(w.layout, id)
  s.lastAction = 'kill-pane'
  if (w.layout) {
    w.active = w.last && s.panes[w.last] && paneIds(w.layout).includes(w.last) ? w.last : paneIds(w.layout)[0]
    w.last = null
    w.zoomed = false
    return
  }
  sess.windows.splice(sess.active, 1)
  if (sess.windows.length) { sess.active = Math.min(sess.active, sess.windows.length - 1); return }
  s.sessions = s.sessions.filter((x) => x !== sess)
  s.attached = null
  s.outer.lines.push('[exited]')
}

function killWindow(s) {
  const w = win(s)
  for (const id of paneIds(w.layout)) delete s.panes[id]
  const sess = session(s)
  sess.windows.splice(sess.active, 1)
  s.lastAction = 'kill-window'
  if (sess.windows.length) { sess.active = Math.min(sess.active, sess.windows.length - 1); return }
  s.sessions = s.sessions.filter((x) => x !== sess)
  s.attached = null
  s.outer.lines.push('[exited]')
}

function neighbor(s, dir) {
  const w = win(s)
  const all = rects(w.layout)
  const cur = all.find((r) => r.id === w.active)
  const eq = (a, b) => Math.abs(a - b) < 1e-9
  const overlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0)
  const cand = all.filter((r) => {
    if (dir === 'Left') return eq(r.x + r.w, cur.x) && overlap(r.y, r.y + r.h, cur.y, cur.y + cur.h) > 0
    if (dir === 'Right') return eq(cur.x + cur.w, r.x) && overlap(r.y, r.y + r.h, cur.y, cur.y + cur.h) > 0
    if (dir === 'Up') return eq(r.y + r.h, cur.y) && overlap(r.x, r.x + r.w, cur.x, cur.x + cur.w) > 0
    return eq(cur.y + cur.h, r.y) && overlap(r.x, r.x + r.w, cur.x, cur.x + cur.w) > 0
  })
  return cand[0]?.id
}

function attach(s, name) {
  if (s.attached) s.lastSession = s.attached
  s.attached = name
  s.lastAction = 'attach'
}

function newWindowCmd(s) {
  const sess = session(s)
  const p = newPane()
  s.panes[p.id] = p
  sess.windows.push(newWindow(p))
  sess.active = sess.windows.length - 1
  s.lastAction = 'new-window'
}

// ── 쉘 ──
function run(s, term, cmd) {
  const inside = term !== s.outer
  term.lines.push(`$ ${cmd}`)
  const [c0, ...args] = cmd.trim().split(/\s+/)
  if (!c0) return
  if (cmd.trim() === 'clear') { term.lines = []; return }
  if (SHELL_OUT[cmd.trim()]) { term.lines.push(...SHELL_OUT[cmd.trim()]); return }
  if (c0 === 'claude' || c0 === 'agent') { term.program = 'claude'; term.lines.push(...AGENT_LOG); return }
  if (c0 === 'exit') {
    if (inside) return killPane(s, term.id)
    term.lines.push(tr('이 연습용 터미널은 닫을 수 없어요 :)', 'This practice terminal cannot be closed :)'))
    return
  }
  if (c0 === 'tmux') return tmuxCli(s, term, args, inside)
  term.lines.push(`zsh: command not found: ${c0}`)
}

function tmuxCli(s, term, args, inside) {
  const [sub = 'new', ...rest] = args
  const flag = (f) => { const i = rest.indexOf(f); return i >= 0 ? rest[i + 1] : undefined }
  const nested = () => term.lines.push('sessions should be nested with care, unset $TMUX to force')
  const has = (name) => s.sessions.some((x) => x.name === name)
  // tmux 는 세션 대상을 생략하면 "가장 최근 세션"을 고른다. 시뮬레이터에서는 붙어 있는 세션 →
  // detach 하기 전 세션 → 마지막으로 만든 세션 순으로, 그중 실제로 남아 있는 첫 것.
  // 목록에 없는 이름을 그대로 넘기면 안내 문구에 undefined 가 새어 나온다.
  const defaultSession = () => [s.attached, s.lastSession, s.sessions.at(-1)?.name].find(has)
  const NO_SERVER = 'no server running on /tmp/tmux-1000/default'
  if (['new', 'new-session'].includes(sub)) {
    if (inside) return nested()
    let name = flag('-s')
    if (!name) { let i = 0; while (s.sessions.some((x) => x.name === String(i))) i++; name = String(i) }
    if (s.sessions.some((x) => x.name === name)) return term.lines.push(`duplicate session: ${name}`)
    const p = newPane()
    s.panes[p.id] = p
    s.sessions.push({ name, windows: [newWindow(p)], active: 0 })
    return attach(s, name)
  }
  if (['ls', 'list-sessions'].includes(sub)) {
    if (!s.sessions.length) return term.lines.push(NO_SERVER)
    return term.lines.push(...s.sessions.map((x) => `${x.name}: ${x.windows.length} windows${x.name === s.attached ? ' (attached)' : ''}`))
  }
  if (['a', 'at', 'attach', 'attach-session'].includes(sub)) {
    if (inside) return nested()
    if (!s.sessions.length) return term.lines.push('no sessions')
    const name = flag('-t') ?? defaultSession()
    if (!has(name)) return term.lines.push(`can't find session: ${name}`)
    return attach(s, name)
  }
  if (sub === 'kill-session') {
    if (!s.sessions.length) return term.lines.push(NO_SERVER)
    const name = flag('-t') ?? defaultSession()
    if (!has(name)) return term.lines.push(`can't find session: ${name}`)
    for (const w of s.sessions.find((x) => x.name === name).windows) paneIds(w.layout).forEach((id) => delete s.panes[id])
    s.sessions = s.sessions.filter((x) => x.name !== name)
    if (s.attached === name) {
      s.attached = null
      s.outer.lines.push('[exited]')
    }
    return
  }
  term.lines.push(`unknown command: ${sub}`)
}

// ── copy mode ──
export const promptOf = (term) => (term.program === 'claude' ? '> ' : '$ ')
export const copyLines = (term) => [...term.lines, promptOf(term) + term.input]

function search(term, needle, dir) {
  const lines = copyLines(term)
  const c = term.copy
  const n = lines.length
  for (let i = 0; i <= n; i++) {
    const li = (c.line + (dir > 0 ? i : -i) + n * 2) % n
    const text = lines[li]
    let col
    if (dir > 0) col = text.indexOf(needle, i === 0 ? c.col + 1 : 0)
    else col = i === 0 ? text.lastIndexOf(needle, c.col - 1) : text.lastIndexOf(needle)
    if (i === 0 && dir < 0 && c.col === 0) col = -1
    if (col >= 0) { c.line = li; c.col = col; return true }
  }
  return false
}

export function selection(term) {
  const c = term.copy
  if (!c?.sel) return null
  const a = c.sel, b = { line: c.line, col: c.col }
  const [start, end] = a.line < b.line || (a.line === b.line && a.col <= b.col) ? [a, b] : [b, a]
  return c.lineSel ? { start: { line: start.line, col: 0 }, end: { line: end.line, col: Infinity }, lineSel: true } : { start, end }
}

function selectedText(term) {
  const sel = selection(term)
  const lines = copyLines(term)
  const out = []
  for (let i = sel.start.line; i <= sel.end.line; i++) {
    const from = i === sel.start.line ? sel.start.col : 0
    const to = i === sel.end.line ? sel.end.col + 1 : Infinity
    out.push(lines[i].slice(from, to))
  }
  return out.join('\n')
}

function copyKey(s, term, k) {
  const c = term.copy
  const lines = copyLines(term)
  const len = () => lines[c.line].length
  const clampCol = () => { c.col = Math.max(0, Math.min(c.col, len() - 1)) }
  const moveLine = (d) => { c.line = Math.max(0, Math.min(lines.length - 1, c.line + d)); clampCol() }
  const word = (dir) => {
    const flat = lines.map((l) => l + ' ')
    let L = c.line, C = c.col
    const at = () => flat[L][C] ?? ' '
    const step = () => {
      C += dir
      if (C >= flat[L].length) { if (L < flat.length - 1) { L++; C = 0 } else C = flat[L].length - 1 }
      if (C < 0) { if (L > 0) { L--; C = flat[L].length - 1 } else C = 0 }
    }
    if (dir > 0) { while (/\S/.test(at()) && !(L === flat.length - 1 && C === flat[L].length - 1)) step(); while (/\s/.test(at()) && !(L === flat.length - 1 && C === flat[L].length - 1)) step() }
    else { step(); while (/\s/.test(at()) && (L || C)) step(); while (L + C > 0 && /\S/.test(flat[L][C - 1] ?? ' ')) step() }
    c.line = L; c.col = C
  }
  switch (k) {
    case 'h': case 'Left': c.col = Math.max(0, c.col - 1); break
    case 'l': case 'Right': c.col = Math.min(Math.max(0, len() - 1), c.col + 1); break
    case 'j': case 'Down': moveLine(1); break
    case 'k': case 'Up': moveLine(-1); break
    case 'C-d': moveLine(8); break
    case 'C-u': moveLine(-8); break
    case '0': c.col = 0; break
    case '^': c.col = Math.max(0, lines[c.line].search(/\S/)); break
    case '$': c.col = Math.max(0, len() - 1); break
    case 'g': c.line = 0; clampCol(); break
    case 'G': c.line = lines.length - 1; clampCol(); break
    case 'w': word(1); break
    case 'b': word(-1); break
    case '/': case '?': {
      const dir = k === '/' ? 1 : -1
      s.prompt = { label: k === '/' ? '(search down)' : '(search up)', value: '', submit: (v) => { c.search = { needle: v, dir }; if (!search(term, v, dir)) s.message = tr(`"${v}" 을(를) 찾지 못했습니다`, `Pattern not found: ${v}`) } }
      break
    }
    case 'n': case 'N': if (c.search) search(term, c.search.needle, k === 'n' ? c.search.dir : -c.search.dir); break
    case ' ': case 'v': c.sel = { line: c.line, col: c.col }; c.lineSel = false; break
    case 'V': c.sel = { line: c.line, col: 0 }; c.lineSel = true; break
    case 'Escape': c.sel = null; break
    case 'Enter': case 'y':
      if (c.sel) { s.buffer = selectedText(term); s.lastAction = 'copy'; term.copy = null }
      break
    case 'q': term.copy = null; break
  }
}

// ── 키 입력 ──
export function press(s, k) {
  s.message = ''
  if (s.prompt) return promptKey(s, k)
  if (s.confirm) {
    const { action } = s.confirm
    s.confirm = null
    if (k === 'y') action()
    return
  }
  if (s.chooser) return chooserKey(s, k)
  if (s.showNumbers) {
    s.showNumbers = false
    const ids = paneIds(win(s).layout)
    if (/^\d$/.test(k) && ids[+k]) return selectPane(s, ids[+k])
  }
  if (s.attached && k === 'C-b' && !s.prefix) { s.prefix = true; return }
  if (s.prefix) { s.prefix = false; return prefixKey(s, k) }

  const term = pane(s)
  if (term.copy) return copyKey(s, term, k)
  if (k === 'C-c') {
    term.lines.push(`$ ${term.input}^C`)
    term.input = ''
    if (term.program === 'claude') term.program = 'zsh'
    return
  }
  if (k === 'Enter') {
    const cmd = term.input
    term.input = ''
    if (term.program === 'claude') { term.lines.push(`> ${cmd}`, tr('● 알겠습니다. 작업을 이어갈게요…', '● Got it. Continuing…')); return }
    return run(s, term, cmd)
  }
  if (k === 'Backspace') { term.input = term.input.slice(0, -1); return }
  if (k === 'C-u') { term.input = ''; return }
  if (k.length === 1) term.input += k
}

function promptKey(s, k) {
  const p = s.prompt
  if (k === 'Enter') { s.prompt = null; p.submit(p.value); return }
  if (k === 'Escape' || k === 'C-c') { s.prompt = null; return }
  if (k === 'Backspace') p.value = p.value.slice(0, -1)
  else if (k === 'C-u') p.value = ''
  else if (k.length === 1) p.value += k
}

function chooserKey(s, k) {
  const c = s.chooser
  if (k === 'j' || k === 'Down') c.index = Math.min(c.items.length - 1, c.index + 1)
  else if (k === 'k' || k === 'Up') c.index = Math.max(0, c.index - 1)
  else if (k === 'Enter') { s.chooser = null; if (c.items[c.index] !== s.attached) attach(s, c.items[c.index]) }
  else if (k === 'q' || k === 'Escape') s.chooser = null
}

function prefixKey(s, k) {
  const sess = session(s)
  const w = win(s)
  const ids = paneIds(w.layout)
  switch (k) {
    case '%': return split(s, 'h')
    case '"': return split(s, 'v')
    case 'o': return selectPane(s, ids[(ids.indexOf(w.active) + 1) % ids.length])
    case ';': return w.last && ids.includes(w.last) && selectPane(s, w.last)
    case 'Left': case 'Right': case 'Up': case 'Down': { const id = neighbor(s, k); if (id) selectPane(s, id); return }
    case 'q': s.showNumbers = true; return
    case 'z': if (ids.length > 1) { w.zoomed = !w.zoomed; s.lastAction = w.zoomed ? 'zoom' : 'unzoom' } return
    case 'x': s.confirm = { label: `kill-pane ${ids.indexOf(w.active)}? (y/n)`, action: () => killPane(s, w.active) }; return
    case '&': s.confirm = { label: `kill-window ${windowName(s, w)}? (y/n)`, action: () => killWindow(s) }; return
    case 'c': return newWindowCmd(s)
    case 'n': sess.active = (sess.active + 1) % sess.windows.length; s.lastAction = 'select-window'; return
    case 'p': sess.active = (sess.active - 1 + sess.windows.length) % sess.windows.length; s.lastAction = 'select-window'; return
    case ',': s.prompt = { label: '(rename-window)', value: windowName(s, w), submit: (v) => { if (v) { w.name = v; w.renamed = true; s.lastAction = 'rename-window' } } }; return
    case '$': s.prompt = { label: '(rename-session)', value: sess.name, submit: (v) => { if (v && !s.sessions.some((x) => x.name === v)) { sess.name = v; s.attached = v } } }; return
    case 'd':
      s.outer.lines.push(`[detached (from session ${s.attached})]`)
      s.lastSession = s.attached
      s.attached = null
      s.flags.detachedOnce = true
      s.lastAction = 'detach'
      return
    case 's': {
      const items = s.sessions.map((x) => x.name).sort()
      s.chooser = { items, index: items.indexOf(s.attached) }
      return
    }
    case '(': case ')': {
      const names = s.sessions.map((x) => x.name).sort()
      const i = names.indexOf(s.attached)
      const next = names[(i + (k === ')' ? 1 : -1) + names.length) % names.length]
      if (next !== s.attached) attach(s, next)
      return
    }
    case '[': { const t = pane(s); const n = copyLines(t).length; t.copy = { line: n - 1, col: 0, sel: null }; s.lastAction = 'copy-mode'; return }
    case ']': { const t = pane(s); t.input += s.buffer.replace(/\n/g, ' '); s.lastAction = 'paste'; return }
    case '?': s.message = tr('키 목록은 위 도움말을 보세요 (C-b 를 누른 뒤 다음 키)', 'See the help above for keys (press C-b, then the key)'); return
    default:
      if (/^\d$/.test(k) && sess.windows[+k]) { sess.active = +k; s.lastAction = 'select-window' }
  }
}

// ── 미션: 현재 상태에서 할 수 있는 과제를 랜덤 생성 (상태는 라운드 사이에 이어짐) ──
export function tmuxTask(rng, s) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)]
  const w = win(s)
  const sess = session(s)
  const ids = paneIds(w.layout)
  const tasks = []
  if (w.zoomed) tasks.push({ desc: tr('zoom 을 해제하세요', 'Unzoom the pane'), keys: ['C-b z'], solution: '<C-b>z', test: (t) => t.lastAction === 'unzoom' })
  else {
    if (ids.length < 4) {
      tasks.push({ desc: tr('현재 pane 을 <b>좌우</b>로 나누세요', 'Split the current pane <b>left/right</b>'), keys: ['C-b %'], solution: '<C-b>%', test: (t) => t.lastAction === 'split-h' })
      tasks.push({ desc: tr('현재 pane 을 <b>위아래</b>로 나누세요', 'Split the current pane <b>top/bottom</b>'), keys: ['C-b "'], solution: '<C-b>"', test: (t) => t.lastAction === 'split-v' })
    }
    if (ids.length > 1) {
      const target = pick(ids.filter((id) => id !== w.active))
      const idx = ids.indexOf(target)
      tasks.push({ desc: tr('<span class="target-sample">표시된 pane</span> 으로 이동하세요 (방향키 · o · q+번호)', 'Move to the <span class="target-sample">marked pane</span> (arrows · o · q + number)'), keys: ['C-b ←↑↓→', 'C-b o', 'C-b q'], solution: `<C-b>q${idx}`, target, test: (t) => win(t)?.active === target })
      tasks.push({ desc: tr('현재 pane 을 <b>zoom</b> 하세요', '<b>Zoom</b> the current pane'), keys: ['C-b z'], solution: '<C-b>z', test: (t) => t.lastAction === 'zoom' })
      if (ids.length > 2) tasks.push({ desc: tr('현재 pane 을 <b>닫으세요</b>', '<b>Close</b> the current pane'), keys: ['C-b x', 'y'], solution: '<C-b>xy', test: (t) => t.lastAction === 'kill-pane' })
    }
    if (sess.windows.length < 3) tasks.push({ desc: tr('<b>새 윈도우</b>를 만드세요', 'Create a <b>new window</b>'), keys: ['C-b c'], solution: '<C-b>c', test: (t) => t.lastAction === 'new-window' })
    if (sess.windows.length > 1) {
      const i = pick(sess.windows.map((_, j) => j).filter((j) => j !== sess.active))
      tasks.push({ desc: tr(`<b>${i}번 윈도우</b>로 가세요`, `Go to <b>window ${i}</b>`), keys: [tr('C-b 숫자', 'C-b number'), 'C-b n', 'C-b p'], solution: `<C-b>${i}`, test: (t) => session(t)?.active === i })
    }
  }
  return pick(tasks)
}
