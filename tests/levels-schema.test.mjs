// vim-levels.json 스키마 검사 + 일부러 깨뜨린 fixture 가 읽기 쉬운 에러를 내는지
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateLevels } from '../src/levels/schema.js'

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))

test('src/levels/vim-levels.json 이 스키마를 지킴', () => {
  const errors = validateLevels(load('../src/levels/vim-levels.json'))
  assert.deepEqual(errors, [], `\n${errors.join('\n')}`)
})

test('깨진 레벨은 레벨 id 와 무엇이 틀렸는지 알려줌', () => {
  assert.deepEqual(validateLevels(load('./fixtures/broken-vim-levels.json')), [
    '레벨 hjkl: 모르는 필드 "par" (허용: id, chapter, title, desc, keys, lang, start, cursor, goal, solution)',
    '레벨 hjkl: id 가 중복됩니다',
    '레벨 hjkl: chapter 는 move | edit | object | power | real | guru 중 하나여야 합니다 (지금: "moves")',
    '레벨 hjkl: title 는 빈 문자열이 아닌 문자열이어야 합니다',
    '레벨 hjkl: cursor [5,0] 가 start 버퍼 밖입니다',
    '레벨 hjkl: goal 은 {"text": ...} 또는 {"cursor": [줄, 칸]} 하나여야 합니다 (지금: {"txt":"abc"})',
  ])
})
