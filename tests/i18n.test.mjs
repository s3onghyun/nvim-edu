// 언어 감지 표 · t() 의 중국어 → 영어 대체 · levels.zh-CN.js 가 levels.en.js 와 짝이 맞는지
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLang, normalizeLang, translate } from '../src/i18n.js'
import { EN } from '../src/levels.en.js'
import { ZH_CN } from '../src/levels.zh-CN.js'
import { levels, chapters } from '../src/levels.js'

test('브라우저 언어 → 화면 언어 (중국어는 지역과 상관없이 간체)', () => {
  const table = { ko: 'ko', 'ko-KR': 'ko', 'en-US': 'en', zh: 'zh-CN', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-CN', 'zh-HK': 'zh-CN', 'zh-Hant-TW': 'zh-CN', ja: 'en', '': 'en', undefined: 'en' }
  for (const [browser, want] of Object.entries(table)) assert.equal(detectLang(browser === 'undefined' ? undefined : browser), want, browser)
})

test('?lang= · 저장값: zh 는 zh-CN 의 별칭, 모르는 값은 무시', () => {
  const table = { ko: 'ko', en: 'en', 'zh-CN': 'zh-CN', 'zh-cn': 'zh-CN', zh: 'zh-CN', 'zh-TW': null, ja: null, '': null, EN: null }
  for (const [param, want] of Object.entries(table)) assert.equal(normalizeLang(param), want, param)
  assert.equal(normalizeLang(null), null)
})

test('t(ko, en, zh): 한국어·영어는 그대로, 중국어가 없으면 영어 (한국어 아님)', () => {
  assert.equal(translate('ko', '가', 'a', '甲'), '가')
  assert.equal(translate('en', '가', 'a', '甲'), 'a')
  assert.equal(translate('zh-CN', '가', 'a', '甲'), '甲')
  assert.equal(translate('zh-CN', '가', 'a'), 'a')
  assert.equal(translate('ko', '가', 'a'), '가')
  assert.equal(translate('en', '가', 'a'), 'a')
})

const codes = (html = '') => [...html.matchAll(/<(code|kbd)>(.*?)<\/\1>/g)].map((m) => m[0]).sort()
const HANGUL = /[ㄱ-ㅎㅏ-ㅣ가-힣]/

test('levels.zh-CN.js: 영어로 번역된 챕터·레벨마다 중국어가 있고 모양이 같음', () => {
  assert.deepEqual(Object.keys(ZH_CN.chapters).sort(), chapters.map((c) => c.id).sort())
  assert.deepEqual(Object.keys(ZH_CN.levels).sort(), Object.keys(EN.levels).sort())
  const ids = new Set(levels.map((l) => l.id))
  for (const [id, zh] of Object.entries(ZH_CN.levels)) {
    const en = EN.levels[id]
    assert.ok(ids.has(id), `${id}: 없는 레벨`)
    // 연습 텍스트(start/goal/cursor)는 영어 것을 그대로 쓰므로 중국어에서 덮어쓰지 않음
    assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).filter((k) => !['start', 'goal', 'cursor'].includes(k)).sort(), `${id}: 필드`)
    assert.ok(zh.title && zh.desc, `${id}: title/desc`)
    assert.deepEqual(codes(zh.desc), codes(en.desc), `${id}: desc 의 <code>/<kbd> 는 영어와 같아야 함`)
    if (en.keys) assert.equal(zh.keys.length, en.keys.length, `${id}: keys 개수`)
    if (en.checks) {
      assert.equal(zh.checks.length, en.checks.length, `${id}: checks 개수`)
      zh.checks.forEach((c, i) => assert.deepEqual(codes(c), codes(en.checks[i]), `${id}: checks[${i}] 의 <code>`))
    }
    assert.ok(!HANGUL.test(JSON.stringify(zh)), `${id}: 한글이 남음`)
  }
})
