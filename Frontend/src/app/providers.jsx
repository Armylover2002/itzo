import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Toaster as HotToaster } from 'react-hot-toast'
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

export function AppProviders({ children }) {
  const Router = shouldUseHashRouter() ? HashRouter : BrowserRouter

  return (
    <StrictMode>
      <ThemeProvider 
        attribute="class" 
        defaultTheme="light" 
        storageKey="appTheme"
        enableSystem={false}
      >
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <ReduxProvider store={store}>
                <Router>
                  {children}
                  <Toaster position="top-center" richColors offset="80px" />
                  <HotToaster position="top-center" reverseOrder={false} />
                </Router>
              </ReduxProvider>
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>
  )
}
