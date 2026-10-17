import { trackEvent } from './analytics.js'

// 언어 선택: ?lang=ko|en|zh-CN (zh 도 됨) → 저장값 → 브라우저 언어(ko → 한국어, zh* → 简体中文, 그 밖 → 영어).
// Node(테스트)에서는 UI_LANG 또는 ko
export const LANGS = ['ko', 'en', 'zh-CN']
// 언어 전환 메뉴에 보이는 이름
export const LANG_NAMES = { ko: '한국어', en: 'EN', 'zh-CN': '中文' }

// 'zh' · 'zh-cn' → 'zh-CN'. 모르는 값은 null
export const normalizeLang = (l) => (l === 'zh' || l?.toLowerCase() === 'zh-cn' ? 'zh-CN' : LANGS.includes(l) ? l : null)
// 브라우저 언어 → 화면 언어. 중국어는 지역·문자(zh-TW 등)와 상관없이 간체
export const detectLang = (browser) => {
  const l = browser?.toLowerCase() ?? ''
  return l.startsWith('ko') ? 'ko' : l.startsWith('zh') ? 'zh-CN' : 'en'
}

const inBrowser = typeof window !== 'undefined'
const param = inBrowser ? normalizeLang(new URLSearchParams(location.search).get('lang')) : null
let saved = null
try { saved = inBrowser ? normalizeLang(localStorage.getItem('nvim-edu:lang')) : null } catch {}
const fallback = inBrowser ? detectLang(navigator.language) : (normalizeLang(process.env.UI_LANG) ?? 'ko')

export const lang = [param, saved, fallback].find((l) => LANGS.includes(l))
if (inBrowser && param) try { localStorage.setItem('nvim-edu:lang', param) } catch {}

// 짧은 문구는 호출하는 곳에 언어를 나란히: t('한국어', 'English', '中文').
// 중국어가 없으면 영어로 (한국어보다 읽기 쉬움)
export const translate = (to, ko, en, zh) => (to === 'en' ? en : to === 'zh-CN' ? (zh ?? en) : ko)
export const t = (ko, en, zh) => translate(lang, ko, en, zh)

export function setLang(next) {
  trackEvent(`language/${next}`)
  try { localStorage.setItem('nvim-edu:lang', next) } catch {}
  const url = new URL(location.href)
  url.searchParams.delete('lang')
  // 레벨 데이터가 로드 시점에 언어를 정하므로 새로 불러옴.
  // location.replace 는 #레벨 만 같은 주소면 새로고침을 안 해서, 주소만 바꾸고 직접 reload
  history.replaceState(history.state, '', url)
  location.reload()
}

// HTML 의 고정 문구: data-en / data-zh-cn 속성이 있으면 그 언어일 때 그 값으로 바꿈 (중국어가 없으면 영어)
export function translateDom(root = document) {
  document.documentElement.lang = lang
  if (lang === 'ko') return
  const key = lang === 'en' ? 'en' : 'zhCn'
  for (const el of root.querySelectorAll('[data-en]')) el.innerHTML = el.dataset[key] ?? el.dataset.en
  for (const el of root.querySelectorAll('[data-en-label]')) el.setAttribute('aria-label', el.dataset[`${key}Label`] ?? el.dataset.enLabel)
}
