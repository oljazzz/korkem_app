import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from './Icon'
import { useTranslation } from 'react-i18next'


interface Props {
  /** ISO date (yyyy-mm-dd) or '' */
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  ariaLabel: string
  /** Allow clearing the field (an empty value). */
  clearable?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const isoToText = (iso: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '')
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date())

function parseText(text: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text)
  if (!m) return null
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null
  return toIso(y, mo - 1, d)
}

/** Digits only, dots inserted automatically: "05112026" → "05.11.2026". */
function maskDigits(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('.')
}

/**
 * Date field in the Kazakh dd.mm.yyyy format with a Kazakh calendar, independent of the browser locale.
 * Type digits (dots are added) or pick a day; arrows, PageUp/PageDown, Home/End, Enter and Esc work in the calendar.
 */
export function DateInput({ value, onChange, min, max, ariaLabel, clearable = true }: Props) {
  const [text, setText] = useState(isoToText(value))
  const { t } = useTranslation()
  const MONTHS: string[] = t('date.months', { returnObjects: true })
  const WEEKDAYS: string[] = t('date.weekdaysShort', { returnObjects: true }) // the week starts on Monday
  const WEEKDAYS_FULL: string[] = t('date.weekdays', { returnObjects: true })
  const [open, setOpen] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [cursor, setCursor] = useState(value || todayIso()) // focused day in the calendar
  const boxRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogId = useId()

  useEffect(() => {
    setText(isoToText(value))
    setInvalid(false)
  }, [value])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Keep keyboard focus on the cursor day while the calendar is open
  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${cursor}"]`)?.focus()
  }, [open, cursor])

  const outOfRange = (iso: string) => (min ? iso < min : false) || (max ? iso > max : false)

  const commit = (iso: string) => {
    if (outOfRange(iso)) {
      setInvalid(true)
      return false
    }
    setInvalid(false)
    if (iso !== value) onChange(iso)
    return true
  }

  const onText = (raw: string) => {
    const masked = maskDigits(raw)
    setText(masked)
    if (masked.length === 10) {
      const iso = parseText(masked)
      if (iso) commit(iso)
      else setInvalid(true)
    } else {
      setInvalid(false)
    }
  }

  const onBlur = () => {
    if (open) return
    if (text === '') {
      if (clearable && value) onChange('')
      else setText(isoToText(value))
      return
    }
    const iso = parseText(text)
    if (!iso || !commit(iso)) {
      setText(isoToText(value))
      setInvalid(false)
    }
  }

  const y = Number(cursor.slice(0, 4))
  const m = Number(cursor.slice(5, 7)) - 1
  const days = useMemo(() => {
    const first = new Date(Date.UTC(y, m, 1))
    const lead = (first.getUTCDay() + 6) % 7 // Monday = 0
    const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    return { lead, count }
  }, [y, m])

  const moveCursor = (deltaDays: number) => {
    const d = new Date(Date.UTC(y, m, Number(cursor.slice(8, 10)) + deltaDays))
    setCursor(toIso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }
  const moveMonth = (delta: number) => {
    const day = Number(cursor.slice(8, 10))
    const last = new Date(Date.UTC(y, m + delta + 1, 0)).getUTCDate()
    const d = new Date(Date.UTC(y, m + delta, Math.min(day, last)))
    setCursor(toIso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }

  const pick = (iso: string) => {
    if (outOfRange(iso)) return
    commit(iso)
    setOpen(false)
    inputRef.current?.focus()
  }

  const onGridKey = (e: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowLeft: () => moveCursor(-1),
      ArrowRight: () => moveCursor(1),
      ArrowUp: () => moveCursor(-7),
      ArrowDown: () => moveCursor(7),
      PageUp: () => moveMonth(-1),
      PageDown: () => moveMonth(1),
      Home: () => moveCursor(-((new Date(cursor).getUTCDay() + 6) % 7)),
      End: () => moveCursor(6 - ((new Date(cursor).getUTCDay() + 6) % 7)),
      Escape: () => {
        setOpen(false)
        inputRef.current?.focus()
      },
    }
    const fn = keys[e.key]
    if (fn) {
      e.preventDefault()
      e.stopPropagation()
      fn()
    }
  }

  const today = todayIso()

  return (
    <div className="date-input" ref={boxRef}>
      <div className={`date-input__control ${invalid ? 'is-invalid' : ''}`}>
        <input
          ref={inputRef}
          className="date-input__text"
          inputMode="numeric"
          placeholder={t('dateInput.placeholder')}
          aria-label={t('dateInput.format', { label: ariaLabel })}
          aria-invalid={invalid || undefined}
          value={text}
          onChange={(e) => onText(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && e.altKey) {
              e.preventDefault()
              setCursor(value || today)
              setOpen(true)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              onBlur()
            }
          }}
        />
        <button
          type="button"
          className="date-input__btn"
          aria-label={t('dateInput.open', { label: ariaLabel })}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          onClick={() => {
            setCursor(value || today)
            setOpen((o) => !o)
          }}
        >
          <Icon name="calendar" size={18} />
        </button>
      </div>

      {open && (
        <div className="calendar" id={dialogId} role="dialog" aria-label={t('dateInput.calendar', { label: ariaLabel })}>
          <div className="calendar__head">
            <button type="button" className="icon-btn" aria-label={t('dateInput.prevMonth')} onClick={() => moveMonth(-1)}>
              <Icon name="chevronLeft" />
            </button>
            <span className="calendar__title" aria-live="polite">{MONTHS[m]} {y}</span>
            <button type="button" className="icon-btn" aria-label={t('dateInput.nextMonth')} onClick={() => moveMonth(1)}>
              <Icon name="chevronRight" />
            </button>
          </div>
          <div className="calendar__grid" role="grid" ref={gridRef} onKeyDown={onGridKey}>
            {WEEKDAYS.map((w, i) => (
              <span key={w} className="calendar__dow" role="columnheader" title={WEEKDAYS_FULL[i]}>{w}</span>
            ))}
            {Array.from({ length: days.lead }, (_, i) => <span key={`l${i}`} />)}
            {Array.from({ length: days.count }, (_, i) => {
              const iso = toIso(y, m, i + 1)
              const disabled = outOfRange(iso)
              return (
                <button
                  key={iso}
                  type="button"
                  data-iso={iso}
                  role="gridcell"
                  tabIndex={iso === cursor ? 0 : -1}
                  aria-selected={iso === value}
                  aria-current={iso === today ? 'date' : undefined}
                  aria-label={t('dateInput.day', { day: i + 1, month: MONTHS[m], year: y })}
                  disabled={disabled}
                  className={`calendar__day ${iso === value ? 'is-selected' : ''} ${iso === today ? 'is-today' : ''}`}
                  onClick={() => pick(iso)}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
          <div className="calendar__foot">
            <button type="button" className="link-btn" disabled={outOfRange(today)} onClick={() => pick(today)}>{t('dateInput.today')}</button>
            {clearable && value && (
              <button type="button" className="link-btn" onClick={() => { onChange(''); setOpen(false) }}>{t('common.clear')}</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
