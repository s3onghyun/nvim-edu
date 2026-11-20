// GoatCounter is cookieless. Keep the endpoint here so a future site-code change is one edit.
export const GOATCOUNTER_ENDPOINT = 'https://s3onghyun.goatcounter.com/count'
// A versioned, immutable script pinned by its Subresource Integrity hash (published by GoatCounter),
// so the browser refuses any other file served under this URL.
export const GOATCOUNTER_SCRIPT = 'https://gc.zgo.at/count.v4.js'
export const GOATCOUNTER_INTEGRITY = 'sha384-nRw6qfbWyJha9LhsOtSb2YJDyZdKvvCFh0fJYlkquSFjUxp9FVNugbfy8q1jdxI+'

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
    // CORS mode is required for the integrity check, and real/ runs under COEP require-corp.
    script.crossOrigin = 'anonymous'
    script.integrity = GOATCOUNTER_INTEGRITY
    script.src = GOATCOUNTER_SCRIPT
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
