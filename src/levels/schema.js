// vim-levels.json 의 레벨 하나 = 아래 필드를 가진 객체. 배열 순서 = 챕터 안에서 게임에 나오는 순서
//
// id        필수  문자열. 소문자·숫자·하이픈 (URL #id 와 levels.en.js 키로 씀). 전체에서 유일
// chapter   필수  'move' | 'edit' | 'object' | 'power' | 'real' | 'guru' (src/levels.js 의 chapters)
// title     필수  문자열 (한국어. 영어는 levels.en.js 에 같은 id 로)
// desc      필수  문자열, HTML 허용 (<b> <code> <kbd> <em>)
// keys      필수  문자열 배열. 이 레벨에서 배우는 키 (화면 위 칩)
// lang      선택  'js' | 'py' | 'yaml'. 구문 강조
// start     필수  시작 버퍼. 줄바꿈은 \n
// cursor    필수  시작 커서 [줄, 칸] (0부터). start 안에 있어야 함
// goal      필수  { "text": "목표 버퍼" } → 텍스트가 같고 NORMAL 모드면 클리어
//                 { "cursor": [줄, 칸] } → 커서가 그 칸에 오면 클리어 (텍스트 수정 불가)
// solution  필수  모범 답안 키 시퀀스. <Esc> <CR> <C-a> 표기. par(★★★ 기준 타수) = 답안 키 수

export const VIM_CHAPTERS = ['move', 'edit', 'object', 'power', 'real', 'guru']
const FIELDS = ['id', 'chapter', 'title', 'desc', 'keys', 'lang', 'start', 'cursor', 'goal', 'solution']
const LANGS = ['js', 'py', 'yaml']

const isStr = (v) => typeof v === 'string' && v.length > 0
const isPos = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n >= 0)
// 커서가 버퍼 안인지. 칸은 줄 길이까지 허용 ($ 로 간 줄 끝 = 길이)
const inBuffer = (text, [line, col]) => {
  const lines = text.split('\n')
  return line < lines.length && col <= lines[line].length
}

// 문제마다 "레벨 <id>: <필드> <무엇이 잘못됐나>" 한 줄. 빈 배열이면 통과
export function validateLevels(levels) {
  if (!Array.isArray(levels)) return ['vim-levels.json 은 레벨 객체의 배열이어야 합니다']
  const errors = []
  const seen = new Set()
  levels.forEach((l, i) => {
    const name = `레벨 ${isStr(l?.id) ? l.id : `#${i}`}`
    const err = (msg) => errors.push(`${name}: ${msg}`)
    if (typeof l !== 'object' || l === null || Array.isArray(l)) return err('객체가 아닙니다')
    for (const k of Object.keys(l)) if (!FIELDS.includes(k)) err(`모르는 필드 "${k}" (허용: ${FIELDS.join(', ')})`)
    if (!isStr(l.id) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(l.id)) err(`id 는 소문자·숫자·하이픈 문자열이어야 합니다 (지금: ${JSON.stringify(l.id)})`)
    else if (seen.has(l.id)) err('id 가 중복됩니다')
    seen.add(l.id)
    if (!VIM_CHAPTERS.includes(l.chapter)) err(`chapter 는 ${VIM_CHAPTERS.join(' | ')} 중 하나여야 합니다 (지금: ${JSON.stringify(l.chapter)})`)
    for (const k of ['title', 'desc', 'solution']) if (!isStr(l[k])) err(`${k} 는 빈 문자열이 아닌 문자열이어야 합니다`)
    if (!Array.isArray(l.keys) || !l.keys.length || !l.keys.every(isStr)) err('keys 는 문자열 배열이어야 합니다')
    if (l.lang !== undefined && !LANGS.includes(l.lang)) err(`lang 은 ${LANGS.join(' | ')} 중 하나이거나 생략해야 합니다 (지금: ${JSON.stringify(l.lang)})`)
    if (typeof l.start !== 'string') err('start 는 문자열이어야 합니다')
    if (!isPos(l.cursor)) err(`cursor 는 [줄, 칸] (0 이상 정수 2개) 이어야 합니다 (지금: ${JSON.stringify(l.cursor)})`)
    else if (typeof l.start === 'string' && !inBuffer(l.start, l.cursor)) err(`cursor ${JSON.stringify(l.cursor)} 가 start 버퍼 밖입니다`)
    const g = l.goal
    const gKeys = g && typeof g === 'object' ? Object.keys(g) : []
    if (gKeys.length !== 1 || !['text', 'cursor'].includes(gKeys[0])) err(`goal 은 {"text": ...} 또는 {"cursor": [줄, 칸]} 하나여야 합니다 (지금: ${JSON.stringify(g)})`)
    else if (gKeys[0] === 'text' && typeof g.text !== 'string') err('goal.text 는 문자열이어야 합니다')
    else if (gKeys[0] === 'cursor') {
      if (!isPos(g.cursor)) err(`goal.cursor 는 [줄, 칸] 이어야 합니다 (지금: ${JSON.stringify(g.cursor)})`)
      else if (typeof l.start === 'string' && !inBuffer(l.start, g.cursor)) err(`goal.cursor ${JSON.stringify(g.cursor)} 가 start 버퍼 밖입니다`)
    }
  })
  return errors
}
