import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { waLink, waNumber } from '../lib/whatsapp'
import { Icon } from './Icon'

/**
 * Opens WhatsApp with `text` filled in. One number: a plain link. Several: a short list to pick from.
 * None (or none that looks like a phone): WhatsApp asks whom to send it to.
 * `text` is built on click, so it always shows the current figures.
 */
export function WhatsAppButton({ phones, text, label, className = 'btn btn--outline', disabled }: {
  phones: string[]
  text: () => string
  label?: string
  className?: string
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const valid = phones.filter((p) => waNumber(p))
  const caption = label ?? t('whatsapp.send')

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (phone: string | null) => {
    setOpen(false)
    window.open(waLink(phone, text()), '_blank', 'noopener')
  }

  if (valid.length <= 1) {
    return (
      <button type="button" className={className} disabled={disabled} onClick={() => go(valid[0] ?? null)}
        title={valid[0] ? t('whatsapp.to', { phone: valid[0] }) : t('whatsapp.noPhone')}>
        <Icon name="chat" />{caption}
      </button>
    )
  }
  return (
    <div className="wa-menu" ref={ref}>
      <button type="button" className={className} disabled={disabled} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((v) => !v)}>
        <Icon name="chat" />{caption}
      </button>
      {open && (
        <ul className="wa-menu__list" role="menu" aria-label={t('whatsapp.pickPhone')}>
          {valid.map((p) => (
            <li key={p}>
              <button type="button" role="menuitem" className="wa-menu__item" onClick={() => go(p)}>{p}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
