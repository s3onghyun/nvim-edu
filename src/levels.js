// 레벨 정의. Vim 레벨 필드 설명은 src/levels/schema.js
// solution: 모범 답안 키 시퀀스. <Esc>, <CR>, <C-x> 표기. par(기준 타수) = 답안 키 수

import { AGENT_LOG, win, pane, session, shape, paneIds } from './tmux.js'
import { lang, t } from './i18n.js'
import { EN } from './levels.en.js'
import vimLevels from './levels/vim-levels.json' with { type: 'json' }

export const chapters = [
  { id: 'move', title: '1. 이동', difficulty: 'beginner' },
  { id: 'edit', title: '2. 편집', difficulty: 'beginner' },
  { id: 'object', title: '3. 텍스트 오브젝트', difficulty: 'intermediate' },
  { id: 'power', title: '4. 비주얼 · 매크로', difficulty: 'intermediate' },
  { id: 'real', title: '5. 실전: AI 코드 다듬기', difficulty: 'advanced' },
  { id: 'tmux', title: '6. tmux: AI 터미널 필수 키', difficulty: 'advanced' },
  { id: 'guru', title: '7. 구루: 상황별 콤보', difficulty: 'guru' },
]

const DIFFICULTIES = {
  beginner: ['초보', 'Beginner'],
  intermediate: ['중급', 'Intermediate'],
  advanced: ['고급', 'Advanced'],
  guru: ['구루', 'Guru'],
}

export function difficultyLabel(difficulty) {
  const [ko, en] = DIFFICULTIES[difficulty]
  return t(ko, en)
}

export function difficultyText(difficulty) {
  return t(`난이도: ${difficultyLabel(difficulty)}`, `Difficulty: ${difficultyLabel(difficulty)}`)
}

// Vim 레벨은 데이터 파일(src/levels/vim-levels.json, 스키마: src/levels/schema.js). 여기는 tmux 레벨만
const tmuxLevels = [
  // ── 6. tmux ── (kind: 'tmux' → 터미널 시뮬레이터. init() 이 초기 상태, checks 가 모두 참이면 클리어)
  {
    id: 'tmux-new', chapter: 'tmux', kind: 'tmux', title: '세션 만들기 tmux new',
    desc: 'AI 에이전트는 오래 돕니다. 터미널 창이 닫혀도 살아 있게 <b>tmux 세션</b> 안에서 돌리세요. <code>tmux new -s agent</code> 를 입력하고 Enter.',
    keys: ['tmux new -s 이름', 'tmux ls'],
    init: () => ({ outer: [t('# 에이전트를 돌릴 세션을 만들어 봅시다', '# Create a session to run your agent in')] }),
    checks: [{ label: '<code>agent</code> 세션에 들어가기', test: (s) => s.attached === 'agent' }],
    solution: 'tmux new -s agent<CR>',
  },
  {
    id: 'tmux-split', chapter: 'tmux', kind: 'tmux', title: '화면 나누기 C-b % 와 C-b "',
    desc: 'tmux 키는 모두 <b>prefix</b> <kbd>Ctrl-b</kbd> 를 먼저 누르고 손을 뗀 뒤 다음 키를 누릅니다. <b>C-b %</b> 좌우 분할, <b>C-b "</b> 위아래 분할. 왼쪽엔 에이전트, 오른쪽엔 쉘 두 개를 만드세요.',
    keys: ['C-b %', 'C-b "'],
    init: () => ({ attached: 'agent', sessions: [{ name: 'agent', windows: [{ panes: [{ program: 'claude', lines: AGENT_LOG }] }] }] }),
    checks: [{ label: '에이전트 | 쉘 위아래 두 개 레이아웃', test: (s) => !!s.attached && shape(win(s).layout) === 'h(p,v(p,p))' }],
    solution: '<C-b>%<C-b>"',
  },
  {
    id: 'tmux-nav', chapter: 'tmux', kind: 'tmux', title: 'pane 이동 C-b 방향키',
    desc: '<b>C-b ←↑↓→</b> 로 옆 pane 으로 이동합니다. <b>C-b o</b> 는 다음 pane, <b>C-b ;</b> 는 직전 pane, <b>C-b q</b> 는 번호를 띄워 숫자로 이동. 에이전트 pane 으로 가세요.',
    keys: ['C-b ←↑↓→', 'C-b o', 'C-b ;', 'C-b q'],
    init: () => ({ attached: 'agent', sessions: [{ name: 'agent', windows: [{ split: 'hv', active: 2, panes: [{ program: 'claude', lines: AGENT_LOG }, {}, {}] }] }] }),
    checks: [{ label: '에이전트 pane 이 활성', test: (s) => !!s.attached && pane(s).program === 'claude' }],
    solution: '<C-b><Left>',
  },
  {
    id: 'tmux-zoom', chapter: 'tmux', kind: 'tmux', title: '크게 보기 C-b z',
    desc: '좁은 pane 에서 에이전트 출력을 읽기 힘들 때 <b>C-b z</b> 로 그 pane 만 화면 전체로 키웁니다. 한 번 더 누르면 원래대로. 에이전트 pane 으로 가서 zoom 하세요.',
    keys: ['C-b z'],
    init: () => ({ attached: 'agent', sessions: [{ name: 'agent', windows: [{ split: 'hv', active: 2, panes: [{ program: 'claude', lines: AGENT_LOG }, {}, {}] }] }] }),
    checks: [
      { label: '에이전트 pane 이 활성', test: (s) => !!s.attached && pane(s).program === 'claude' },
      { label: 'zoom 상태 (상태줄에 Z)', test: (s) => !!s.attached && win(s).zoomed },
    ],
    solution: '<C-b><Left><C-b>z',
  },
  {
    id: 'tmux-scroll', chapter: 'tmux', kind: 'tmux', title: '출력 위로 올려보기 C-b [',
    desc: 'tmux 안에서는 마우스 휠 스크롤이 기본으로 안 됩니다. <b>C-b [</b> 로 <b>copy mode</b> 에 들어가면 vim 키로 출력을 돌아다닐 수 있어요: <b>k j</b>, <b>C-u C-d</b>, <b>g</b> 맨 위, <b>G</b> 맨 아래, <b>q</b> 나가기. 에이전트 출력 맨 위로 가세요.',
    keys: ['C-b [', 'g', 'G', 'C-u', 'C-d', 'q'],
    init: () => ({ attached: 'agent', sessions: [{ name: 'agent', windows: [{ split: 'h', active: 0, panes: [{ program: 'claude', lines: AGENT_LOG }, {}] }] }] }),
    checks: [{ label: '에이전트 pane 의 copy mode 에서 첫 줄에 커서', test: (s) => !!s.attached && pane(s).program === 'claude' && pane(s).copy?.line === 0 }],
    solution: '<C-b>[g',
  },
  {
    id: 'tmux-copy', chapter: 'tmux', kind: 'tmux', title: '에러 복사해서 옆 쉘에 붙여넣기',
    desc: '에이전트가 뱉은 에러를 직접 검색해 보려면 복사가 필요합니다. <b>C-b [</b> → <b>?Error</b> Enter (위로 검색) → <b>Space</b> 선택 시작 → <b>$</b> 줄 끝 → <b>Enter</b> 복사. 오른쪽 쉘로 가서 <b>C-b ]</b> 로 붙여넣으세요. (<code>v</code>/<code>y</code> 도 됩니다. 많이 쓰는 .tmux.conf 설정)',
    keys: ['C-b [', '?', '/', 'Space', '$', 'Enter', 'C-b ]'],
    init: () => ({ attached: 'agent', sessions: [{ name: 'agent', windows: [{ split: 'h', active: 0, panes: [{ program: 'claude', lines: AGENT_LOG }, {}] }] }] }),
    checks: [{ label: "오른쪽 쉘 입력줄에 <code>Cannot find module 'zod'</code>", test: (s) => Object.values(s.panes).some((p) => p.program === 'zsh' && p.input.includes("Cannot find module 'zod'")) }],
    solution: '<C-b>[?Error<CR> $<CR><C-b><Right><C-b>]',
  },
  {
    id: 'tmux-window', chapter: 'tmux', kind: 'tmux', title: '윈도우 = 탭 C-b c, C-b ,',
    desc: 'pane 이 너무 많아지면 <b>윈도우</b>(탭)를 추가합니다. <b>C-b c</b> 새 윈도우, <b>C-b ,</b> 이름 바꾸기 (기존 이름은 <b>C-u</b> 로 지우기). 테스트용 윈도우 <code>test</code> 를 만드세요.',
    keys: ['C-b c', 'C-b ,', 'C-u', 'C-b n', 'C-b p'],
    init: () => ({ attached: 'agent', sessions: [{ name: 'agent', windows: [{ panes: [{ program: 'claude', lines: AGENT_LOG }] }] }] }),
    checks: [
      { label: '윈도우 2개', test: (s) => !!s.attached && session(s).windows.length === 2 },
      { label: '현재 윈도우 이름이 <code>test</code>', test: (s) => !!s.attached && win(s).renamed && win(s).name === 'test' },
    ],
    solution: '<C-b>c<C-b>,<C-u>test<CR>',
  },
  {
    id: 'tmux-window-jump', chapter: 'tmux', kind: 'tmux', title: '번호로 윈도우 점프 C-b 0~9',
    desc: '상태줄의 <code>0:claude 1:nvim 2:test</code> 숫자가 윈도우 번호입니다. <b>C-b 0</b> 처럼 바로 갈 수 있어요. 에이전트가 있는 0번으로 가세요.',
    keys: ['C-b 0~9', 'C-b n', 'C-b p'],
    init: () => ({ attached: 'agent', sessions: [{ name: 'agent', activeWindow: 2, windows: [
      { panes: [{ program: 'claude', lines: AGENT_LOG }] },
      { name: 'nvim', panes: [{ lines: ['$ nvim src/config.ts'] }] },
      { name: 'test', panes: [{ lines: ['$ npm test', 'FAIL  src/config.test.ts', "Error: Cannot find module 'zod'"] }] },
    ] }] }),
    checks: [{ label: '0번 윈도우', test: (s) => !!s.attached && session(s).active === 0 }],
    solution: '<C-b>0',
  },
  {
    id: 'tmux-detach', chapter: 'tmux', kind: 'tmux', title: 'detach 하고 다시 붙기',
    desc: '<b>C-b d</b> 로 빠져나와도(detach) 세션 안의 에이전트는 계속 일합니다. SSH 가 끊겨도 마찬가지. <code>tmux a</code> (또는 <code>tmux a -t agent</code>) 로 다시 붙으세요.',
    keys: ['C-b d', 'tmux a', 'tmux ls'],
    init: () => ({ attached: 'agent', sessions: [{ name: 'agent', windows: [{ panes: [{ program: 'claude', lines: AGENT_LOG }] }] }] }),
    checks: [
      { label: 'detach 하기', test: (s) => s.flags.detachedOnce },
      { label: '다시 <code>agent</code> 에 attach', test: (s) => s.flags.detachedOnce && s.attached === 'agent' },
    ],
    solution: '<C-b>dtmux a<CR>',
  },
  {
    id: 'tmux-session', chapter: 'tmux', kind: 'tmux', title: '세션 전환 C-b s · C-b ( )',
    desc: '프로젝트마다 세션을 따로 두면 에이전트 여러 개를 나란히 돌릴 수 있습니다. <b>C-b s</b> 목록에서 고르거나, <b>C-b )</b> 다음 · <b>C-b (</b> 이전 세션. <code>blog</code> 세션으로 가세요.',
    keys: ['C-b s', 'C-b (', 'C-b )'],
    init: () => ({ attached: 'agent', sessions: [
      { name: 'agent', windows: [{ panes: [{ program: 'claude', lines: AGENT_LOG }] }] },
      { name: 'blog', windows: [{ panes: [{ lines: ['$ npm run dev', '  ➜  Local:   http://localhost:5173/'] }] }] },
    ] }),
    checks: [{ label: '<code>blog</code> 세션', test: (s) => s.attached === 'blog' }],
    solution: '<C-b>)',
  },
  {
    id: 'tmux-kill', chapter: 'tmux', kind: 'tmux', title: 'pane 닫기 C-b x',
    desc: '다 쓴 pane 은 <b>C-b x</b> 후 <b>y</b> 로 닫습니다 (쉘에서 <code>exit</code> 도 됩니다). 오른쪽 아래 pane 을 닫으세요.',
    keys: ['C-b x', 'y', 'exit', 'C-b &'],
    init: () => ({ attached: 'agent', sessions: [{ name: 'agent', windows: [{ split: 'hv', active: 2, panes: [{ program: 'claude', lines: AGENT_LOG }, {}, {}] }] }] }),
    checks: [
      { label: 'pane 2개', test: (s) => !!s.attached && paneIds(win(s).layout).length === 2 },
      { label: '에이전트 pane 은 살아 있음', test: (s) => Object.values(s.panes).some((p) => p.program === 'claude') },
    ],
    solution: '<C-b>xy',
  },
  {
    id: 'tmux-boss', chapter: 'tmux', kind: 'tmux', title: '보스: 에이전트 작업판 세팅',
    desc: '처음부터 혼자: <code>work</code> 세션을 만들고, 거기서 에이전트를 실행(<code>claude</code>)한 뒤, 오른쪽에 쉘 pane 을 띄워 그쪽에 커서를 두세요.',
    keys: ['tmux new -s', 'claude', 'C-b %'],
    init: () => ({ outer: [t('# 출근했습니다. 작업판을 세팅하세요', '# Morning! Set up your workspace')] }),
    checks: [
      { label: '<code>work</code> 세션', test: (s) => s.attached === 'work' },
      { label: '왼쪽 pane 에서 에이전트 실행 중', test: (s) => s.attached === 'work' && shape(win(s).layout) === 'h(p,p)' && s.panes[paneIds(win(s).layout)[0]].program === 'claude' },
      { label: '오른쪽 쉘 pane 이 활성', test: (s) => s.attached === 'work' && win(s).active === paneIds(win(s).layout)[1] },
    ],
    solution: 'tmux new -s work<CR>claude<CR><C-b>%',
  },
]

// 챕터 순서대로 합침 (sort 는 안정 정렬이라 챕터 안의 순서는 그대로)
const chapterOrder = chapters.map((c) => c.id)
export const levels = [...vimLevels, ...tmuxLevels].sort((a, b) => chapterOrder.indexOf(a.chapter) - chapterOrder.indexOf(b.chapter))


// 영어: 같은 id 의 필드를 levels.en.js 값으로 바꿈 (checks 는 라벨만)
if (lang === 'en') {
  for (const c of chapters) c.title = EN.chapters[c.id] ?? c.title
  for (const l of levels) {
    const { checks, ...rest } = EN.levels[l.id] ?? {}
    Object.assign(l, rest)
    if (checks) l.checks = l.checks.map((c, i) => ({ ...c, label: checks[i] ?? c.label }))
  }
}

// '<Esc>jj' → ['<Esc>', 'j', 'j']
export function tokenize(keys) {
  return keys.match(/<[^>]+>|./gs) ?? []
}

export function stars(count, par) {
  if (count <= par) return 3
  if (count <= Math.ceil(par * 1.5)) return 2
  return 1
}
