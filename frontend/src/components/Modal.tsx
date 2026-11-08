import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icon'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}

export function Modal({ title, onClose, children, footer, width = 460 }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }} role="dialog" aria-modal="true" aria-label={title}>
        <button className="modal__close" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button>
        <h2 className="modal__title">{title}</h2>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmModal({ text, onConfirm, onClose }: { text: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      title="Подтверждение"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={onConfirm} autoFocus>Да</button>
          <button className="btn btn--ghost" onClick={onClose}>Нет</button>
        </>
      }
    >
      <p>{text}</p>
    </Modal>
  )
}
