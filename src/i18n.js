import { trackEvent } from './analytics.js'

// 언어 선택: ?lang=en|ko → 저장값 → 브라우저 언어(한국어가 아니면 영어). Node(테스트)에서는 UI_LANG 또는 ko
const LANGS = ['ko', 'en']
const inBrowser = typeof window !== 'undefined'
const param = inBrowser ? new URLSearchParams(location.search).get('lang') : null
let saved = null
try { saved = inBrowser ? localStorage.getItem('nvim-edu:lang') : null } catch {}
const fallback = inBrowser ? (navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en') : (process.env.UI_LANG ?? 'ko')

export const lang = [param, saved, fallback].find((l) => LANGS.includes(l))
if (inBrowser && LANGS.includes(param)) try { localStorage.setItem('nvim-edu:lang', param) } catch {}

// 짧은 문구는 호출하는 곳에 두 언어를 나란히: t('한국어', 'English')
export const t = (ko, en) => (lang === 'en' ? en : ko)

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

// HTML 의 고정 문구: data-en 속성이 있으면 영어일 때 그 값으로 바꿈
export function translateDom(root = document) {
  document.documentElement.lang = lang
  if (lang !== 'en') return
  for (const el of root.querySelectorAll('[data-en]')) el.innerHTML = el.dataset.en
  for (const el of root.querySelectorAll('[data-en-label]')) el.setAttribute('aria-label', el.dataset.enLabel)
}
