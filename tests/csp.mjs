// Content-Security-Policy 위반을 모은다 (index.html · real/index.html 의 <meta> 정책).
// page 또는 browser context 에 붙이면 이후 모든 문서의 securitypolicyviolation 이벤트가 배열에 쌓임
export async function watchCsp(target) {
  const violations = []
  await target.exposeFunction('__cspViolation', (v) => violations.push(v))
  await target.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolation({ directive: e.violatedDirective, blocked: e.blockedURI, page: location.pathname })
    })
  })
  return violations
}
