import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import App from './app/App.jsx'
import { isModuleAuthenticated } from './modules/Food/utils/auth.js'
import { applySellerOnboardingColdStart } from './modules/seller/utils/sellerSession.js'
import { applyNativeShellClasses } from './shared/utils/nativeShell.js'
import './shared/styles/global.css'

// app console
// import eruda from 'eruda'
// eruda.init()
const NATIVE_LAST_ROUTE_KEY = 'native_last_route'

// A deep-linked/rarely-visited page (e.g. a QR-code link) can hold an index.html
// cached from before a deploy, whose lazy-loaded chunk filenames no longer exist
// on the server (old builds get removed on deploy). That 404 rejects the dynamic
// import() and previously dead-ended on the ErrorBoundary's "Something went
// wrong" screen. Vite fires this event for exactly that failure — reload once
// (never loop) to pick up the current index.html and its real chunk hashes.
window.addEventListener('vite:preloadError', () => {
  const key = 'vitePreloadErrorReloaded'
  if (sessionStorage.getItem(key)) return
  sessionStorage.setItem(key, '1')
  window.location.reload()
})

// ─── Quick-spicy Food Module Initialization ───────────────────────────────────

// Load global business settings (favicon, title) — non-critical
import('@common/utils/businessSettings')
  .then(({ loadBusinessSettings }) => loadBusinessSettings())
  .catch(() => { /* Silently fail — settings load when admin authenticates */ })

// Apply saved theme
const savedTheme = localStorage.getItem('appTheme') || 'light'
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark')
} else {
  document.documentElement.classList.remove('dark')
}

function isNativeLikeShell() {
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

function resolveNativeInitialRoute() {
  if (typeof window === 'undefined') return '/food/user'

  const rawPathname = String(window.location?.pathname || '')
  const pathname = rawPathname.replace(/\/index\.html$/i, '') || '/'
  const storedRoute = String(localStorage.getItem(NATIVE_LAST_ROUTE_KEY) || '').trim()

  if (pathname.startsWith('/food/')) return pathname

  if (pathname.startsWith('/seller')) return pathname

  if (pathname.startsWith('/restaurant')) return `/food${pathname}`
  if (pathname.startsWith('/delivery')) return `/food${pathname}`
  if (pathname.startsWith('/user')) return `/food${pathname}`
  if (pathname.startsWith('/ecs')) return pathname
  if (pathname.startsWith('/hrms')) return pathname
  if (storedRoute.startsWith('/food/') || storedRoute.startsWith('/ecs') || storedRoute.startsWith('/hrms')) {
    return storedRoute
  }

  // HRMS stores its token under 'auth_hrms' (see AuthContext ROLE_STORAGE_KEYS),
  // not the per-module '<module>_accessToken' key isModuleAuthenticated() reads.
  if (localStorage.getItem('auth_hrms')) return '/hrms'
  if (isModuleAuthenticated('restaurant')) return '/food/restaurant'
  if (isModuleAuthenticated('delivery')) return '/food/delivery'
  if (isModuleAuthenticated('admin')) return '/ecs'
  if (isModuleAuthenticated('user')) return '/food/user'

  return '/food/user'
}

function bootstrapNativeHashRoute() {
  if (!isNativeLikeShell() || typeof window === 'undefined') return

  const forceSellerAuth = applySellerOnboardingColdStart()
  const currentHash = String(window.location?.hash || '')
  if (!forceSellerAuth && currentHash.startsWith('#/')) return

  const targetPath = forceSellerAuth ? '/seller/auth' : resolveNativeInitialRoute()
  const search = String(window.location?.search || '')
  window.history.replaceState(null, '', `#${targetPath}${search}`)
}

bootstrapNativeHashRoute()
applyNativeShellClasses(
  typeof window !== 'undefined'
    ? String(window.location?.hash || '').replace(/^#/, '') || String(window.location?.pathname || '')
    : '',
)

// ─── Suppress known non-critical errors ──────────────────────────────────────

const originalError = console.error
console.error = (...args) => {
  const errorStr = args.join(' ')

  if (typeof args[0] === 'string' && (
    args[0].includes('chrome-extension://') ||
    args[0].includes('_$initialUrl') ||
    args[0].includes('_$onReInit') ||
    args[0].includes('_$bindListeners')
  )) return

  if (
    errorStr.includes('Timeout expired') ||
    errorStr.includes('GeolocationPositionError') ||
    errorStr.includes('Geolocation error') ||
    errorStr.includes('User denied Geolocation') ||
    errorStr.includes('permission denied')
  ) return

  const hasNetworkError = args.some(arg =>
    arg && typeof arg === 'object' &&
    (arg.name === 'AxiosError') &&
    (arg.code === 'ERR_NETWORK' || arg.message === 'Network Error')
  )
  if (hasNetworkError) return

  if (
    errorStr.includes('🌐 Network Error') ||
    errorStr.includes('Network Error - Backend server may not be running') ||
    (errorStr.includes('ERR_NETWORK') && errorStr.includes('AxiosError'))
  ) return

  if (
    errorStr.includes('Restaurant Socket connection error') ||
    errorStr.includes('xhr poll error') ||
    (errorStr.includes('WebSocket connection to') && errorStr.includes('socket.io') && errorStr.includes('failed'))
  ) return

  originalError.apply(console, args)
}

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason || event
  const errorMsg = error?.message || String(error) || ''
  const errorName = error?.name || ''
  if (
    errorMsg.includes('Timeout expired') ||
    errorMsg.includes('User denied Geolocation') ||
    errorMsg.includes('permission denied') ||
    errorName === 'GeolocationPositionError'
  ) {
    event.preventDefault()
    return
  }
})

// ─────────────────────────────────────────────────────────────────────────────

import { AppProviders } from './app/providers.jsx'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement).render(
  <AppProviders>
    <App />
  </AppProviders>
)
