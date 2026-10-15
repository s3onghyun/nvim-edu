// 레벨 풀이 검사가 틀렸을 때 CI 로그에 남길 메시지. 통과면 '' (levels.e2e, real.e2e, nvim-diff 공용)
// got = { done, count, text, cursor: [줄, 칸], mode }  check = '에뮬레이터 풀이' | '진짜 Vim 풀이' | ...
export function solveReport(check, level, tokens, got) {
  const why = []
  if (!got.done) {
    why.push('모범 답안을 끝까지 쳐도 클리어되지 않습니다')
    if (level.goal.text != null && got.text !== level.goal.text) why.push(...expected('버퍼', level.goal.text, got.text))
    if (level.goal.cursor && String(got.cursor) !== String(level.goal.cursor)) why.push(...expected('커서', level.goal.cursor, got.cursor))
    if (got.mode !== 'n') why.push(`모드: 지금 ${JSON.stringify(got.mode)} — NORMAL 모드여야 클리어됩니다 (<Esc> 빠짐?)`)
  } else if (got.count !== tokens.length) {
    why.push(`par/별: 클리어 타수 ${got.count} ≠ par ${tokens.length} (solution 키 수) — solution 의 마지막 키 뒤에 남는 키가 있거나 중간에 이미 클리어됩니다`)
  }
  if (!why.length) return ''
  return [`FAIL 레벨 ${level.id} [${check}]`, `  solution: ${JSON.stringify(level.solution)} (${tokens.length}키)`, ...why.map((w) => `  ${w}`)].join('\n')
}

// 기대값과 실제값을 위아래로 (버퍼는 JSON 으로 줄바꿈·공백이 보이게)
export const expected = (what, want, got) => [`기대 ${what}: ${JSON.stringify(want)}`, `실제 ${what}: ${JSON.stringify(got)}`]
