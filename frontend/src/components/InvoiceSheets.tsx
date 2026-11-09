import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../api'
import type { Client, Unit, UnitCode } from '../api/types'
import { calcLine, fmt2, fmtMoney, fmtPack, parseNum } from '../lib/format'
import { Icon } from './Icon'
import { ColourChips } from './ColourChips'
import { loadProducts, type PickOption } from '../lib/productPick'
import { Sheet, SheetSearch, Stepper } from './Sheet'

/** Results of a search typed into a sheet; waits a moment after typing before asking the server. */
function useSearch<T>(query: string, load: (q: string) => Promise<T[]>) {
  const [result, setResult] = useState<{ query: string; items: T[] } | null>(null)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })
  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      loadRef.current(query)
        .then((items) => alive && setResult({ query, items }))
        .catch(() => alive && setResult({ query, items: [] }))
    }, query ? 200 : 0)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query])
  return { items: result?.items ?? null, stale: result !== null && result.query !== query }
}

/** Phone: pick the invoice's client from a full-screen searchable list. */
export function ClientSheet({ onPick, onNew, onClose }: {
  onPick: (c: Client) => void
  onNew: () => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const { items, stale } = useSearch(query, (q) => api.clients.list({ q, size: 40 }).then((p) => p.items))
  return (
    <Sheet title="Клиентті таңдау" onClose={onClose}>
      <SheetSearch value={query} onChange={setQuery} placeholder="Аты, телефоны немесе елді мекені" />
      <button type="button" className="sheet-new" onClick={onNew}>
        <Icon name="plus" />Жаңа клиент
      </button>
      <PickList loading={!items} stale={stale} empty={items?.length === 0 ? 'Клиент табылмады' : null}>
        {items?.map((c) => (
          <li key={c.id}>
            <button type="button" className="pick-row" onClick={() => onPick(c)}>
              <span className="pick-row__main">{c.label}</span>
              {(c.place || c.phone) && <span className="pick-row__sub">{[c.place, c.phone].filter(Boolean).join(' · ')}</span>}
            </button>
          </li>
        ))}
      </PickList>
    </Sheet>
  )
}

function PickList({ loading, stale, empty, children }: {
  loading: boolean
  stale: boolean
  empty: string | null
  children: ReactNode
}) {
  if (loading) return <p className="muted sheet-msg">Жүктелуде…</p>
  if (empty) return <p className="muted sheet-msg">{empty}</p>
  return <ul className={`pick-list ${stale ? 'is-stale' : ''}`}>{children}</ul>
}

export interface LineDraft {
  pick: PickOption
  price: number
  quantity: number
  discount: number | null
  unit: UnitCode
}

/**
 * Phone: add a product (search, then quantity) or change an existing line.
 * Price, unit and discount are tucked under «Қосымша»: they rarely change from the price list.
 */
export function ProductSheet({ units, initial, onSubmit, onDelete, onClose }: {
  units: Unit[]
  /** The line being changed; without it the sheet adds a new one. */
  initial?: LineDraft
  /** {@code again}: keep the sheet open for the next product. */
  onSubmit: (line: LineDraft, again: boolean) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [pick, setPick] = useState<PickOption | null>(initial?.pick ?? null)
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '1')
  const [price, setPrice] = useState(initial ? String(initial.price) : '')
  const [discount, setDiscount] = useState(initial?.discount ? String(initial.discount) : '')
  const [unit, setUnit] = useState<UnitCode>(initial?.unit ?? 'SHT')
  const [error, setError] = useState<string | null>(null)
  const extrasChanged = !!initial && (!!initial.discount || initial.unit !== 'SHT' || initial.price !== initial.pick.opt.price)

  const choose = (o: PickOption) => {
    setPick(o)
    setPrice(String(o.opt.price))
    setError(null)
  }

  const p = parseNum(price)
  const q = parseNum(quantity)
  const d = parseNum(discount)
  const calc = p !== null && q !== null && q > 0 ? calcLine(p, q, d) : null

  const submit = (again: boolean) => {
    if (!pick) return
    if (q === null || q <= 0) return setError('Санын көрсетіңіз')
    if (p === null || p < 0) return setError('Бағасын көрсетіңіз')
    if (d !== null && (d < 0 || d > 100)) return setError('Жеңілдік 0–100 аралығында болуы керек')
    onSubmit({ pick, price: p, quantity: q, discount: d, unit }, again)
    if (again) {
      setPick(null)
      setQuantity('1')
      setDiscount('')
      setUnit('SHT')
    }
  }

  if (!pick) {
    return <ProductSearch onChoose={choose} onClose={onClose} onBack={initial ? () => setPick(initial.pick) : undefined} />
  }

  return (
    <Sheet
      title={initial ? 'Тауар жолы' : 'Тауар қосу'}
      onClose={onClose}
      onBack={initial ? undefined : () => setPick(null)}
      footer={
        <>
          <button type="button" className="btn btn--primary btn--lg" onClick={() => submit(false)}>
            {initial ? 'Сақтау' : <><Icon name="plus" />Қосу{calc ? ` · ${fmt2(calc.total)} ₸` : ''}</>}
          </button>
          {!initial && (
            <button type="button" className="btn btn--outline btn--lg" onClick={() => submit(true)} aria-label="Қосып, тағы тауар таңдау">
              Тағы
            </button>
          )}
        </>
      }
    >
      <div className="pick-detail">
        <div className="pick-detail__head">
          <div>
            <div className="pick-detail__name">{pick.label}</div>
            <div className="pick-detail__meta">
              {[`${fmtMoney(pick.opt.price)} ₸`, fmtPack(pick.opt.packAmount, pick.opt.packUnit), pick.opt.categoryName].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button type="button" className="btn btn--ghost btn--s" onClick={() => setPick(null)}>Ауыстыру</button>
        </div>
        <div className="pick-detail__qty">
          <span className="stack__label">Саны, {units.find((u) => u.value === unit)?.label ?? unit}</span>
          <Stepper value={quantity} onChange={(v) => { setQuantity(v); setError(null) }} />
        </div>
        {error && <p className="field__error" role="alert">{error}</p>}
        {/* Below the quantity: a long colour list loads late and must not push the stepper away */}
        {pick.opt.variantId && (
          <ColourChips productId={pick.opt.productId} selectedVariantId={pick.opt.variantId} onPick={choose} />
        )}

        <details className="pick-more" open={extrasChanged}>
          <summary>Бағасы, бірлігі, жеңілдік</summary>
          <div className="pick-more__grid">
            <label className="stack">
              <span className="stack__label">Бағасы, ₸</span>
              <input className="input num-input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label className="stack">
              <span className="stack__label">Бірлігі</span>
              <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as UnitCode)}>
                {units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </label>
            <label className="stack">
              <span className="stack__label">Жеңілдік, %</span>
              <input className="input num-input" inputMode="decimal" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </label>
          </div>
        </details>

        {onDelete && (
          <button type="button" className="btn btn--ghost pick-detail__delete" onClick={onDelete}>
            <Icon name="trash" />Жолды жою
          </button>
        )}
      </div>
    </Sheet>
  )
}

function ProductSearch({ onChoose, onClose, onBack }: {
  onChoose: (o: PickOption) => void
  onClose: () => void
  onBack?: () => void
}) {
  const [query, setQuery] = useState('')
  const { items, stale } = useSearch(query, loadProducts)
  return (
    <Sheet title="Тауар таңдау" onClose={onClose} onBack={onBack}>
      <SheetSearch value={query} onChange={setQuery} placeholder="Атауы немесе түсі: «статус ақ»" autoFocus />
      <PickList loading={!items} stale={stale} empty={items?.length === 0 ? 'Тауар табылмады' : null}>
        {items?.map((o) => (
          <li key={o.id}>
            <button type="button" className="pick-row" onClick={() => onChoose(o)}>
              <span className="pick-row__main">{o.label}</span>
              <span className="pick-row__sub">
                <b>{fmtMoney(o.opt.price)} ₸</b>
                {[fmtPack(o.opt.packAmount, o.opt.packUnit), o.opt.categoryName].filter(Boolean).map((x) => ` · ${x}`)}
              </span>
            </button>
          </li>
        ))}
      </PickList>
    </Sheet>
  )
}
