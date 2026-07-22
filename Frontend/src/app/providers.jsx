import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { StrictMode } from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { store } from './store'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@core/context/AuthContext'
import { SettingsProvider } from '@core/context/SettingsContext'
import { ToastProvider } from '@shared/components/ui/Toast'

function shouldUseHashRouter() {
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

import { useLocation } from 'react-router-dom'

function ThemeWrapper({ children }) {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/ecs') || location.pathname.startsWith('/admin')

  return (
    <ThemeProvider 
      attribute="class" 
      defaultTheme="light" 
      storageKey="appTheme"
      enableSystem={false}
      forcedTheme={isAdmin ? 'light' : undefined}
    >
      {children}
    </ThemeProvider>
  )
}

export function AppProviders({ children }) {
  const Router = shouldUseHashRouter() ? HashRouter : BrowserRouter

  return (
    <StrictMode>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <ReduxProvider store={store}>
              <Router>
                <ThemeWrapper>
                  {children}
                  <Toaster position="top-center" richColors offset="80px" />
                </ThemeWrapper>
              </Router>
            </ReduxProvider>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </StrictMode>
  )
}
