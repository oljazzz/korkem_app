import { useEffect, useRef, useState } from 'react'

export interface Option {
  id: number
  label: string
}

interface Props<T extends Option> {
  value: Option | null
  onChange: (option: T | null) => void
  load: (query: string) => Promise<T[]>
  placeholder?: string
  autoFocus?: boolean
  invalid?: boolean
}

/** Searchable select: loads options from the server as the user types. */
export function AsyncSelect<T extends Option>({ value, onChange, load, placeholder, autoFocus, invalid }: Props<T>) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [options, setOptions] = useState<T[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const loadRef = useRef(load)
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
    onChange(o)
    setOpen(false)
    setText('')
  }

  return (
    <div className="combo" ref={boxRef}>
      <div className={`combo__control ${invalid ? 'is-invalid' : ''}`}>
        <input
          className="combo__input"
          value={open ? text : (value?.label ?? '')}
          placeholder={open ? (value?.label ?? placeholder) : placeholder}
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
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
            }
          }}
        />
        {value && (
          <button type="button" className="combo__clear" title="Тазалау" onClick={() => onChange(null)}>×</button>
        )}
        <span className="combo__arrow" onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o) }}>▾</span>
      </div>
      {open && (
        <ul className="combo__list" role="listbox">
          {loading && options.length === 0 && <li className="combo__empty">Жүктелуде…</li>}
          {!loading && options.length === 0 && <li className="combo__empty">Ештеңе табылмады</li>}
          {options.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={value?.id === o.id}
              className={`combo__option ${i === active ? 'is-active' : ''} ${value?.id === o.id ? 'is-selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o)
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
