import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useTranslation } from 'react-i18next'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Dialog: Esc and backdrop close it, Tab stays inside, focus returns to the opener on close. */
export function Modal({ title, onClose, children, footer, width = 460 }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  // Captured during the first render, before React's autoFocus moves focus into the dialog
  const [opener] = useState(() => document.activeElement as HTMLElement | null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.contains(document.activeElement)) {
      // Respect autoFocus inside the dialog; otherwise focus the first control
      const first = dialog.querySelector<HTMLElement>('[autofocus]') ?? dialog.querySelector<HTMLElement>(FOCUSABLE)
      first?.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
      } else if (e.key === 'Tab' && dialog) {
        const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [opener])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="modal" style={{ width }} role="dialog" aria-modal="true" aria-label={title}>
        <button className="modal__close" onClick={onClose} aria-label={t('common.close')}><Icon name="close" /></button>
        <h2 className="modal__title">{title}</h2>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmModal({ text, onConfirm, onClose, title, confirmLabel, cancelLabel, danger }: {
  text: string
  onConfirm: () => void
  onClose: () => void
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button for destructive actions. */
  danger?: boolean
}) {
  const { t } = useTranslation()
  return (
    <Modal
      title={title ?? t('common.confirm')}
      onClose={onClose}
      footer={
        <>
          <button className={`btn ${danger ? 'btn--danger-solid' : 'btn--primary'}`} onClick={onConfirm}>{confirmLabel ?? t('common.yes')}</button>
          <button className="btn btn--ghost" onClick={onClose} autoFocus>{cancelLabel ?? t('common.no')}</button>
        </>
      }
    >
      <p>{text}</p>
    </Modal>
  )
}
