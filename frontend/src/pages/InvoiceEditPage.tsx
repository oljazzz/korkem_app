import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, type InvoiceRequest } from '../api'
import { ApiError } from '../api/http'
import type { Category, Invoice, InvoiceLine, Product, Unit, UnitCode } from '../api/types'
import { AsyncSelect, type Option } from '../components/AsyncSelect'
import { DateInput } from '../components/DateInput'
import { Field } from '../components/Field'
import { Icon } from '../components/Icon'
import { Alert } from '../components/Alert'
import { ConfirmModal, Modal } from '../components/Modal'
import { PaymentsPanel, type PaymentState } from '../components/PaymentsPanel'
import { useToast } from '../components/Toast'
import { calcLine, fmt, fmt2, fmtDate, fmtMoney, isoDay, parseNum } from '../lib/format'
import { useUnsavedGuard } from '../lib/useUnsavedGuard'
import { ClientForm } from './ClientsPage'

type Line = InvoiceLine & { key: number }
type ProductOption = Option & { product: Product }
let keySeq = 1

const loadProducts = (text: string, categoryId: number | null = null): Promise<ProductOption[]> =>
  api.products.list({ q: text, categoryId, size: 30 }).then((pg) =>
    pg.items.map((pr) => ({
      id: pr.id,
      label: pr.name,
      hint: `${fmtMoney(pr.price)} ₸${pr.categoryName ? ` · ${pr.categoryName}` : ''}`,
      product: pr,
    })),
  )

export function InvoiceEditPage() {
  const { id } = useParams()
  const isNew = id === undefined
  const navigate = useNavigate()
  const toast = useToast()

  const [number, setNumber] = useState<number | null>(null)
  const [client, setClient] = useState<Option | null>(null)
  const [today] = useState(() => isoDay(new Date()))
  const [date, setDate] = useState(today)
  const [lines, setLines] = useState<Line[]>([])
  const [editingLine, setEditingLine] = useState<Line | null>(null)
  const [deleting, setDeleting] = useState<Line | null>(null)
  const [newClient, setNewClient] = useState(false)
  const [units, setUnits] = useState<Unit[]>([{ value: 'SHT', label: 'дана' }])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { blocker, allowNextNavigation } = useUnsavedGuard(dirty)
  const [searchParams] = useSearchParams()
  const [payment, setPayment] = useState<PaymentState | null>(null)
  const [last, setLast] = useState<{ clientId: number; invoice: Invoice | null } | null>(null)
  const [confirmRepeat, setConfirmRepeat] = useState(false)
  const autoRepeat = useRef(isNew && searchParams.get('repeat') === '1')

  useEffect(() => {
    api.invoices.units().then(setUnits).catch(() => undefined)
    api.categories.all().then(setCategories).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (isNew) return
    api.invoices
      .get(Number(id))
      .then((inv) => {
        setNumber(inv.number)
        setDate(isoDay(new Date(inv.createdAt)))
        setClient(inv.clientId ? { id: inv.clientId, label: inv.clientLabel ?? inv.clientName ?? '' } : null)
        setLines(inv.lines.map((l) => ({ ...l, key: keySeq++ })))
        setPayment(paymentState(inv))
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  // New invoice opened from a client card: preselect the client
  useEffect(() => {
    const clientId = Number(searchParams.get('client'))
    if (!isNew || !clientId) return
    api.clients.get(clientId).then((c) => setClient({ id: c.id, label: c.label })).catch(() => undefined)
  }, [isNew, searchParams])

  // The selected client's latest invoice, offered for repeating on a new invoice
  const lastInvoice = isNew && client && last?.clientId === client.id ? last.invoice : null
  useEffect(() => {
    if (!isNew || !client) return
    let alive = true
    const clientId = client.id
    api.clients.lastInvoice(clientId)
      .then((inv) => alive && setLast({ clientId, invoice: inv }))
      .catch(() => alive && setLast({ clientId, invoice: null }))
    return () => {
      alive = false
    }
  }, [isNew, client])

  /** Copies the last invoice's lines at today's price-list prices. */
  const repeatLast = useCallback(async () => {
    if (!lastInvoice) return
    setConfirmRepeat(false)
    const prices = await Promise.all(
      lastInvoice.lines.map((l) => (l.productId ? api.products.get(l.productId).then((p) => p.price).catch(() => l.price) : Promise.resolve(l.price))),
    )
    let changed = 0
    const copied = lastInvoice.lines.map((l, i) => {
      const price = prices[i]
      if (price !== l.price) changed++
      const calc = calcLine(price, l.quantity, l.discount)
      return { ...l, id: null, key: keySeq++, price, total: calc.total }
    })
    setLines(copied)
    setDirty(true)
    toast.show(`№ ${lastInvoice.number} жүкқұжатынан ${copied.length} тауар көшірілді${changed ? `, ${changed} тауардың бағасы жаңарды` : ''}`)
  }, [lastInvoice, toast])

  useEffect(() => {
    if (autoRepeat.current && lastInvoice) {
      autoRepeat.current = false
      repeatLast()
    }
  }, [lastInvoice, repeatLast])

  const reloadPayment = () => {
    if (!isNew) api.invoices.get(Number(id)).then((inv) => setPayment(paymentState(inv))).catch(() => undefined)
  }

  const totals = useMemo(
    () => ({ total: lines.reduce((sum, l) => sum + l.total, 0) }),
    [lines],
  )
  const unpriced = lines.filter((l) => l.price === 0).length
  const nextSort = lines.reduce((m, l) => Math.max(m, l.sortOrder ?? 0), 0) + 1
  const unitLabel = (u: UnitCode) => units.find((x) => x.value === u)?.label ?? u

  const missing = [!client && 'клиентті таңдаңыз', lines.length === 0 && 'кемінде бір тауар қосыңыз'].filter(Boolean)
  const canSave = missing.length === 0 && !busy

  const save = useCallback(async (): Promise<number | null> => {
    if (!client || lines.length === 0) return null
    setBusy(true)
    setError(null)
    const body: InvoiceRequest = {
      clientId: client.id,
      date,
      lines: lines.map((l) => ({
        categoryId: l.categoryId,
        productId: l.productId,
        productName: l.productName,
        unit: l.unit,
        price: l.price,
        quantity: l.quantity,
        discount: l.discount,
        sortOrder: l.sortOrder,
      })),
    }
    try {
      const saved = isNew ? await api.invoices.create(body) : await api.invoices.update(Number(id), body)
      setDirty(false)
      setPayment(paymentState(saved))
      return saved.id
    } catch (e) {
      const err = e as ApiError
      setError(Object.values(err.fields).join('; ') || err.message)
      return null
    } finally {
      setBusy(false)
    }
  }, [client, date, lines, isNew, id])

  const ok = useCallback(async () => {
    if ((await save()) !== null) {
      allowNextNavigation()
      navigate('/invoices')
      toast.show('Жүкқұжат сақталды')
    }
  }, [save, allowNextNavigation, navigate, toast])

  const report = async () => {
    const savedId = dirty || isNew ? await save() : Number(id)
    if (savedId !== null) {
      allowNextNavigation()
      navigate(`/invoices/${savedId}/print`)
    }
  }

  // Ctrl/⌘+S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (canSave) ok()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canSave, ok])

  const upsertLine = (line: Line) => {
    setLines((ls) => (ls.some((l) => l.key === line.key) ? ls.map((l) => (l.key === line.key ? line : l)) : [...ls, line]))
    setEditingLine(null)
    setDirty(true)
  }

  if (loading) return <section className="page"><p className="muted">Жүктелуде…</p></section>

  return (
    <section className="page page--editor">
      <div className="breadcrumbs">
        <Link to="/invoices">Жүкқұжаттар</Link> › {isNew ? 'Жаңа' : `№ ${number ?? ''}`}
      </div>
      <h1 className="page-title">{isNew ? 'Жаңа жүкқұжат' : `Жүкқұжат № ${number ?? ''}`}</h1>

      <div className="form-grid">
        <Field label="Күні">
          <DateInput
            value={date}
            max={today}
            clearable={false}
            ariaLabel="Жүкқұжат күні"
            onChange={(v) => {
              if (!v) return
              setDate(v)
              setDirty(true)
            }}
          />
        </Field>
        <Field label="Клиент" required>
          <div className="inline">
            <AsyncSelect
              value={client}
              placeholder="Клиентті таңдаңыз"
              autoFocus={isNew && !searchParams.get('client')}
              onChange={(o) => {
                setClient(o)
                setDirty(true)
              }}
              load={(q) =>
                api.clients.list({ q, size: 30 }).then((p) =>
                  p.items.map((c) => ({ id: c.id, label: c.label, hint: [c.place, c.phone].filter(Boolean).join(' · ') || undefined })))
              }
            />
            <button className="btn btn--outline btn--icon" title="Жаңа клиент" aria-label="Жаңа клиент" onClick={() => setNewClient(true)}>
              <Icon name="plus" />
            </button>
          </div>
        </Field>
        {lastInvoice && (
          <div className="repeat-bar">
            <Icon name="repeat" />
            <span>
              Соңғы жүкқұжаты: <b>№ {lastInvoice.number}</b> · {fmtDate(lastInvoice.createdAt)} · {lastInvoice.lines.length} тауар ·{' '}
              {fmtMoney(lastInvoice.total)} ₸
            </span>
            <button className="btn btn--outline btn--s" onClick={() => (lines.length ? setConfirmRepeat(true) : repeatLast())}>
              Қайталау
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2 className="card__title">Тауарлар</h2>
          <span className="card__sub">{lines.length} позиция</span>
          {unpriced > 0 && (
            <span className="badge badge--warning">
              <Icon name="warning" size={14} />
              {unpriced} жолда бағасы көрсетілмеген
            </span>
          )}
        </div>

        <div className="table-wrap">
          <table className="table table--lines">
            <thead>
              <tr>
                <th className="num" style={{ width: 44 }}>№</th>
                <th>Тауар</th>
                <th className="num">Бағасы</th>
                <th className="num">Саны</th>
                <th>Бірлік</th>
                <th className="num">Жеңілдік</th>
                <th className="num">Сомасы</th>
                <th aria-label="Әрекеттер" style={{ width: 96 }} />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr><td colSpan={8} className="table__msg">Төмендегі жолақтан тауар қосыңыз: атауын жазып, санын енгізіп, Enter басыңыз</td></tr>
              )}
              {lines.map((l, i) => (
                <tr key={l.key} className={l.price === 0 ? 'is-unpriced' : undefined} onDoubleClick={() => setEditingLine(l)}>
                  <td className="num muted-cell line-no">{i + 1}</td>
                  <td className="strong line-name">{l.productName}</td>
                  {/* Phones: one compact "qty × price" line instead of four columns */}
                  <td className="line-calc">
                    {fmt(l.quantity)} {unitLabel(l.unit)} × {l.price === 0 ? <span className="price-missing"><Icon name="warning" size={14} />0</span> : fmtMoney(l.price)} ₸
                    {l.discount ? ` · −${fmt(l.discount)}%` : ''}
                  </td>
                  <td className="num line-col">
                    {l.price === 0 ? (
                      <span className="price-missing" title="Бағасы көрсетілмеген">
                        <Icon name="warning" size={14} />0
                      </span>
                    ) : fmtMoney(l.price)}
                  </td>
                  <td className="num line-col">{fmt(l.quantity)}</td>
                  <td className="line-col">{unitLabel(l.unit)}</td>
                  <td className="num line-col">{l.discount ? `${fmt(l.discount)}%` : ''}</td>
                  <td className="num strong line-total">{fmtMoney(l.total)}</td>
                  <td className="row-actions">
                    <button className="icon-btn" title="Өзгерту" aria-label={`«${l.productName}» өзгерту`} onClick={() => setEditingLine(l)}>
                      <Icon name="edit" />
                    </button>
                    <button className="icon-btn icon-btn--danger" title="Жою" aria-label={`«${l.productName}» жою`} onClick={() => setDeleting(l)}>
                      <Icon name="trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={6} className="line-foot-label">Барлығы</td>
                  <td className="num line-foot-total">{fmtMoney(totals.total)}</td>
                  <td className="line-col" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <QuickAdd
          units={units}
          nextSort={nextSort}
          onAdd={(line) => {
            setLines((ls) => [...ls, line])
            setDirty(true)
          }}
        />
      </div>

      {!isNew && payment && (
        <PaymentsPanel
          invoiceId={Number(id)}
          state={payment}
          dirty={dirty}
          onChanged={reloadPayment}
        />
      )}

      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      <div className="editor-actions">
        <button className="btn btn--primary" onClick={ok} disabled={!canSave} title="Ctrl+S">Сақтау</button>
        <button className="btn btn--ghost" onClick={() => navigate('/invoices')}>Жабу</button>
        <button className="btn btn--outline editor-actions__print" onClick={report} disabled={!canSave && (dirty || isNew)}
          title="Қ-2 басып шығару" aria-label="Қ-2 басып шығару">
          <Icon name="print" /><span className="btn__label">Қ-2 басып шығару</span>
        </button>
        <span className="muted editor-actions__status" role="status">
          {missing.length > 0 ? `Сақтау үшін ${missing.join(' және ')}` : dirty ? 'Сақталмаған өзгерістер бар' : ''}
        </span>
        <div className="editor-total" aria-live="polite">
          <span className="editor-total__label">Барлығы</span>
          <span className="editor-total__value">{fmtMoney(totals.total)} ₸</span>
        </div>
      </div>

      {editingLine && (
        <LineForm
          line={editingLine}
          nextSort={nextSort}
          units={units}
          categories={categories}
          onClose={() => setEditingLine(null)}
          onSave={upsertLine}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Жолды жою"
          text={`«${deleting.productName}» жүкқұжаттан жойылсын ба?`}
          confirmLabel="Жою"
          cancelLabel="Болдырмау"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            setLines((ls) => ls.filter((l) => l.key !== deleting.key))
            setDeleting(null)
            setDirty(true)
          }}
        />
      )}
      {confirmRepeat && lastInvoice && (
        <ConfirmModal
          title="Соңғы жүкқұжатты қайталау"
          text={`Қазіргі ${lines.length} тауар № ${lastInvoice.number} жүкқұжатының тауарларымен ауыстырылсын ба?`}
          confirmLabel="Ауыстыру"
          cancelLabel="Болдырмау"
          onConfirm={repeatLast}
          onClose={() => setConfirmRepeat(false)}
        />
      )}
      {newClient && (
        <ClientForm
          client={null}
          onClose={() => setNewClient(false)}
          onSaved={(c) => {
            setClient({ id: c.id, label: c.label })
            setNewClient(false)
            setDirty(true)
          }}
        />
      )}
      {blocker.state === 'blocked' && (
        <ConfirmModal
          title="Сақталмаған өзгерістер"
          text="Жүкқұжатқа енгізген өзгерістер сақталмаған. Сақтамай шығасыз ба?"
          confirmLabel="Сақтамай шығу"
          cancelLabel="Қалу"
          danger
          onConfirm={() => blocker.proceed()}
          onClose={() => blocker.reset()}
        />
      )}
    </section>
  )
}

function paymentState(inv: Invoice): PaymentState {
  return { total: inv.total, paid: inv.paid, due: inv.due, status: inv.status, legacyPaid: inv.legacyPaid }
}

/** Inline entry bar: product → quantity → Enter adds the line and returns focus to the product field. */
function QuickAdd({ units, nextSort, onAdd }: {
  units: Unit[]
  nextSort: number
  onAdd: (line: Line) => void
}) {
  const [product, setProduct] = useState<ProductOption | null>(null)
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [discount, setDiscount] = useState('')
  const [unit, setUnit] = useState<UnitCode>('SHT')
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const productRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  const p = parseNum(price)
  const q = parseNum(quantity)
  const d = parseNum(discount)
  const calc = p !== null && q !== null ? calcLine(p, q, d) : null

  const add = () => {
    const errs = {
      product: !product,
      price: p === null || p < 0,
      quantity: q === null || q <= 0,
      discount: d !== null && (d < 0 || d > 100),
    }
    setErrors(errs)
    if (Object.values(errs).some(Boolean) || !product || !calc) {
      if (errs.product) productRef.current?.focus()
      else if (errs.quantity) qtyRef.current?.focus()
      return
    }
    onAdd({
      key: keySeq++,
      id: null,
      categoryId: product.product.categoryId,
      categoryName: product.product.categoryName,
      productId: product.product.id,
      productName: product.label,
      unit,
      price: p!,
      quantity: q!,
      discount: d,
      total: calc.total,
      sortOrder: nextSort,
    })
    setProduct(null)
    setPrice('')
    setQuantity('')
    setDiscount('')
    setErrors({})
    productRef.current?.focus()
  }

  const onEnter = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      add()
    }
  }

  return (
    <div className="quick-add" role="group" aria-label="Тауар қосу">
      <label className="quick-add__product stack">
        <span className="stack__label">Тауар</span>
        <AsyncSelect<ProductOption>
          value={product}
          inputRef={productRef}
          invalid={errors.product}
          placeholder="Атауын жаза бастаңыз…"
          ariaLabel="Тауар"
          onChange={(o) => {
            setProduct(o)
            if (o) {
              setPrice(String(o.product.price))
              setErrors((x) => ({ ...x, product: false }))
              requestAnimationFrame(() => qtyRef.current?.focus())
            }
          }}
          load={(text) => loadProducts(text)}
        />
      </label>
      <label className="stack">
        <span className="stack__label">Бағасы</span>
        <input className={`input num-input ${errors.price ? 'is-invalid' : ''}`} inputMode="decimal" value={price}
          onChange={(e) => setPrice(e.target.value)} onKeyDown={onEnter} />
      </label>
      <label className="stack">
        <span className="stack__label">Саны</span>
        <input ref={qtyRef} className={`input num-input ${errors.quantity ? 'is-invalid' : ''}`} inputMode="decimal"
          value={quantity} onChange={(e) => setQuantity(e.target.value)} onKeyDown={onEnter}
          onFocus={(e) => e.target.select()} />
      </label>
      <label className="stack">
        <span className="stack__label">Бірлік</span>
        <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as UnitCode)}>
          {units.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
      </label>
      <label className="stack">
        <span className="stack__label">Жеңілдік, %</span>
        <input className={`input num-input ${errors.discount ? 'is-invalid' : ''}`} inputMode="decimal" value={discount}
          onChange={(e) => setDiscount(e.target.value)} onKeyDown={onEnter} placeholder="0" />
      </label>
      <div className="stack quick-add__sum">
        <span className="stack__label">Сомасы</span>
        <span className="quick-add__total">{calc ? `${fmt2(calc.total)} ₸` : '—'}</span>
      </div>
      <button className="btn btn--primary quick-add__btn" onClick={add}>
        <Icon name="plus" />Қосу
      </button>
    </div>
  )
}

/** Edits an existing line (opened from the row's edit button or by double-click). */
function LineForm({ line, nextSort, units, categories, onClose, onSave }: {
  line: Line
  nextSort: number
  units: Unit[]
  categories: Category[]
  onClose: () => void
  onSave: (l: Line) => void
}) {
  const [categoryId, setCategoryId] = useState<number | null>(line.categoryId ?? null)
  const [product, setProduct] = useState<Option | null>({ id: line.productId ?? -1, label: line.productName })
  const [productId, setProductId] = useState<number | null>(line.productId ?? null)
  const [unit, setUnit] = useState<UnitCode>(line.unit ?? 'SHT')
  const [price, setPrice] = useState(line.price?.toString() ?? '')
  const [quantity, setQuantity] = useState(line.quantity?.toString() ?? '')
  const [discount, setDiscount] = useState(line.discount?.toString() ?? '')
  const [sortOrder, setSortOrder] = useState((line.sortOrder ?? nextSort).toString())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const qtyRef = useRef<HTMLInputElement>(null)

  const p = parseNum(price)
  const q = parseNum(quantity)
  const d = parseNum(discount)
  const calc = p !== null && q !== null ? calcLine(p, q, d) : null

  const submit = () => {
    const errs: Record<string, string> = {}
    if (!product) errs.product = 'Тауарды таңдаңыз'
    if (p === null || p < 0) errs.price = 'Бағасын көрсетіңіз'
    if (q === null || q <= 0) errs.quantity = 'Санын көрсетіңіз'
    if (d !== null && (d < 0 || d > 100)) errs.discount = '0–100 аралығында'
    setErrors(errs)
    if (Object.keys(errs).length || !calc || !product) return
    onSave({
      ...line,
      categoryId,
      categoryName: categories.find((c) => c.id === categoryId)?.name ?? null,
      productId,
      productName: product.label,
      unit,
      price: p!,
      quantity: q!,
      discount: d,
      total: calc.total,
      sortOrder: parseNum(sortOrder),
    })
  }

  return (
    <Modal
      title="Тауар жолы"
      width={520}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={submit}>Сақтау</button>
          <button className="btn btn--ghost" onClick={onClose}>Болдырмау</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit() }}>
        <Field label="Тауар" required error={errors.product}>
          <AsyncSelect<ProductOption>
            value={product}
            invalid={!!errors.product}
            placeholder="Атауын жаза бастаңыз"
            onChange={(o) => {
              setProduct(o)
              setProductId(o?.product.id ?? null)
              if (o) {
                setPrice(o.product.price.toString())
                setCategoryId(o.product.categoryId)
                requestAnimationFrame(() => qtyRef.current?.focus())
              }
            }}
            load={(text) => loadProducts(text, categoryId)}
          />
        </Field>
        <Field label="Саны" required error={errors.quantity}>
          <input ref={qtyRef} className="input" inputMode="decimal" autoFocus value={quantity}
            onChange={(e) => setQuantity(e.target.value)} onFocus={(e) => e.target.select()} />
        </Field>
        <Field label="Бағасы" required error={errors.price}>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Өлшем бірлігі">
          <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as UnitCode)}>
            {units.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Жеңілдік (%)" error={errors.discount}>
          <input className="input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label="Санат">
          <select className="input" value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Реті">
          <input className="input" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        <div className="line-summary">
          <span>Сомасы: <b>{calc ? `${fmt2(calc.total)} ₸` : '—'}</b></span>
        </div>
        <button hidden />
      </form>
    </Modal>
  )
}
