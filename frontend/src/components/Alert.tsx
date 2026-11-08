import type { ReactNode } from 'react'
import { Icon } from './Icon'

/** Inline error message with a close button; announced to screen readers. */
export function Alert({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="alert" role="alert">
      <span className="alert__text">{children}</span>
      {onClose && (
        <button className="icon-btn alert__close" aria-label="Жабу" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  )
}
