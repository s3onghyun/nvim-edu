// vim-levels.json 스키마 검사 + 일부러 깨뜨린 fixture 가 읽기 쉬운 에러를 내는지
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateLevels, validateMarkup } from '../src/levels/schema.js'
import { chapters, levels } from '../src/levels.js'
import { EN } from '../src/levels.en.js'
import { ZH_CN } from '../src/levels.zh-CN.js'

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

// title · desc · 체크 라벨은 innerHTML 로 들어가므로 허용 태그(<b> <code> <em> <kbd>, 속성 없이)만
test('번역(EN · ZH_CN)과 tmux 레벨도 허용된 HTML 만 씀', () => {
  const errors = [
    ...validateMarkup('en', EN),
    ...validateMarkup('zh-CN', ZH_CN),
    ...validateMarkup('ko', { chapters: Object.fromEntries(chapters.map((c) => [c.id, c.title])), levels: levels.filter((l) => l.kind === 'tmux') }),
  ]
  assert.deepEqual(errors, [], `\n${errors.join('\n')}`)
})

test('허용되지 않은 HTML 은 레벨 id 와 문제가 된 부분을 알려줌', () => {
  const allowed = '허용: <b> <code> <em> <kbd>, 속성 없이'
  assert.deepEqual(validateLevels(load('./fixtures/broken-markup-levels.json')), [
    `레벨 markup: title 에 쓸 수 없는 HTML: <a href="javascript:alert(1)"> </a> javascript: (${allowed})`,
    `레벨 markup: desc 에 쓸 수 없는 HTML: <img src=x onerror=alert(1)> onerror= (${allowed})`,
  ])
  assert.deepEqual(validateMarkup('en', {
    chapters: { move: '<script>alert(1)</script>Motions' },
    levels: { hjkl: { desc: 'Use <b>h</b> <kbd>Esc</kbd>', checks: ['<span onclick=alert(1)>ok</span>'] } },
  }), [
    `en 챕터 move: title 에 쓸 수 없는 HTML: <script> </script> (${allowed})`,
    `en 레벨 hjkl: checks[0] 에 쓸 수 없는 HTML: <span onclick=alert(1)> </span> onclick= (${allowed})`,
  ])
  assert.deepEqual(validateMarkup('ko', { levels: [{ id: 'tmux-x', title: 't', desc: 'd', checks: [{ label: '<em>ok</em>' }, { label: '<svg/onload=alert(1)>' }] }] }), [
    `ko 레벨 tmux-x: checks[1] 에 쓸 수 없는 HTML: <svg/onload=alert(1)> onload= (${allowed})`,
  ])
})
