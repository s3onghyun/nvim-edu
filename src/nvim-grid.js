// Neovim UI 프로토콜(ext_linegrid)의 redraw 이벤트를 받아 DOM 격자로 그린다. 그리드는 1번 하나만 씀 (multigrid 없음)
// 색은 CSSOM(el.style)으로만 넣어서 style="" 문자열을 만들지 않음
const hex = (n) => (n == null || n < 0 ? null : `#${(n >>> 0).toString(16).padStart(6, '0').slice(-6)}`)

export class NvimGrid {
  constructor(el) {
    this.el = el
    this.width = 0
    this.height = 0
    this.chars = []
    this.hlIds = []
    this.dirty = new Set()
    this.hl = new Map()
    this.colors = { fg: '#e0e0e0', bg: '#14161b', sp: '#e0e0e0' }
    this.cursor = { row: 0, col: 0 }
    this.modeInfo = []
    this.modeIdx = 0
    this.rowEls = []
    this.cursorEl = document.createElement('div')
    this.cursorEl.className = 'nvim-cursor'
  }

  // redraw 알림 한 묶음: [[이름, 인자1, 인자2, ...], ...]
  redraw(batch) {
    for (const [name, ...calls] of batch) {
      const fn = this[`on_${name}`]
      if (fn) for (const args of calls) fn.apply(this, args)
    }
  }

  on_grid_resize(_grid, width, height) {
    this.width = width
    this.height = height
    this.chars = Array.from({ length: height }, () => new Array(width).fill(' '))
    this.hlIds = Array.from({ length: height }, () => new Array(width).fill(0))
    this.el.replaceChildren()
    this.rowEls = Array.from({ length: height }, () => this.el.appendChild(document.createElement('div')))
    this.el.appendChild(this.cursorEl)
    for (let r = 0; r < height; r++) this.dirty.add(r)
  }

  on_default_colors_set(fg, bg, sp) {
    this.colors = { fg: hex(fg) ?? this.colors.fg, bg: hex(bg) ?? this.colors.bg, sp: hex(sp) ?? this.colors.sp }
    this.el.style.color = this.colors.fg
    this.el.style.background = this.colors.bg
    for (let r = 0; r < this.height; r++) this.dirty.add(r)
  }

  on_hl_attr_define(id, rgb) {
    this.hl.set(id, rgb ?? {})
  }

  on_grid_line(_grid, row, col, cells) {
    const chars = this.chars[row]
    const ids = this.hlIds[row]
    if (!chars) return
    let hlId = 0
    for (const [text, id, repeat = 1] of cells) {
      if (id !== undefined) hlId = id
      for (let i = 0; i < repeat && col < this.width; i++, col++) {
        chars[col] = text
        ids[col] = hlId
      }
    }
    this.dirty.add(row)
  }

  on_grid_clear() {
    for (let r = 0; r < this.height; r++) {
      this.chars[r].fill(' ')
      this.hlIds[r].fill(0)
      this.dirty.add(r)
    }
  }

  on_grid_cursor_goto(_grid, row, col) {
    this.cursor = { row, col }
  }

  // top..bot-1, left..right-1 영역을 rows 만큼 위(양수)/아래(음수)로. 빈 곳은 뒤따르는 grid_line 이 채움
  on_grid_scroll(_grid, top, bot, left, right, rows) {
    const move = (dst, src) => {
      for (let c = left; c < right; c++) {
        this.chars[dst][c] = this.chars[src][c]
        this.hlIds[dst][c] = this.hlIds[src][c]
      }
      this.dirty.add(dst)
    }
    if (rows > 0) for (let r = top; r < bot - rows; r++) move(r, r + rows)
    else for (let r = bot - 1; r >= top - rows; r--) move(r, r + rows)
  }

  on_mode_info_set(_enabled, info) {
    this.modeInfo = info
  }

  on_mode_change(_mode, idx) {
    this.modeIdx = idx
  }

  on_flush() {
    for (const r of this.dirty) this.renderRow(r)
    this.dirty.clear()
    this.renderCursor()
  }

  style(id) {
    const a = this.hl.get(id) ?? {}
    let fg = hex(a.foreground) ?? this.colors.fg
    let bg = hex(a.background)
    if (a.reverse) [fg, bg] = [bg ?? this.colors.bg, fg]
    return { fg, bg, bold: a.bold, italic: a.italic, under: a.underline || a.undercurl || a.underdouble || a.underdotted || a.underdashed, strike: a.strikethrough }
  }

  renderRow(r) {
    const el = this.rowEls[r]
    if (!el) return
    const frag = document.createDocumentFragment()
    const chars = this.chars[r]
    const ids = this.hlIds[r]
    for (let c = 0; c < this.width;) {
      const id = ids[c]
      let text = ''
      while (c < this.width && ids[c] === id) text += chars[c++] // 전각 문자 뒤 칸은 '' 라 폭이 맞음
      const span = document.createElement('span')
      span.textContent = text
      if (id) {
        const s = this.style(id)
        if (s.fg !== this.colors.fg) span.style.color = s.fg
        if (s.bg) span.style.background = s.bg
        if (s.bold) span.style.fontWeight = 'bold'
        if (s.italic) span.style.fontStyle = 'italic'
        if (s.under || s.strike) span.style.textDecoration = `${s.under ? 'underline' : ''} ${s.strike ? 'line-through' : ''}`
      }
      frag.appendChild(span)
    }
    el.replaceChildren(frag)
  }

  // 커서 모양은 mode_info_set 의 cursor_shape (block · vertical · horizontal) 그대로
  renderCursor() {
    const { row, col } = this.cursor
    const info = this.modeInfo[this.modeIdx] ?? {}
    const shape = info.cursor_shape ?? 'block'
    const pct = info.cell_percentage || 100
    const el = this.cursorEl
    el.dataset.shape = shape
    el.style.top = `calc(${row} * var(--nvim-line))`
    el.style.left = `calc(${col} * var(--nvim-cell))`
    el.style.background = this.colors.fg
    el.style.color = this.colors.bg
    el.style.width = shape === 'vertical' ? `calc(var(--nvim-cell) * ${pct / 100})` : 'var(--nvim-cell)'
    el.style.height = shape === 'horizontal' ? `calc(var(--nvim-line) * ${pct / 100})` : 'var(--nvim-line)'
    el.style.marginTop = shape === 'horizontal' ? `calc(var(--nvim-line) * ${1 - pct / 100})` : '0'
    el.textContent = shape === 'block' ? (this.chars[row]?.[col] || ' ') : ''
  }
}
