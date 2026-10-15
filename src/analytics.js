// GoatCounter is cookieless. Keep the endpoint here so a future site-code change is one edit.
export const GOATCOUNTER_ENDPOINT = 'https://s3onghyun.goatcounter.com/count'

const pending = []

export function privacyControlEnabled() {
  if (typeof navigator === 'undefined') return true
  return navigator.globalPrivacyControl === true || ['1', 'yes'].includes(String(navigator.doNotTrack).toLowerCase())
}

function count(data) {
  if (privacyControlEnabled() || typeof window === 'undefined') return
  try {
    if (typeof window.goatcounter?.count === 'function') window.goatcounter.count(data)
    else pending.push(data)
  } catch {
    // Analytics is optional; a blocked script or network error must not affect practice.
  }
}

function flush() {
  while (pending.length) {
    const data = pending.shift()
    try { window.goatcounter?.count?.(data) } catch { /* optional analytics */ }
  }
}

export function initializeAnalytics() {
  if (privacyControlEnabled() || typeof document === 'undefined' || window.goatcounter?.count) return
  try {
    // no_onload lets the app provide safe, hash-aware route paths itself.
    window.goatcounter = { ...window.goatcounter, no_onload: true }
    const script = document.createElement('script')
    script.async = true
    // real/ runs under COEP require-corp; a no-cors cross-origin script is blocked there.
    script.crossOrigin = 'anonymous'
    script.src = 'https://gc.zgo.at/count.js'
    script.dataset.goatcounter = GOATCOUNTER_ENDPOINT
    script.dataset.goatcounterSettings = JSON.stringify({ no_onload: true })
    script.addEventListener('load', flush)
    document.head.append(script)
  } catch {
    // Ad blockers and restrictive browser settings are expected.
  }
}

export function trackPageView(path, title = document.title) {
  count({ path, title })
}

export function trackEvent(path, title = document.title) {
  count({ path, title, event: true })
}
