import { useEffect, useId, useRef, useState, type RefObject } from 'react'

export interface Option {
  id: number
  label: string
  /** Secondary text shown on the right of an option (e.g. price, category). */
  hint?: string
}

interface Props<T extends Option> {
  value: Option | null
  onChange: (option: T | null) => void
  load: (query: string) => Promise<T[]>
  placeholder?: string
  autoFocus?: boolean
  invalid?: boolean
  /** Lets the parent move focus into the field (e.g. back to it after adding a line). */
  inputRef?: RefObject<HTMLInputElement | null>
  ariaLabel?: string
}

/** Searchable select (ARIA combobox): loads options from the server as the user types. */
export function AsyncSelect<T extends Option>({
  value, onChange, load, placeholder, autoFocus, invalid, inputRef, ariaLabel,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [options, setOptions] = useState<T[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const loadRef = useRef(load)
  const listId = useId()
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      loadRef.current(text)
        .then((opts) => {
          if (!cancelled) {
            setOptions(opts)
            setActive(0)
          }
        })
        .finally(() => !cancelled && setLoading(false))
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [text, open])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (o: T) => {
    setOpen(false)
    setText('')
    onChange(o)
  }

  const activeId = open && options[active] ? `${listId}-${active}` : undefined

  return (
    <div className="combo" ref={boxRef}>
      <div className={`combo__control ${invalid ? 'is-invalid' : ''}`}>
        <input
          ref={inputRef}
          className="combo__input"
          role="combobox"
          aria-label={ariaLabel ?? placeholder}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={invalid || undefined}
          value={open ? text : (value?.label ?? '')}
          placeholder={open ? (value?.label ?? placeholder) : placeholder}
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((a) => Math.min(a + 1, options.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter' && open && options[active]) {
              e.preventDefault()
              pick(options[active])
            } else if (e.key === 'Escape' && open) {
              e.stopPropagation()
              setOpen(false)
            } else if (e.key === 'Tab') {
              setOpen(false)
            }
          }}
        />
        {value && (
          <button type="button" className="combo__clear" title="Тазалау" aria-label="Тазалау" onClick={() => onChange(null)}>×</button>
        )}
        <span className="combo__arrow" aria-hidden="true" onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o) }}>▾</span>
      </div>
      {open && (
        <ul className="combo__list" role="listbox" id={listId}>
          {loading && options.length === 0 && <li className="combo__empty">Жүктелуде…</li>}
          {!loading && options.length === 0 && <li className="combo__empty">Ештеңе табылмады</li>}
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={value?.id === o.id}
              className={`combo__option ${i === active ? 'is-active' : ''} ${value?.id === o.id ? 'is-selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o)
              }}
            >
              <span className="combo__label">{o.label}</span>
              {o.hint && <span className="combo__hint">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
