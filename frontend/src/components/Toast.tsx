import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

interface ToastApi {
  /** Shows a short confirmation ("Сақталды") at the bottom of the screen. */
  show: (text: string) => void
}

const ToastContext = createContext<ToastApi>({ show: () => undefined })

/** App-wide toast; survives route changes because it sits above the router outlet. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null)
  const [seq, setSeq] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((t: string) => {
    setText(t)
    setSeq((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!text) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setText(null), 4000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [text, seq])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {text && (
          <div className="notice" key={seq}>
            <Icon name="check" />
            <span>{text}</span>
            <button className="icon-btn" aria-label="Жабу" onClick={() => setText(null)}><Icon name="close" size={16} /></button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}
