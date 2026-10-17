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

// #lang 버튼 → 한국어 / EN / 中文 메뉴. 메인 화면과 진짜 Vim 화면이 같이 씀
export function mountLangMenu(button) {
  const label = button.getAttribute('aria-label')
  button.append(LANG_NAMES[lang])
  button.setAttribute('aria-label', `${LANG_NAMES[lang]} ${label}`)
  button.setAttribute('aria-haspopup', 'menu')
  button.setAttribute('aria-expanded', 'false')
  const menu = document.createElement('div')
  menu.id = 'lang-menu'
  menu.className = 'lang-menu'
  menu.setAttribute('role', 'menu')
  menu.setAttribute('aria-label', label)
  menu.hidden = true
  menu.innerHTML = LANGS.map((l) => `<button role="menuitemradio" aria-checked="${l === lang}" data-lang="${l}" lang="${l}">${LANG_NAMES[l]}</button>`).join('')
  button.after(menu)
  const items = [...menu.querySelectorAll('button')]
  const close = (focus) => {
    menu.hidden = true
    button.setAttribute('aria-expanded', 'false')
    if (focus) button.focus()
  }
  const open = () => {
    const r = button.getBoundingClientRect()
    menu.style.top = `${r.bottom + 4}px`
    menu.style.right = `${Math.max(4, document.documentElement.clientWidth - r.right)}px`
    menu.hidden = false
    button.setAttribute('aria-expanded', 'true')
    items.find((b) => b.dataset.lang === lang).focus()
  }
  button.onclick = () => (menu.hidden ? open() : close(true))
  menu.onclick = (e) => {
    const next = e.target.closest('button')?.dataset.lang
    if (!next) return
    if (next === lang) close(true)
    else setLang(next)
  }
  // 메뉴 안의 키는 대시보드 단축키(n, d …)로 새지 않게
  menu.addEventListener('keydown', (e) => {
    e.stopPropagation()
    const i = items.indexOf(document.activeElement)
    if (e.key === 'Escape') close(true)
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus()
    else return
    e.preventDefault()
  })
  menu.addEventListener('focusout', (e) => { if (!menu.contains(e.relatedTarget) && e.relatedTarget !== button) close(false) })
  document.addEventListener('mousedown', (e) => { if (!menu.hidden && !menu.contains(e.target) && !button.contains(e.target)) close(false) })
}
