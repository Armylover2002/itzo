export function isNativeLikeShell() {
  if (typeof window === 'undefined') return false

  const protocol = String(window.location?.protocol || '').toLowerCase()
  const userAgent = String(window.navigator?.userAgent || '').toLowerCase()

  return (
    Boolean(window.flutter_inappwebview) ||
    Boolean(window.ReactNativeWebView) ||
    protocol === 'file:' ||
    userAgent.includes(' wv') ||
    userAgent.includes('; wv')
  )
}

export function isNativeAppShellRoute(pathname = '') {
  const path = String(pathname || '')
  return path.startsWith('/seller') || path.startsWith('/food/delivery')
}

export function applyNativeShellClasses(pathname = '') {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const native = isNativeLikeShell()

  root.classList.toggle('native-shell', native)
  root.classList.toggle(
    'native-app-shell',
    native && isNativeAppShellRoute(pathname),
  )
}
