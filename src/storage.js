// localStorage 의 nvim-edu:* 값. main.js · real.js 가 같이 씀.
// 저장된 값은 이 앱이 아닌 것(같은 오리진의 다른 페이지, 확장, DevTools)도 바꿀 수 있으므로
// 읽을 때 모양을 검사하고 맞지 않는 항목은 버린다 — 값 하나가 망가져도 화면은 떠야 함
export const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(`nvim-edu:${k}`)) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(`nvim-edu:${k}`, JSON.stringify(v)) } catch {} },
}

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/ // 레벨·미션 id 형식 (src/levels/schema.js 와 같음)
const DAY = /^\d{4}-\d{2}-\d{2}$/ // drill.js 의 ymd()
const entries = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v).filter(([id]) => ID.test(id)) : [])
const isCount = (n) => Number.isInteger(n) && n >= 0

// { 레벨 id: 별 1~3 }
export function cleanProgress(v) {
  const out = {}
  for (const [id, n] of entries(v)) if (Number.isInteger(n) && n >= 1 && n <= 3) out[id] = n
  return out
}

// { 미션 id: { time: 초, keys: 타수 } } — 미션별 최고 기록
export function cleanRecords(v) {
  const out = {}
  for (const [id, r] of entries(v)) {
    if (Number.isFinite(r?.time) && r.time >= 0 && isCount(r.keys)) out[id] = { time: r.time, keys: r.keys }
  }
  return out
}

// ['YYYY-MM-DD', ...] — 미션을 완료한 날짜들
export const cleanDays = (v) => (Array.isArray(v) ? [...new Set(v.filter((d) => typeof d === 'string' && DAY.test(d)))] : [])

export const loadProgress = () => cleanProgress(store.get('progress', {}))
export const loadRecords = () => cleanRecords(store.get('records', {}))
export const loadDays = () => cleanDays(store.get('days', []))
