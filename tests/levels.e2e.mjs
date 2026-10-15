// 모든 레벨의 모범 답안을 실제 브라우저에서 입력해 클리어되는지, 타수가 par와 같은지 검증
import { preview } from 'vite'
import * as pw from 'playwright-core'
import { chapters, levels, tokenize, difficultyLabel, difficultyText } from '../src/levels.js'
import { solveReport } from './level-report.mjs'

const KEY = {
  '<Esc>': 'Escape', '<CR>': 'Enter', '<C-a>': 'Control+a', '<C-v>': 'Control+v', '<C-b>': 'Control+b', '<C-u>': 'Control+u',
  '<Left>': 'ArrowLeft', '<Right>': 'ArrowRight', '<Up>': 'ArrowUp', '<Down>': 'ArrowDown',
}

// BASE_URL 을 주면 배포된 사이트를, 아니면 로컬 빌드를 검증. BROWSER=chromium|firefox|webkit
const BASE = process.env.BASE_URL ?? 'http://localhost:4179/'
const server = process.env.BASE_URL ? null : await preview({ preview: { port: 4179 } })
const name = process.env.BROWSER ?? 'chromium'
// UI_LANG=en 이면 영어 화면으로 (레벨 데이터도 node 쪽에서 같은 언어로 불러옴)
const QS = process.env.UI_LANG ? `?lang=${process.env.UI_LANG}` : ''
const browser = await pw[name].launch({ executablePath: name === 'chromium' ? process.env.CHROME_PATH || undefined : undefined })
const page = await browser.newPage()
let failed = 0

// 난이도는 챕터 데이터에서 나와 파일 트리와 도움말에 모두 텍스트로 보여야 한다.
for (const chapter of chapters) {
  const level = levels.find((item) => item.chapter === chapter.id)
  const difficultyQS = `?lang=${process.env.UI_LANG ?? 'ko'}`
  await page.goto(`${BASE}${difficultyQS}#${level.id}`)
  // 해시만 바뀌면 goto 가 hashchange 처리 전에 끝날 수 있음
  await page.waitForFunction((id) => window.__edu?.level?.id === id, level.id)
  const treeBadge = page.locator(`.tree .dir[data-chapter="${chapter.id}"] .difficulty`)
  const helpBadge = page.locator('#difficulty')
  const [treeText, treeLabel, helpText] = await Promise.all([
    treeBadge.innerText(), treeBadge.getAttribute('aria-label'), helpBadge.innerText(),
  ])
  const ok = treeText === difficultyLabel(chapter.difficulty) && treeLabel === difficultyText(chapter.difficulty) && helpText === difficultyText(chapter.difficulty)
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${chapter.id} difficulty${ok ? '' : `\n  tree=${JSON.stringify(treeText)} aria=${JSON.stringify(treeLabel)} help=${JSON.stringify(helpText)}`}`)
}

async function typeKeys(tokens) {
  for (const t of tokens) {
    if (KEY[t]) await page.keyboard.press(KEY[t])
    else if (t.startsWith('<')) throw new Error(`unknown key ${t}`)
    else await page.keyboard.type(t)
  }
}

for (const level of levels) {
  await page.goto(`${BASE}${QS}#${level.id}`)
  await page.reload() // hash만 바뀌면 이전 레벨 상태가 남을 수 있어 새로 로드
  const tokens = tokenize(level.solution)
  await typeKeys(tokens)
  await page.waitForTimeout(50)
  const { done, count, text, editor } = await page.evaluate(() => ({
    done: window.__edu.done, count: window.__edu.count,
    text: (document.querySelector('.cm-content') ?? document.querySelector('#term')).innerText,
    editor: document.querySelector('.cm-content') && window.__edu.editor,
  }))
  let ok = done && count === tokens.length
  if (!ok) failed++
  // Vim 레벨은 어느 검사가 왜 틀렸는지(기대/실제 버퍼·커서), tmux 레벨은 화면 그대로
  const report = level.kind ? `FAIL ${level.id} done=${done} count=${count}/${tokens.length}\n${text}` : solveReport('에뮬레이터 풀이', level, tokens, { done, count, ...editor })
  console.log(ok ? `PASS ${level.id} done=${done} count=${count}/${tokens.length}` : report)
  // 풀이 해설: 내 키·모범 답안을 보이지 않는 에디터에서 다시 실행한 결과가 실제 에디터의 마지막 상태와 같아야 함
  if (!level.kind) {
    const ex = await page.evaluate(() => ({ ...window.__edu.explainCheck(), now: window.__edu.editor }))
    const want = JSON.stringify({ text: ex.now.text, cursor: ex.now.cursor })
    ok = JSON.stringify(ex.mine) === want && JSON.stringify(ex.solution) === want && ex.rows > 0
    if (!ok) failed++
    console.log(ok ? `PASS ${level.id} explain` : `FAIL 레벨 ${level.id} [해설 리플레이] 다시 실행한 마지막 상태가 에디터와 다릅니다\n  editor   ${want}\n  mine     ${JSON.stringify(ex.mine)}\n  solution ${JSON.stringify(ex.solution)}\n  rows ${ex.rows}`)
  }
}

// 미션: 라운드마다 생성된 답안을 입력해 10라운드 완주 (랜덤이라 미션당 3회)
for (const m of ['mission-move', 'mission-delete', 'mission-change', 'mission-tmux', 'mission-daily']) {
  for (let run = 0; run < 3; run++) {
    await page.goto(`${BASE}${QS}#${m}`)
    await page.reload()
    let stuck = null
    for (let r = 0; r < 10 && !stuck; r++) {
      const sol = await page.evaluate(() => window.__edu.level.solution)
      await typeKeys(tokenize(sol))
      await page.waitForTimeout(r < 9 ? 350 : 50) // 다음 라운드 전환 대기
      const s = await page.evaluate(() => ({ done: window.__edu.done, ...window.__edu.session }))
      if (r < 9 ? s.round !== r + 1 : !(s.done && s.round === 10)) stuck = `round ${r + 1}: ${sol}`
    }
    const ok = !stuck && (await page.locator('#banner').isVisible()) // 언어와 무관하게 완료 알림이 떴는지
    if (!ok) failed++
    console.log(`${ok ? 'PASS' : 'FAIL'} ${m} #${run + 1}${ok ? '' : ` ${stuck}\n${await page.locator('.cm-content, #term').first().innerText()}`}`)
  }
}

await browser.close()
server?.httpServer.close()
console.log(`${name} ${BASE}: ${failed ? `${failed} FAIL` : 'ALL PASS'}`)
process.exit(failed ? 1 : 0)
