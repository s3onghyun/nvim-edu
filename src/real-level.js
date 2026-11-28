// 진짜 Vim(real/) · 진짜 Neovim(nvim/) 페이지가 같이 쓰는 레벨 화면: 레벨 선택, 목표 표시, 타수, 클리어 판정.
// 엔진(vim.wasm · nvim-wasm)은 각 페이지가 띄우고, 상태 { lines, line, col, mode } 를 onState 로 넘겨 줌
import { chapters, levels, tokenize, stars } from './levels.js'
import { t as tr, translateDom, mountLangMenu } from './i18n.js'
import { trackEvent } from './analytics.js'
import { store, loadProgress } from './storage.js'
import './style.css'

export const $ = (s) => document.querySelector(s)
export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export const vimLevels = levels.filter((l) => !l.kind)

const MODE = { n: 'normal', no: 'operator', i: 'insert', v: 'visual', V: 'visual line', '\x16': 'visual block', R: 'replace', c: 'command' }
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])
const LABEL = { Escape: 'Esc', Enter: '⏎', ' ': '␣', Backspace: '⌫' }

// engine: { name: 문장 속 이름(진짜 Vim), short: 배너 제목용(중국어는 더 짧게), crumb: winbar 앞머리 }, sandboxDesc: 자유 연습장 설명
export function setupLevelPage({ engine, sandboxDesc }) {
  document.documentElement.dataset.scheme = store.get('scheme', 'tokyonight')
  // 고정 문구 번역은 #chapter 등을 채우기 전에 (data-en 이 안쪽 span 을 새로 만듦)
  translateDom()
  mountLangMenu($('#lang'))
  const msg = (text, kind = '') => { $('#cmdline').textContent = text; $('#cmdline').className = kind }

  const SANDBOX = {
    id: 'sandbox', title: tr('자유 연습장', 'Free practice', '自由练习'), keys: [], lang: 'js', cursor: [0, 0], desc: sandboxDesc,
    start: tr('// 자유 연습장', '// free practice', '// 自由练习') + '\nfunction greet(name) {\n  const msg = "Hello, " + name;\n  console.log(msg);\n  return msg;\n}\n\ngreet("vim");',
  }
  const level = vimLevels.find((l) => l.id === location.hash.slice(1)) ?? (location.hash === '#sandbox' ? SANDBOX : vimLevels[0])
  window.addEventListener('hashchange', () => location.reload()) // 엔진을 새 파일로 다시 띄움

  // ── 화면 ──
  $('#level').innerHTML = chapters.filter((c) => vimLevels.some((l) => l.chapter === c.id)).map((c) =>
    `<optgroup label="${c.title}">${vimLevels.filter((l) => l.chapter === c.id).map((l) => `<option value="${l.id}">${escapeHtml(l.title)}</option>`).join('')}</optgroup>`).join('') +
    `<option value="sandbox">${tr('자유 연습장', 'Free practice', '自由练习')}</option>`
  $('#level').value = level.id
  $('#level').onchange = (e) => { location.hash = e.target.value }
  $('#back').href = `../#${level.id}`
  $('#chapter').textContent = chapters.find((c) => c.id === level.chapter)?.title ?? 'playground'
  $('#title').textContent = level.title
  $('#desc').innerHTML = level.desc
  $('#keychips').innerHTML = level.keys.map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join('')
  $('#hint').hidden = !level.solution
  $('#hint-text').innerHTML = level.solution ? `<code>${escapeHtml(level.solution)}</code>` : ''
  $('#reset').onclick = () => location.reload()
  const ext = { js: 'js', py: 'py', yaml: 'yaml' }[level.lang] ?? 'txt'
  $('#winbar').innerHTML = `<span class="crumb">${engine.crumb} › </span>${level.id}.${ext}`
  const par = level.solution ? tokenize(level.solution).length : null
  const goalTexts = level.goal?.text != null ? [level.goal.text].flat() : null
  const lines = level.start.split('\n')

  let count = 0
  let done = false
  let state = null
  const keyLog = []

  function renderGoal(current) {
    const g = level.goal
    if (!g) return ($('#goal').innerHTML = `<p class="dim">${tr('목표 없음. 자유롭게 연습하세요', 'No goal. Practice freely', '没有目标，自由练习吧')}</p>`)
    if (g.cursor) {
      return ($('#goal').innerHTML = tr(`<p>커서를 <span class="target-sample">초록 칸</span>(${g.cursor[0] + 1}행 ${g.cursor[1] + 1}열)으로 옮기세요.</p><p class="dim">이동 과제라 텍스트는 바뀌지 않습니다 (nomodifiable).</p>`, `<p>Move the cursor to the <span class="target-sample">green cell</span> (line ${g.cursor[0] + 1}, column ${g.cursor[1] + 1}).</p><p class="dim">Text cannot change in motion tasks (nomodifiable).</p>`, `<p>把光标移到<span class="target-sample">绿色格子</span>（第 ${g.cursor[0] + 1} 行，第 ${g.cursor[1] + 1} 列）。</p><p class="dim">移动类任务里文本不能修改（nomodifiable）。</p>`))
    }
    $('#goal').innerHTML = '<pre>' + goalTexts[0].split('\n').map((line, i) =>
      `<div class="${current?.[i] === line ? 'ok' : 'diff'}">${escapeHtml(line) || ' '}</div>`).join('') + '</pre>'
  }

  function renderStatus() {
    const mode = MODE[state?.mode] ?? MODE[state?.mode?.[0]] ?? 'normal'
    $('#mode').textContent = mode.toUpperCase()
    $('#mode').dataset.mode = mode
    $('#keys').innerHTML = keyLog.slice(-40).map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join('')
    $('#count').textContent = par ? `${count}/${par}${tr('타', ' keys', ' 键')}` : `${count}${tr('타', ' keys', ' 键')}`
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
    const progress = loadProgress()
    progress[level.id] = Math.max(progress[level.id] ?? 0, s)
    store.set('progress', progress)
    const next = vimLevels[vimLevels.indexOf(level) + 1]
    msg(tr(`"${level.id}" 클리어 — ${engine.name} 에서 ${count}타 (기준 ${par}타)`, `"${level.id}" cleared in ${engine.name} — ${count} keys (par ${par})`, `"${level.id}" 通关 — 在${engine.name} 里用了 ${count} 键（标准 ${par} 键）`), 'ok')
    $('#banner').innerHTML = `<span class="float-title">${tr(`✔ 클리어 (${engine.short})`, `✔ Cleared (${engine.short})`, `✔ 通关（${engine.short}）`)}</span>
      <div class="stars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</div>
      <div>${tr(`<b>${count}</b>타 · 기준 ${par}타`, `<b>${count}</b> keys · par ${par}`, `<b>${count}</b> 键 · 标准 ${par} 键`)}${s < 3 ? `<br><span class="dim">${tr('모범 답안', 'Solution', '参考答案')}</span> <code>${escapeHtml(level.solution)}</code>` : ''}</div>
      <button id="next">${next ? `${tr('다음', 'Next', '下一关')}: ${escapeHtml(next.title)} ⏎` : tr('자유 연습장 ⏎', 'Free practice ⏎', '自由练习 ⏎')}</button>`
    $('#banner').hidden = false
    $('#next').onclick = () => { location.hash = next ? next.id : 'sandbox' }
    $('#next').focus()
  }

  // 키 하나를 타수로 셈. 세지 않는 키(수식 키·클리어 뒤·한글 입력)는 false
  function countKey(e) {
    if (MODIFIERS.has(e.key) || done) return false
    if (e.isComposing || e.keyCode === 229 || /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(e.key)) {
      msg(tr('한/영 키로 영문 전환! Vim 명령은 영문으로만 동작해요', 'Switch your input method to English: Vim commands only work with Latin letters', '请把输入法切换到英文：Vim 命令只认拉丁字母'), 'error')
      return false
    }
    count++
    keyLog.push(e.ctrlKey ? `C-${e.key}` : LABEL[e.key] ?? e.key)
    renderStatus()
    return true
  }

  renderGoal(lines)
  renderStatus()
  return { level, lines, ext, msg, onState, countKey, get done() { return done }, get count() { return count }, get state() { return state } }
}
