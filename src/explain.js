// 풀이 해설: 키 입력을 Vim 명령 단위로 끊고(splitCommands), 뜻을 붙이고(describe),
// 에디터를 보이지 않게 하나 더 띄워 명령마다 다시 실행해 결과를 보여 줌(replay)
import { t } from './i18n.js'

const MOTION = {
  h: ['왼쪽으로', 'left', '向左'], j: ['아래로', 'down', '向下'], k: ['위로', 'up', '向上'], l: ['오른쪽으로', 'right', '向右'],
  w: ['다음 단어 시작으로', 'to the next word', '到下一个单词开头'], b: ['이전 단어 시작으로', 'back to the previous word', '回到上一个单词开头'], e: ['단어 끝으로', 'to the end of the word', '到单词结尾'],
  W: ['다음 WORD(공백 기준)로', 'to the next WORD', '到下一个 WORD（以空白分隔）'], B: ['이전 WORD로', 'back to the previous WORD', '回到上一个 WORD'], E: ['WORD 끝으로', 'to the end of the WORD', '到 WORD 结尾'],
  0: ['줄 맨 앞으로', 'to the start of the line', '到行首'], '^': ['줄의 첫 글자로', 'to the first non-blank', '到本行第一个非空白字符'], $: ['줄 끝으로', 'to the end of the line', '到行尾'],
  gg: ['파일 맨 위로', 'to the top of the file', '到文件顶部'], G: ['파일 맨 아래로', 'to the bottom of the file', '到文件底部'],
  '%': ['짝 괄호로', 'to the matching bracket', '到配对的括号'], n: ['다음 검색 결과로', 'to the next match', '到下一个搜索结果'], N: ['이전 검색 결과로', 'to the previous match', '到上一个搜索结果'],
  '*': ['커서 밑 단어를 단어 단위로 검색 (다음)', 'search the word under the cursor (forward)', '按完整单词搜索光标下的词（下一个）'], '#': ['커서 밑 단어를 단어 단위로 검색 (이전)', 'search the word under the cursor (backward)', '按完整单词搜索光标下的词（上一个）'],
  ';': ['f/t 를 같은 방향으로 반복', 'repeat f/t', '同方向重复 f/t'], ',': ['f/t 를 반대 방향으로 반복', 'repeat f/t backwards', '反方向重复 f/t'],
  '{': ['이전 빈 줄로', 'to the previous blank line', '到上一个空行'], '}': ['다음 빈 줄로', 'to the next blank line', '到下一个空行'],
  H: ['화면 맨 위 줄로', 'to the top of the screen', '到屏幕顶行'], M: ['화면 가운데 줄로', 'to the middle of the screen', '到屏幕中间行'], L: ['화면 맨 아래 줄로', 'to the bottom of the screen', '到屏幕底行'],
}
const FIND = { f: ['까지 이동 (글자 위)', 'find'], t: ['바로 앞까지 이동', 'till'], F: ['를 거꾸로 찾아 이동', 'find backwards'], T: ['바로 뒤까지 거꾸로 이동', 'till backwards'] }
const OBJECT = {
  w: ['단어', 'word', '单词'], W: ['WORD', 'WORD', 'WORD'], s: ['문장', 'sentence', '句子'], p: ['문단', 'paragraph', '段落'],
  '"': ['큰따옴표', 'double quotes', '双引号'], "'": ['작은따옴표', 'single quotes', '单引号'], '`': ['백틱', 'backticks', '反引号'],
  '(': ['괄호', 'parentheses', '括号'], ')': ['괄호', 'parentheses', '括号'], b: ['괄호', 'parentheses', '括号'],
  '{': ['중괄호', 'braces', '花括号'], '}': ['중괄호', 'braces', '花括号'], B: ['중괄호', 'braces', '花括号'],
  '[': ['대괄호', 'brackets', '方括号'], ']': ['대괄호', 'brackets', '方括号'], '<': ['꺾쇠', 'angle brackets', '尖括号'], '>': ['꺾쇠', 'angle brackets', '尖括号'], t: ['태그', 'tag', '标签'],
}
const OPERATOR = {
  d: ['삭제', 'delete', '删除'], c: ['바꾸기 (지우고 입력)', 'change (delete and type)', '修改（删除后输入）'], y: ['복사', 'yank (copy)', '复制'],
  '>': ['들여쓰기', 'indent', '缩进'], '<': ['내어쓰기', 'unindent', '取消缩进'], '=': ['자동 들여쓰기', 'auto-indent', '自动缩进'],
  gU: ['대문자로', 'uppercase', '转大写'], gu: ['소문자로', 'lowercase', '转小写'], 'g~': ['대소문자 뒤집기', 'toggle case', '切换大小写'],
}
const LINEWISE = { dd: ['줄 삭제', 'delete the line', '删除整行'], cc: ['줄 전체 바꾸기', 'change the whole line', '修改整行'], yy: ['줄 복사', 'yank the line', '复制整行'], '>>': ['줄 들여쓰기', 'indent the line', '缩进整行'], '<<': ['줄 내어쓰기', 'unindent the line', '整行取消缩进'] }
const ACTION = {
  x: ['커서 글자 삭제', 'delete the character', '删除光标处的字符'], X: ['앞 글자 삭제', 'delete the character before', '删除前一个字符'],
  p: ['커서 뒤(줄이면 아래)에 붙여넣기', 'paste after (below for lines)', '粘贴到光标后（整行则贴到下方）'], P: ['커서 앞(줄이면 위)에 붙여넣기', 'paste before (above for lines)', '粘贴到光标前（整行则贴到上方）'],
  u: ['되돌리기', 'undo', '撤销'], '<C-r>': ['다시 하기', 'redo', '重做'], '.': ['마지막 변경 반복', 'repeat the last change', '重复上一次修改'],
  J: ['아래 줄과 합치기', 'join with the next line', '与下一行合并'], D: ['줄 끝까지 삭제', 'delete to the end of the line', '删除到行尾'], Y: ['줄 끝까지 복사', 'yank to the end of the line', '复制到行尾'],
  '~': ['대소문자 바꾸고 다음 글자로', 'toggle case and move right', '切换大小写并右移一格'], '<C-a>': ['숫자 1 올리기', 'increment the number', '数字加 1'], '<C-x>': ['숫자 1 내리기', 'decrement the number', '数字减 1'],
  '@@': ['마지막 매크로 다시 실행', 'replay the last macro', '重放上一个宏'], q: ['매크로 녹화 끝', 'stop recording', '停止录制'], gv: ['마지막 선택 다시', 'reselect', '重新选中上次的选区'],
}
const INSERT = {
  i: ['커서 앞에서 입력', 'insert before the cursor', '在光标前输入'], a: ['커서 뒤에서 입력', 'append after the cursor', '在光标后输入'],
  I: ['줄 맨 앞에서 입력', 'insert at the start of the line', '在行首输入'], A: ['줄 끝에서 입력', 'append at the end of the line', '在行尾输入'],
  o: ['아래 새 줄에서 입력', 'open a line below', '在下方新开一行输入'], O: ['위 새 줄에서 입력', 'open a line above', '在上方新开一行输入'],
  s: ['글자 지우고 입력', 'substitute the character', '删除字符后输入'], S: ['줄 지우고 입력', 'substitute the line', '清空整行后输入'], C: ['줄 끝까지 지우고 입력', 'change to the end of the line', '删到行尾后输入'],
}
const VISUAL = { v: ['글자 단위 선택', 'select characters', '按字符选择'], V: ['줄 단위 선택', 'select lines', '按行选择'], '<C-v>': ['세로 블록 선택', 'select a block', '按列块选择'] }
const VISUAL_END = new Set(['d', 'x', 'c', 's', 'y', '>', '<', '=', 'J', '~', 'u', 'U', 'I', 'A', 'r', ':', 'p', 'P', '<Esc>'])
const VISUAL_INSERT = new Set(['c', 's', 'I', 'A'])

const tr = (pair) => t(pair[0], pair[1], pair[2])
const isCount = (k, first) => /^[0-9]$/.test(k) && !(first && k === '0')

// tokens(['d','i','w',...]) → [{ keys: [...], kind }]. 한 번에 실행되는 단위로 묶음
export function splitCommands(tokens) {
  const out = []
  let i = 0
  const take = (n = 1) => tokens.slice(i, (i += n))
  const untilEsc = () => { const s = i; while (i < tokens.length && tokens[i] !== '<Esc>') i++; if (i < tokens.length) i++; return tokens.slice(s, i) }
  const untilCR = () => { const s = i; while (i < tokens.length && tokens[i] !== '<CR>') i++; if (i < tokens.length) i++; return tokens.slice(s, i) }
  // count/레지스터 뒤의 이동·오브젝트 하나 (operator 인자나 단독 이동)
  const motion = () => {
    const s = i
    while (isCount(tokens[i], i === s)) i++
    const k = tokens[i]
    if (k === undefined) return tokens.slice(s, i)
    if ('fFtT'.includes(k) || k === "'" || k === '`') i += 2
    else if ((k === 'i' || k === 'a') && tokens[i + 1] !== undefined) i += 2
    else if (k === 'g') i += 2
    else if (k === '/' || k === '?') { untilCR(); return tokens.slice(s, i) }
    else i++
    return tokens.slice(s, i)
  }
  while (i < tokens.length) {
    const s = i
    if (tokens[i] === '"') i += 2
    while (isCount(tokens[i], i === s || tokens[s] === '"')) i++
    const k = tokens[i]
    const two = k + (tokens[i + 1] ?? '')
    let kind = 'action'
    if (k === ':' || k === '/' || k === '?') { untilCR(); kind = k === ':' ? 'ex' : 'motion' }
    else if (k === 'q' && tokens[i + 1] && /^[a-z]$/.test(tokens[i + 1])) { i += 2; kind = 'record' }
    else if (k === '@') i += 2
    else if (k === 'r' || k === 'm') i += 2
    else if (VISUAL[k]) {
      i++; kind = 'visual'
      while (i < tokens.length && !VISUAL_END.has(tokens[i])) motion()
      const end = tokens[i]
      if (end === ':') untilCR()
      else if (end === 'r') i += 2
      else if (end !== undefined) { i++; if (VISUAL_INSERT.has(end)) untilEsc() }
    } else if (INSERT[k]) { i++; untilEsc(); kind = 'insert' }
    else if (two === 'gU' || two === 'gu' || two === 'g~' || 'dcy<>='.includes(k)) {
      const op = k === 'g' ? two : k
      i += op.length
      const rest = tokens.slice(i, i + op.length).join('')
      if (rest === op || (op.length === 2 && tokens[i] === op[1])) i += rest === op ? op.length : 1
      else motion()
      kind = 'operator'
      if (op === 'c') untilEsc()
    } else if (two === 'gg' || two === 'gv' || two === 'gJ' || two === 'gi') { i += 2; if (two === 'gi') untilEsc(); kind = two === 'gg' ? 'motion' : 'action' }
    else if (ACTION[k] !== undefined || ACTION[two] !== undefined) { i += ACTION[two] ? 2 : 1 }
    else { i = s; motion(); kind = 'motion' }
    if (i === s) i++ // 모르는 키도 하나씩은 넘어감
    const keys = tokens.slice(s, i)
    const prev = out.at(-1)
    // j j → 한 줄로 (같은 한 글자 이동 연속)
    if (kind === 'motion' && keys.length === 1 && MOTION[keys[0]] && prev?.kind === 'motion' && prev.keys.every((x) => x === keys[0])) prev.keys.push(keys[0])
    else out.push({ keys, kind })
  }
  return out
}

const quote = (s) => `<code>${s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</code>`
const typed = (keys) => keys.filter((k) => k !== '<Esc>').map((k) => (k === '<CR>' ? '⏎' : k)).join('')

// target: operator 의 대상일 때 ('…까지 삭제'), 아니면 이동 ('…로')
function describeMotion(keys, target = false, op = '') {
  if (keys.length > 1 && keys.every((k) => k === keys[0]) && MOTION[keys[0]]) return `${describeMotion([keys[0]], target, op)} ×${keys.length}`
  const j = keys.findIndex((k) => !/^[0-9]$/.test(k))
  const n = j > 0 ? Number(keys.slice(0, j).join('')) : null
  const [k, arg] = [keys[j], keys[j + 1]]
  const nth = n ? `${n}번째 ` : ''
  const nthZh = n ? `第 ${n} 个 ` : ''
  if (k === 'G' && n) return t(target ? `${n}번째 줄까지` : `${n}번째 줄로`, `to line ${n}`, `到第 ${n} 行`)
  if (FIND[k]) {
    const en = `${n ? `the ${n}th ` : ''}${quote(arg)}`
    if (target) return t({ f: `${nth}${quote(arg)} 까지(포함)`, t: `${nth}${quote(arg)} 바로 앞까지`, F: `거꾸로 ${nth}${quote(arg)} 까지(포함)`, T: `거꾸로 ${nth}${quote(arg)} 바로 뒤까지` }[k],
      { f: `up to and including ${en}`, t: `up to ${en}`, F: `back to and including ${en}`, T: `back to just after ${en}` }[k],
      { f: `到${nthZh}${quote(arg)}（含）`, t: `到${nthZh}${quote(arg)} 之前`, F: `向回到${nthZh}${quote(arg)}（含）`, T: `向回到${nthZh}${quote(arg)} 之后` }[k])
    return t(`${nth}${quote(arg)} ${FIND[k][0]}`, `${FIND[k][1]} ${n ? `the ${n}th ` : ''}${quote(arg)}`,
      { f: `跳到${nthZh}${quote(arg)} 上`, t: `跳到${nthZh}${quote(arg)} 前一格`, F: `向回跳到${nthZh}${quote(arg)} 上`, T: `向回跳到${nthZh}${quote(arg)} 后一格` }[k])
  }
  if (k === '/' || k === '?') {
    const q = quote(typed(keys.slice(j + 1).filter((x) => x !== '<CR>')))
    return t(target ? `${q} 검색 결과 앞까지` : `${q} 검색해서 이동`, `${target ? 'up to' : 'search for'} ${q}`, target ? `到 ${q} 搜索结果之前` : `搜索 ${q} 并跳过去`)
  }
  if ((k === 'i' || k === 'a') && OBJECT[arg]) {
    const o = OBJECT[arg]
    return k === 'i' ? t(`${o[0]} 안`, `inside the ${o[1]}`, `${o[2]}内部`) : t(`${o[0]} 전체(감싼 것 포함)`, `around the ${o[1]}`, `整个${o[2]}（含外围）`)
  }
  // cw 는 실제로 ce 처럼 단어 끝까지만 (Vim 의 오래된 예외)
  if (target && op === 'c' && (k === 'w' || k === 'W')) return t(n ? `${n}번째 단어 끝까지` : '단어 끝까지', n ? `to the end of word ${n}` : 'to the end of the word', n ? `到第 ${n} 个单词结尾` : '到单词结尾')
  const m = MOTION[k === 'g' ? k + arg : k]
  if (!m) return quote(keys.join(''))
  const ko = target ? m[0].replace(/(으로|로)$/, '까지') : m[0]
  return n ? t(`${n}번 ${ko}`, `${m[1]} ×${n}`, `${m[2]} ×${n}`) : t(ko, m[1], m[2])
}

function describeEx(cmd) {
  let m
  if ((m = cmd.match(/^(%|\d*,?\d*)?s(\/.*)$/))) {
    const [, pat, rep, flags = ''] = m[2].split('/')
    const where = m[1] === '%' ? t('파일 전체에서 ', 'everywhere: ', '整个文件：') : t('현재 줄에서 ', 'on this line: ', '当前行：')
    return where + t(`${quote(pat)} → ${quote(rep ?? '')} 치환${flags.includes('g') ? ' (줄마다 전부)' : ''}`, `replace ${quote(pat)} with ${quote(rep ?? '')}${flags.includes('g') ? ' (all per line)' : ''}`, `把 ${quote(pat)} 替换为 ${quote(rep ?? '')}${flags.includes('g') ? '（每行全部）' : ''}`)
  }
  if ((m = cmd.match(/^(g|v|g!)\/(.*?)\/(.*)$/))) {
    const inv = m[1] !== 'g'
    const keys = quote(m[3].replace(/^norm(al)?!? ?/, ''))
    const what = m[3] === 'd' ? t(' 삭제', 'delete', '删除') : m[3].startsWith('norm') ? t(`마다 NORMAL 키 ${keys} 실행`, `run NORMAL keys ${keys}`, `执行 NORMAL 键 ${keys}`) : t(`마다 ${quote(m[3])}`, quote(m[3]))
    return t(`${quote(m[2])} 가 ${inv ? '없는' : '있는'} 줄${what}`, `on lines ${inv ? 'without' : 'with'} ${quote(m[2])}: ${what}`, `在${inv ? '不含' : '含有'} ${quote(m[2])} 的行上：${what}`)
  }
  if ((m = cmd.match(/^sor(t)? ?(u)?$/))) return m[2] ? t('줄 정렬 + 중복 삭제', 'sort lines and drop duplicates', '排序并去重') : t('줄 정렬', 'sort lines', '排序')
  if (/^\d+$/.test(cmd)) return t(`${cmd}번째 줄로`, `to line ${cmd}`, `到第 ${cmd} 行`)
  return t(`Ex 명령 ${quote(cmd)} 실행`, `run the Ex command ${quote(cmd)}`, `执行 Ex 命令 ${quote(cmd)}`)
}

// 명령 하나의 뜻 (HTML)
export function describe({ keys, kind }) {
  let s = 0
  let reg = ''
  if (keys[0] === '"') { reg = keys[1]; s = 2 }
  let e = s
  while (/^[0-9]$/.test(keys[e]) && !(e === s && keys[e] === '0')) e++
  const n = e > s ? Number(keys.slice(s, e).join('')) : null
  const rest = keys.slice(e)
  const k = rest[0]
  const times = (x) => (n ? t(`${x} ×${n}`, `${x} ×${n}`) : x)
  const withReg = (x) => (reg ? t(`${x} (레지스터 ${quote(reg)})`, `${x} (register ${quote(reg)})`, `${x}（寄存器 ${quote(reg)}）`) : x)
  switch (kind) {
    case 'ex': return describeEx(typed(keys).slice(1).replace(/⏎$/, ''))
    case 'record': return t(`매크로 녹화 시작 (레지스터 ${quote(rest[1])})`, `start recording a macro into ${quote(rest[1])}`, `开始录制宏（寄存器 ${quote(rest[1])}）`)
    case 'insert': {
      const text = typed(rest.slice(1))
      return t(`${tr(INSERT[k])}: ${quote(text)} 입력 후 Esc`, `${tr(INSERT[k])}: type ${quote(text)}, then Esc`, `${tr(INSERT[k])}：输入 ${quote(text)} 后按 Esc`)
    }
    case 'visual': {
      const end = rest.findIndex((x, idx) => idx > 0 && VISUAL_END.has(x))
      const moves = splitCommands(rest.slice(1, end < 0 ? undefined : end)).map((c) => describeMotion(c.keys)).join(', ')
      const op = end < 0 ? '' : rest[end]
      const after = op === 'I' || op === 'A' ? t(`${op === 'I' ? '앞' : '뒤'}에 ${quote(typed(rest.slice(end + 1)))} 입력 (모든 줄)`, `${op === 'I' ? 'insert' : 'append'} ${quote(typed(rest.slice(end + 1)))} on every line`, `在每一行${op === 'I' ? '前面' : '后面'}输入 ${quote(typed(rest.slice(end + 1)))}`)
        : op === ':' ? describeEx(typed(rest.slice(end + 1)).replace(/^'<,'>/, '').replace(/⏎$/, ''))
        : OPERATOR[op] ? tr(OPERATOR[op]) : ACTION[op] ? tr(ACTION[op]) : op ? quote(op) : ''
      return `${tr(VISUAL[k])}${moves ? ` → ${moves}` : ''}${after ? ` → ${after}` : ''}`
    }
    case 'operator': {
      const op = k === 'g' ? k + rest[1] : k
      const tail = rest.slice(op.length)
      // dd · yy · >> · gUU · gUgU 는 줄 단위
      const lineLen = tail.slice(0, op.length).join('') === op ? op.length : op.length === 2 && tail[0] === op[1] ? 1 : 0
      const len = lineLen || motionLength(tail)
      const target = lineLen ? null : describeMotion(tail.slice(0, len), true, op)
      const base = lineLen ? (LINEWISE[op + op] ? tr(LINEWISE[op + op]) : t(`줄 ${tr(OPERATOR[op])}`, `${tr(OPERATOR[op])} the line`, `整行${tr(OPERATOR[op])}`))
        : t(`${target} ${tr(OPERATOR[op])}`, `${tr(OPERATOR[op])} ${target}`, `${tr(OPERATOR[op])}：${target}`)
      return withReg(times(base)) + (op === 'c' ? t(` → ${quote(typed(tail.slice(len)))} 입력`, ` → type ${quote(typed(tail.slice(len)))}`, ` → 输入 ${quote(typed(tail.slice(len)))}`) : '')
    }
    case 'motion': return describeMotion(keys)
    default: {
      if (k === '@') return times(t(`매크로 ${quote(rest[1])} 실행`, `replay macro ${quote(rest[1])}`, `重放宏 ${quote(rest[1])}`))
      if (k === 'r') return t(`글자를 ${quote(rest[1])} 로 바꾸기`, `replace the character with ${quote(rest[1])}`, `把字符替换为 ${quote(rest[1])}`)
      if (k === 'm') return t(`위치를 ${quote(rest[1])} 로 표시`, `set mark ${quote(rest[1])}`, `设置标记 ${quote(rest[1])}`)
      const two = rest.slice(0, 2).join('')
      const a = ACTION[two] ?? ACTION[k]
      return a ? withReg(times(tr(a))) : quote(keys.join(''))
    }
  }
}

// operator 뒤 이동/오브젝트의 키 수 (count 포함)
function motionLength(tail) {
  let i = 0
  while (/^[0-9]$/.test(tail[i]) && !(i === 0 && tail[i] === '0')) i++
  const k = tail[i]
  if (k === '/' || k === '?') { const cr = tail.indexOf('<CR>', i); return cr < 0 ? tail.length : cr + 1 }
  if ('fFtTia'.includes(k) || k === 'g' || k === "'" || k === '`') return i + 2
  return i + 1
}

// 입력 모드의 글자는 사람이 친 것처럼 문서에 직접 넣음 (Vim 키로 해석하지 않음)
function insertKey(cm, key) {
  if (key === '<BS>') {
    const c = cm.getCursor()
    if (c.ch > 0) cm.replaceRange('', { line: c.line, ch: c.ch - 1 }, c)
  } else if (key === '<CR>') cm.replaceSelection('\n')
  else if (key === '<Tab>') cm.replaceSelection('\t')
  else if (key.length === 1) cm.replaceSelection(key)
}

// 명령 하나 실행. 키는 실제 타이핑과 같은 경로(handleKey)로 넣어야 매크로 녹화(qa…q)에 남음.
// : 와 / 는 입력창이 필요해서 :normal 로 (가상 입력창)
function run(cm, cmd, Vim) {
  const prompt = (k) => cmd.keys.includes(k)
  if (cmd.kind === 'ex' || ((cmd.kind === 'motion' || cmd.kind === 'operator') && (prompt('/') || prompt('?'))) || (cmd.kind === 'visual' && prompt(':'))) {
    return Vim.handleEx(cm, 'normal ' + cmd.keys.join(''))
  }
  const vim = cm.state.vim
  for (const key of cmd.keys) {
    if (vim.insertMode && key !== '<Esc>' && !key.startsWith('<C-')) insertKey(cm, key)
    else if (!Vim.handleKey(cm, key, 'user') && vim.insertMode) insertKey(cm, key)
  }
}

// 보이지 않는 에디터에서 명령마다 다시 실행 → [{ keys, html, text, cursor, mode }]
// makeView(text, cursor) 는 main.js 가 실제 에디터와 같은 확장으로 만들어 줌
// shortcut: 레지스터·검색어·매크로는 Vim 전역 상태라 리플레이가 덮어씀. 해설은 클리어 뒤나 답안 보기 때만 돌려서 영향이 작음
export function replay(tokens, makeView, Vim, getCM) {
  const { view, start } = makeView()
  const cm = getCM(view)
  const steps = []
  try {
    for (const cmd of splitCommands(tokens)) {
      try { run(cm, cmd, Vim) } catch { /* 실패한 명령은 결과만 그대로 */ }
      const head = view.state.selection.main.head
      const line = view.state.doc.lineAt(head)
      steps.push({ ...cmd, html: describe(cmd), text: view.state.doc.toString(), cursor: [line.number - 1, head - line.from] })
    }
  } finally {
    view.destroy()
  }
  return { start, steps }
}
