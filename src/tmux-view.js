// tmux 상태 → HTML. 상태는 바꾸지 않는다.
import { t } from './i18n.js'
import { session, win, paneIds, windowName, copyLines, promptOf, selection } from './tmux.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function lineHtml(text, i, term, showCursor) {
  const c = term.copy
  const sel = selection(term)
  const inSel = sel && i >= sel.start.line && i <= sel.end.line
  const isCur = c && c.line === i
  if (!inSel && !isCur) return esc(text) || ' '
  // 선택 영역 / copy 커서가 걸친 줄만 글자 단위로 감쌈
  const chars = [...(text || ' ')]
  return chars.map((ch, col) => {
    const selected = inSel && (i > sel.start.line || col >= sel.start.col) && (i < sel.end.line || col <= sel.end.col)
    const cls = isCur && col === c.col ? 't-ccur' : selected ? 't-sel' : ''
    return cls ? `<span class="${cls}">${esc(ch)}</span>` : esc(ch)
  }).join('') + (isCur && c.col >= chars.length ? '<span class="t-ccur"> </span>' : '')
}

function termHtml(term, active, s) {
  const lines = copyLines(term)
  const body = lines.map((text, i) => {
    const last = i === lines.length - 1
    let html = lineHtml(text, i, term)
    if (last && active && !term.copy && !s.prompt && !s.chooser) html = esc(promptOf(term) + term.input) + '<span class="t-cur"> </span>'
    return `<div class="t-line${term.copy?.line === i ? ' t-cline' : ''}">${html}</div>`
  }).join('')
  const pos = term.copy ? `<span class="t-pos">[${term.copy.line + 1}/${lines.length}]</span>` : ''
  return `<div class="t-scroll">${body}</div>${pos}`
}

function paneHtml(s, id, opts, number) {
  const w = win(s)
  const active = id === w.active
  const cls = ['t-pane', active && 't-active', opts.target === id && 't-target'].filter(Boolean).join(' ')
  const num = s.showNumbers ? `<span class="t-num${active ? ' t-num-active' : ''}">${number}</span>` : ''
  return `<div class="${cls}">${termHtml(s.panes[id], active, s)}${num}</div>`
}

function nodeHtml(s, node, opts, ids) {
  if (node.pane) return paneHtml(s, node.pane, opts, ids.indexOf(node.pane))
  return `<div class="t-split t-${node.dir}">${node.children.map((c) => nodeHtml(s, c, opts, ids)).join('')}</div>`
}

function statusHtml(s) {
  const sess = session(s)
  const now = new Date()
  const right = `"nvim-edu" ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  if (s.prompt) return `<span class="t-msg">${esc(s.prompt.label)} ${esc(s.prompt.value)}<span class="t-cur"> </span></span>`
  if (s.confirm) return `<span class="t-msg">${esc(s.confirm.label)}</span>`
  if (s.message) return `<span class="t-msg">${esc(s.message)}</span>`
  const wins = sess.windows.map((w, i) => {
    const flag = i === sess.active ? '*' : ''
    return `<span class="${i === sess.active ? 't-curwin' : ''}">${i}:${esc(windowName(s, w))}${flag}${w.zoomed ? 'Z' : ''}</span>`
  }).join(' ')
  return `<span>[${esc(sess.name)}]</span> ${wins}<span class="t-right">${esc(right)}</span>`
}

export function renderTmux(s, el, opts = {}) {
  if (!s.attached) {
    // tmux 밖: 평범한 쉘 화면 전체
    el.innerHTML = `<div class="t-panes"><div class="t-pane t-active">${termHtml(s.outer, true, s)}</div></div>`
  } else {
    const w = win(s)
    const ids = paneIds(w.layout)
    const panes = w.zoomed ? paneHtml(s, w.active, opts, ids.indexOf(w.active)) : nodeHtml(s, w.layout, opts, ids)
    const chooser = s.chooser
      ? `<div class="t-chooser">${s.chooser.items.map((name, i) => {
          const x = s.sessions.find((y) => y.name === name)
          return `<div class="${i === s.chooser.index ? 't-row-sel' : ''}">(${i}) + ${esc(name)}: ${x.windows.length} windows${name === s.attached ? ' (attached)' : ''}</div>`
        }).join('')}<div class="t-hint">${t('j/k 이동 · Enter 선택 · q 닫기', 'j/k move · Enter select · q close', 'j/k 移动 · Enter 选择 · q 关闭')}</div></div>`
      : ''
    el.innerHTML = `<div class="t-panes">${panes}${chooser}</div><div class="t-status">${statusHtml(s)}</div>`
  }
  // 평소엔 맨 아래, copy mode 에선 커서 줄이 보이게
  for (const sc of el.querySelectorAll('.t-scroll')) {
    const cur = sc.querySelector('.t-cline')
    sc.scrollTop = cur ? cur.offsetTop - sc.clientHeight / 2 : sc.scrollHeight
  }
}

export function tmuxMode(s) {
  if (s.prompt) return 'prompt'
  if (s.attached && win(s) && s.panes[win(s).active]?.copy) return 'copy'
  if (s.prefix) return 'prefix'
  return s.attached ? 'tmux' : 'shell'
}

export function tmuxTarget(s) {
  if (!s.attached) return 'shell'
  const sess = session(s)
  return `${sess.name}:${sess.active}.${paneIds(win(s).layout).indexOf(win(s).active)}`
}
