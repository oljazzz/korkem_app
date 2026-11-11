import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { numericInput, parseNum } from '../lib/format'
import { Icon } from './Icon'
import { useTranslation } from 'react-i18next'

/** The part of the page the user can see: on phones it shrinks when the on-screen keyboard opens. */
function visibleBox() {
  const v = window.visualViewport
  return { top: v ? v.offsetTop : 0, height: v ? v.height : window.innerHeight }
}

function useVisibleBox() {
  const [box, setBox] = useState(visibleBox)
  useEffect(() => {
    const v = window.visualViewport
    if (!v) return
    const update = () => setBox(visibleBox())
    v.addEventListener('resize', update)
    v.addEventListener('scroll', update)
    return () => {
      v.removeEventListener('resize', update)
      v.removeEventListener('scroll', update)
    }
  }, [])
  return box
}

/**
 * Full-screen phone panel. It is sized to the visible area, so its footer (the main button) stays
 * just above the on-screen keyboard instead of behind it. Esc or the header button closes it.
 */
export function Sheet({ title, onClose, onBack, footer, children }: {
  title: string
  onClose: () => void
  /** Shows a back arrow instead of the close cross (second step of a flow). */
  onBack?: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  const box = useVisibleBox()
  const { t } = useTranslation()
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    document.documentElement.classList.add('has-sheet')
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      document.documentElement.classList.remove('has-sheet')
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return createPortal(
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title} style={{ top: box.top, height: box.height }}>
      <header className="sheet__head">
        <button type="button" className="icon-btn sheet__close" onClick={onBack ?? onClose} aria-label={onBack ? t('common.back') : t('common.close')}>
          <Icon name={onBack ? 'back' : 'close'} />
        </button>
        <h2 className="sheet__title">{title}</h2>
      </header>
      <div className="sheet__body">{children}</div>
      {footer && <div className="sheet__foot">{footer}</div>}
    </div>,
    document.body,
  )
}

/** Search box for a sheet: large, with a clear button. */
export function SheetSearch({ value, onChange, placeholder, autoFocus }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  return (
    <label className="search sheet-search">
      <Icon name="search" />
      <input type="search" enterKeyHint="search" autoFocus={autoFocus} value={value}
        placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button type="button" className="sheet-search__clear" aria-label={t('common.clear')} onClick={() => onChange('')}>
          <Icon name="close" size={18} />
        </button>
      )}
    </label>
  )
}

/** Quantity with large − / + buttons; the number can still be typed. */
export function Stepper({ value, onChange, inputRef, label: labelProp, compact }: {
  value: string
  onChange: (v: string) => void
  inputRef?: Ref<HTMLInputElement>
  label?: string
  compact?: boolean
}) {
  const n = parseNum(value) ?? 0
  const { t } = useTranslation()
  const label = labelProp ?? t('stepper.quantity')
  // Whole steps; a typed fraction (2,5 kg) steps to the next whole number
  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? Math.floor(n) + 1 : Math.ceil(n) - 1
    onChange(String(Math.max(1, next)))
  }
  return (
    <div className={`stepper ${compact ? 'stepper--compact' : ''}`}>
      <button type="button" className="stepper__btn" aria-label={t('stepper.decrease', { label })} disabled={n <= 1} onClick={() => step(-1)}>−</button>
      <input ref={inputRef} className="input stepper__input" inputMode="decimal" enterKeyHint="done" aria-label={label}
        value={value} onChange={(e) => onChange(numericInput(e.target.value))} onFocus={(e) => e.target.select()} />
      <button type="button" className="stepper__btn" aria-label={t('stepper.increase', { label })} onClick={() => step(1)}>+</button>
    </div>
  )
}
