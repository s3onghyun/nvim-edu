// 풀이가 틀린 레벨(fixture)이 CI 에 레벨 id·검사 이름·기대/실제 버퍼·커서를 남기는지
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateLevels } from '../src/levels/schema.js'
import { tokenize } from '../src/levels.js'
import { solveReport } from './level-report.mjs'

// 스키마는 통과하지만 solution 이 한 글자를 더 지움 (lxx → "hllo")
const level = JSON.parse(readFileSync(new URL('./fixtures/broken-solution-level.json', import.meta.url), 'utf8'))
const tokens = tokenize(level.solution)

test('fixture 는 스키마를 통과 (런타임 검사에서만 잡힘)', () => assert.deepEqual(validateLevels([level]), []))

test('클리어 안 됨 → 기대/실제 버퍼와 모드', () => {
  assert.equal(solveReport('에뮬레이터 풀이', level, tokens, { done: false, count: 3, text: 'hllo', cursor: [0, 1], mode: 'i' }), [
    'FAIL 레벨 x-delete [에뮬레이터 풀이]',
    '  solution: "lxx" (3키)',
    '  모범 답안을 끝까지 쳐도 클리어되지 않습니다',
    '  기대 버퍼: "hello"',
    '  실제 버퍼: "hllo"',
    '  모드: 지금 "i" — NORMAL 모드여야 클리어됩니다 (<Esc> 빠짐?)',
  ].join('\n'))
})

test('커서 목표 레벨 → 기대/실제 커서', () => {
  const move = { ...level, goal: { cursor: [0, 4] } }
  assert.match(solveReport('진짜 Vim(vim.wasm) 풀이', move, tokens, { done: false, count: 3, text: 'heello', cursor: [0, 3], mode: 'n' }),
    /\[진짜 Vim\(vim\.wasm\) 풀이\][\s\S]*기대 커서: \[0,4\]\n {2}실제 커서: \[0,3\]$/)
})

test('중간에 클리어 → par/별', () => {
  assert.match(solveReport('에뮬레이터 풀이', level, tokens, { done: true, count: 2, text: 'hello', cursor: [0, 1], mode: 'n' }),
    /par\/별: 클리어 타수 2 ≠ par 3/)
})

test('통과면 빈 문자열', () => {
  assert.equal(solveReport('에뮬레이터 풀이', level, tokens, { done: true, count: 3, text: 'hello', cursor: [0, 1], mode: 'n' }), '')
})
