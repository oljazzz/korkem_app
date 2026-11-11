import './i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { ToastProvider } from './components/Toast'
// Self-hosted font: no third-party requests, so the CSP can stay 'self'-only
import '@fontsource-variable/roboto'
import './styles/tokens.css'
import './index.css'

// A data router is required for useBlocker (unsaved-changes guard); App keeps its own <Routes>.
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    ),
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
