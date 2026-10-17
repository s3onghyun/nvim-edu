import { t as tr } from './i18n.js'

// 미션(반복 드릴): 같은 종류의 과제를 랜덤으로 N번 연속 → 단축키를 손에 익히기
// 각 라운드는 레벨과 같은 모양 { start, cursor, goal, marks, desc, solution }을 만든다.
// solution 은 "확실히 되는 한 가지 방법"(e2e 검증용)이지 최적 답이 아니다.

const SNIPPETS = [
  { lang: 'js', text: `import { readFile } from "fs/promises";

export async function loadConfig(path) {
  const raw = await readFile(path, "utf8");
  const config = JSON.parse(raw);
  if (!config.port) {
    throw new Error("port is required");
  }
  return { host: config.host, port: config.port };
}

export function buildUrl(config) {
  return "http://" + config.host + ":" + config.port;
}` },
  { lang: 'py', text: `import json

def load_users(path):
    with open(path, "r") as f:
        users = json.load(f)
    return [u for u in users if u["active"]]

def find_admin(users):
    for user in users:
        if user["role"] == "admin":
            return user
    return None

print(find_admin(load_users("users.json")))` },
  { lang: 'yaml', text: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-server
  labels:
    app: "web"
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: nginx
          image: "nginx:1.27"
          ports:
            - containerPort: 8080` },
]

const NEW_WORDS = ['value', 'result', 'target', 'payload', 'options', 'record', 'handler', 'buffer']

// 오늘의 미션은 날짜 시드로 모두 같은 문제
export function rngFrom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
// 로컬 날짜 YYYY-MM-DD (UTC면 한국은 오전 9시에 날짜가 바뀜)
export const ymd = (d) => d.toLocaleDateString('sv-SE')
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]

function lineCol(text, offset) {
  const before = text.slice(0, offset).split('\n')
  return [before.length - 1, before.at(-1).length]
}
// 확실히 그 위치로 가는 키: :{줄}<CR>0{열}l
function goTo(text, offset) {
  const [line, col] = lineCol(text, offset)
  return `:${line + 1}<CR>0${col ? `${col}l` : ''}`
}
function matches(text, re) {
  return [...text.matchAll(re)].map((m) => ({ from: m.index, to: m.index + m[0].length, str: m[0] }))
}

const ROUNDS = {
  move(rng, text, cursor) {
    const spots = matches(text, /\S/g).filter((m) => m.from !== cursor)
    const t = pick(rng, spots)
    return {
      desc: tr('초록 칸으로 이동하세요. <b>w b e</b> · <b>f t</b> · <b>gg G</b> · <b>{n}j</b> · <b>/검색</b> 무엇이든.', 'Move to the green cell. <b>w b e</b> · <b>f t</b> · <b>gg G</b> · <b>{n}j</b> · <b>/search</b>, anything goes.', '移到绿色格子。<b>w b e</b> · <b>f t</b> · <b>gg G</b> · <b>{n}j</b> · <b>/搜索</b>，怎么走都行。'),
      goal: { cursor: t.from }, marks: [{ from: t.from, to: t.to, cls: 'cm-target' }],
      solution: goTo(text, t.from),
    }
  },
  deleteLine(rng, text) {
    const lines = text.split('\n')
    const i = pick(rng, lines.map((l, i) => (l.trim() ? i : -1)).filter((i) => i >= 0))
    const from = lines.slice(0, i).join('\n').length + (i ? 1 : 0)
    return {
      desc: tr('빨간 줄을 지우세요. <b>{n}j</b> / <b>{n}k</b> 로 가서 <b>dd</b>.', 'Delete the red line. Get there with <b>{n}j</b> / <b>{n}k</b>, then <b>dd</b>.', '删掉红色的那一行。用 <b>{n}j</b> / <b>{n}k</b> 过去，再按 <b>dd</b>。'),
      goal: { text: lines.filter((_, j) => j !== i).join('\n') },
      marks: [{ from, to: from + lines[i].length, cls: 'cm-del' }],
      solution: `:${i + 1}<CR>dd`,
    }
  },
  deleteWord(rng, text) {
    const w = pick(rng, matches(text, /\b[A-Za-z_]\w{2,}\b/g))
    const rest = text.slice(w.to)
    return {
      desc: tr('빨간 단어를 지우세요. <b>diw</b> 또는 <b>dw</b>.', 'Delete the red word. <b>diw</b> or <b>dw</b>.', '删掉红色的单词。<b>diw</b> 或 <b>dw</b>。'),
      // dw 는 뒤 공백까지 지우므로 둘 다 인정
      goal: { text: [text.slice(0, w.from) + rest, text.slice(0, w.from) + rest.replace(/^[ \t]+/, '')] },
      marks: [{ from: w.from, to: w.to, cls: 'cm-del' }],
      solution: goTo(text, w.from) + 'diw',
    }
  },
  changeWord(rng, text) {
    const w = pick(rng, matches(text, /\b[A-Za-z_]\w{2,}\b/g))
    const next = pick(rng, NEW_WORDS.filter((n) => n !== w.str))
    return {
      desc: tr(`노란 단어 <code>${w.str}</code> 를 <code>${next}</code> 로 바꾸세요. <b>ciw</b> 또는 <b>cw</b> → 입력 → <b>Esc</b>.`, `Change the yellow word <code>${w.str}</code> to <code>${next}</code>. <b>ciw</b> or <b>cw</b> → type → <b>Esc</b>.`, `把黄色单词 <code>${w.str}</code> 改成 <code>${next}</code>。<b>ciw</b> 或 <b>cw</b> → 输入 → <b>Esc</b>。`),
      goal: { text: text.slice(0, w.from) + next + text.slice(w.to) },
      marks: [{ from: w.from, to: w.to, cls: 'cm-change' }],
      solution: goTo(text, w.from) + `ciw${next}<Esc>`,
    }
  },
  deleteInside(rng, text) {
    const m = pick(rng, [...matches(text, /"[^"\n]+"/g), ...matches(text, /\([^()\n]+\)/g)])
    const open = m.str[0]
    return {
      desc: tr(`${open === '"' ? '따옴표' : '괄호'} 안을 비우세요. <b>di${open}</b> (커서가 안쪽이나 여는 기호 위에 있어야 함).`, `Empty the ${open === '"' ? 'quotes' : 'parentheses'}. <b>di${open}</b> (cursor inside or on the opening character).`, `清空${open === '"' ? '引号' : '括号'}里的内容。<b>di${open}</b>（光标要在里面，或在开头的符号上）。`),
      goal: { text: text.slice(0, m.from + 1) + text.slice(m.to - 1) },
      marks: [{ from: m.from + 1, to: m.to - 1, cls: 'cm-del' }],
      solution: goTo(text, m.from) + `di${open}`,
    }
  },
}

export const missions = [
  { id: 'mission-move', title: tr('이동 미션', 'Motion drill', '移动练习'), kinds: ['move'], keys: ['w', 'b', 'e', 'f', 't', 'gg', 'G', '/'] },
  { id: 'mission-delete', title: tr('삭제 미션', 'Delete drill', '删除练习'), kinds: ['deleteLine', 'deleteWord', 'deleteInside'], keys: ['dd', 'diw', 'dw', 'di"', 'di('] },
  { id: 'mission-change', title: tr('변경 미션', 'Change drill', '修改练习'), kinds: ['changeWord'], keys: ['ciw', 'cw', 'Esc'] },
  { id: 'mission-tmux', title: tr('tmux 미션', 'tmux drill', 'tmux 练习'), tmux: true, kinds: [], keys: ['C-b %', 'C-b "', 'C-b ←↑↓→', 'C-b z', 'C-b c', 'C-b 0~9'] },
  { id: 'mission-daily', title: tr('오늘의 미션', 'Daily challenge', '每日挑战'), kinds: Object.keys(ROUNDS), keys: [tr('전부', 'everything', '全部')], daily: true },
]

export function createSession(mission, today = new Date()) {
  const seed = mission.daily ? Number(ymd(today).replaceAll('-', '')) : Date.now()
  const rng = rngFrom(seed)
  const snippet = pick(rng, SNIPPETS)
  return {
    mission, total: 10, round: 0, keys: 0, t0: null, cursor: 0, snippet,
    next() {
      const r = ROUNDS[pick(rng, mission.kinds)](rng, snippet.text, this.cursor)
      return { ...r, start: snippet.text, lang: snippet.lang, cursor: this.cursor }
    },
  }
}

// 오늘 날짜 기준 연속 일수
export function streak(days, today = new Date()) {
  const set = new Set(days)
  let n = 0
  for (const d = new Date(today); set.has(ymd(d)); d.setDate(d.getDate() - 1)) n++
  return n
}
