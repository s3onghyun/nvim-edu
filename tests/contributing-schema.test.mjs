// CONTRIBUTING.md 의 레벨 필드 표가 src/levels/schema.js 와 어긋나지 않는지 확인
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FIELDS, VIM_CHAPTERS } from '../src/levels/schema.js'

const OPTIONAL = ['lang']
const md = readFileSync(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8')

// 첫 칸이 백틱 필드명인 표 행을 연속 블록 단위로 모은다
function tables() {
  const out = []
  let cur = null
  for (const line of md.split('\n')) {
    const cells = line.trim().startsWith('|') ? line.trim().slice(1, -1).split(/(?<!\\)\|/).map(s => s.trim()) : null
    if (cells && /^`[a-z]+`(, `[a-z]+`)*$/.test(cells[0])) {
      if (!cur) out.push(cur = [])
      for (const name of cells[0].match(/[a-z]+/g)) cur.push({ name, required: cells[1] === '✓', cells })
    } else if (!cells || !/^-+$/.test(cells[0]) && !/필드|Field/.test(cells[0])) cur = null
  }
  return out
}

const sections = tables()

test('CONTRIBUTING 에 한국어·영어 필드 표가 하나씩 있다', () => {
  assert.equal(sections.length, 2, `필드 표 ${sections.length}개 발견 (기대: 2)`)
})

for (const [i, label] of ['Korean', 'English'].entries()) {
  test(`${label} 필드 표가 schema.js 와 일치`, () => {
    const rows = sections[i] ?? []
    const names = rows.map(r => r.name)
    const missing = FIELDS.filter(f => !names.includes(f))
    const extra = names.filter(f => !FIELDS.includes(f))
    assert.deepEqual(missing, [], `${label} section missing fields: ${missing.join(', ')}`)
    assert.deepEqual(extra, [], `${label} section extra fields: ${extra.join(', ')}`)
    for (const r of rows) {
      assert.equal(r.required, !OPTIONAL.includes(r.name), `${label} section: required mark wrong for "${r.name}"`)
    }
    const chapter = rows.find(r => r.name === 'chapter')
    const listed = chapter.cells[2].match(/`[a-z]+`/g).map(s => s.slice(1, -1))
    assert.deepEqual(listed, VIM_CHAPTERS, `${label} section: chapter row lists ${listed.join(', ')}`)
  })
}
