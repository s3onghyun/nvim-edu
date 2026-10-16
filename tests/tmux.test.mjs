// tmux 상태 머신 단위 테스트 (node --test)
import test from 'node:test'
import assert from 'node:assert/strict'
import { createTmux, press, win, pane, session, shape, paneIds, AGENT_LOG } from '../src/tmux.js'

const type = (s, keys) => { for (const k of keys) press(s, k) }
const line = (s, text) => { type(s, [...text]); press(s, 'Enter') }

test('세션 생성 → split → 방향 이동 → kill', () => {
  const s = createTmux()
  line(s, 'tmux new -s agent')
  assert.equal(s.attached, 'agent')
  type(s, ['C-b', '%', 'C-b', '"'])
  assert.equal(shape(win(s).layout), 'h(p,v(p,p))')
  const [left, top, bottom] = paneIds(win(s).layout)
  assert.equal(win(s).active, bottom)
  type(s, ['C-b', 'Up']); assert.equal(win(s).active, top)
  type(s, ['C-b', 'Left']); assert.equal(win(s).active, left)
  type(s, ['C-b', 'Right']); assert.equal(win(s).active, top)
  type(s, ['C-b', 'x', 'y'])
  assert.equal(shape(win(s).layout), 'h(p,p)')
})

test('zoom 은 pane 이동 시 해제', () => {
  const s = createTmux()
  line(s, 'tmux')
  type(s, ['C-b', '%', 'C-b', 'z'])
  assert.equal(win(s).zoomed, true)
  type(s, ['C-b', 'o'])
  assert.equal(win(s).zoomed, false)
})

test('copy mode: 위로 검색 → 줄 끝까지 선택 → 복사 → 다른 pane 에 붙여넣기', () => {
  const s = createTmux({ attached: 'a', sessions: [{ name: 'a', windows: [{ split: 'h', active: 0, panes: [{ program: 'claude', lines: AGENT_LOG }, {}] }] }] })
  type(s, ['C-b', '[', '?', ...'Error', 'Enter', ' ', '$', 'Enter'])
  assert.equal(s.buffer, "Error: Cannot find module 'zod'")
  type(s, ['C-b', 'Right', 'C-b', ']'])
  assert.equal(pane(s).input, "Error: Cannot find module 'zod'")
})

test('detach / attach / 중첩 방지 / 세션 선택', () => {
  const s = createTmux()
  line(s, 'tmux new -s agent')
  line(s, 'tmux new -s x')
  assert.match(pane(s).lines.at(-1), /nested/)
  type(s, ['C-b', 'd'])
  assert.equal(s.attached, null)
  line(s, 'tmux new -s blog')
  type(s, ['C-b', 'd'])
  line(s, 'tmux a -t agent')
  assert.equal(s.attached, 'agent')
  type(s, ['C-b', 's', 'j', 'Enter'])
  assert.equal(session(s).name, 'blog')
})

test('윈도우: 새로 만들기, 이름 바꾸기, 번호 이동, 마지막 pane exit 시 윈도우 닫힘', () => {
  const s = createTmux()
  line(s, 'tmux')
  type(s, ['C-b', 'c', 'C-b', ',', 'C-u', ...'test', 'Enter'])
  assert.equal(win(s).name, 'test')
  type(s, ['C-b', '0'])
  assert.equal(session(s).active, 0)
  line(s, 'exit')
  assert.equal(session(s).windows.length, 1)
  line(s, 'exit')
  assert.equal(s.attached, null)
})

test('tmux kill-session: 대상 생략은 기본 세션, 세션이 없으면 서버 없음 안내', () => {
  const s = createTmux()
  line(s, 'tmux kill-session')
  assert.equal(s.outer.lines.at(-1), 'no server running on /tmp/tmux-1000/default')
  line(s, 'tmux new -s agent')
  assert.equal(s.attached, 'agent')
  line(s, 'tmux kill-session')
  assert.equal(s.attached, null)
  assert.deepEqual(s.sessions, [])
  assert.equal(s.outer.lines.at(-1), '[exited]')
  line(s, 'tmux a')
  assert.equal(pane(s).lines.at(-1), 'no sessions')
})

test('tmux kill-session 이후에도 대상 없는 attach 이 남아 있는 세션을 찾는다', () => {
  const t = createTmux({ attached: 'agent', sessions: [
    { name: 'agent', windows: [{ panes: [{ program: 'claude', lines: AGENT_LOG }] }] },
    { name: 'blog', windows: [{ panes: [{}] }] },
  ] })
  type(t, ['C-b', 'd'])
  line(t, 'tmux kill-session -t agent')
  assert.deepEqual(t.sessions.map((x) => x.name), ['blog'])
  line(t, 'tmux a')
  assert.equal(t.attached, 'blog')
  line(t, 'tmux kill-session -t nosuch')
  assert.equal(pane(t).lines.at(-1), "can't find session: nosuch")
})

test('모든 tmux 레벨: 시작 상태는 미완료, 모범 답안으로 완료', async () => {
  const { levels, tokenize } = await import('../src/levels.js')
  const KEY = { '<C-b>': 'C-b', '<CR>': 'Enter', '<Esc>': 'Escape', '<C-u>': 'C-u', '<Left>': 'Left', '<Right>': 'Right', '<Up>': 'Up', '<Down>': 'Down' }
  for (const l of levels.filter((x) => x.kind === 'tmux')) {
    const s = createTmux(l.init())
    assert.ok(!l.checks.every((c) => c.test(s)), `${l.id} 이 시작부터 클리어됨`)
    for (const t of tokenize(l.solution)) press(s, KEY[t] ?? t)
    assert.ok(l.checks.every((c) => c.test(s)), `${l.id} 답안 실패`)
  }
})
