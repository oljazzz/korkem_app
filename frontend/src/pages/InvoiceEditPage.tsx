import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, type InvoiceRequest } from '../api'
import { ApiError } from '../api/http'
import type { Category, Invoice, InvoiceLine, Unit, UnitCode } from '../api/types'
import { AsyncSelect, type Option } from '../components/AsyncSelect'
import { DateInput } from '../components/DateInput'
import { Field } from '../components/Field'
import { Icon } from '../components/Icon'
import { Alert } from '../components/Alert'
import { ConfirmModal, Modal } from '../components/Modal'
import { PaymentsPanel, type PaymentState } from '../components/PaymentsPanel'
import { useToast } from '../components/Toast'
import { ColourChips } from '../components/ColourChips'
import { loadProducts, type PickOption } from '../lib/productPick'
import { ClientSheet, ProductSheet, type LineDraft } from '../components/InvoiceSheets'
import { Stepper } from '../components/Sheet'
import { SortableCard, SortableList, SortableRow } from '../components/Sortable'
import { useNarrow } from '../lib/useNarrow'
import { calcLine, fmt, fmt2, fmtDate, fmtMoney, isoDay, numericInput, parseNum } from '../lib/format'
import { useUnsavedGuard } from '../lib/useUnsavedGuard'
import { ClientForm } from './ClientsPage'
import { useTranslation } from 'react-i18next'

type Line = InvoiceLine & { key: number }
let keySeq = 1

/** Invoice line from what was picked in the phone sheet; keeps the line's key and order when changing one. */
function draftToLine(d: LineDraft, base: { key: number; sortOrder?: number | null; id?: number | null }): Line {
  return {
    key: base.key,
    id: base.id ?? null,
    sortOrder: base.sortOrder ?? null,
    categoryId: d.pick.opt.categoryId,
    categoryName: d.pick.opt.categoryName,
    productId: d.pick.opt.productId || null,
    variantId: d.pick.opt.variantId,
    productName: d.pick.label,
    unit: d.unit,
    price: d.price,
    quantity: d.quantity,
    discount: d.discount,
    total: calcLine(d.price, d.quantity, d.discount).total,
  }
}

function lineToDraft(l: Line): LineDraft {
  return {
    pick: {
      id: l.variantId ? -l.variantId : l.productId ?? 0,
      label: l.productName,
      opt: {
        productId: l.productId ?? 0, variantId: l.variantId ?? null, label: l.productName, productName: l.productName,
        variantName: null, price: l.price, packAmount: null, packUnit: null,
        categoryId: l.categoryId ?? null, categoryName: l.categoryName ?? null,
      },
    },
    price: l.price,
    quantity: l.quantity,
    discount: l.discount ?? null,
    unit: l.unit,
  }
}

export function InvoiceEditPage() {
  const { id } = useParams()
  const isNew = id === undefined
  const { t } = useTranslation()
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
  const [units, setUnits] = useState<Unit[]>([{ value: 'SHT', label: t('invoiceEdit.pieces') }])
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
  const phone = useNarrow()
  const [clientSheet, setClientSheet] = useState(false)
  // Phone: the product sheet, adding a new line ('new') or changing one
  const [productSheet, setProductSheet] = useState<'new' | Line | null>(null)

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
      lastInvoice.lines.map((l) =>
        l.productId
          ? api.products.get(l.productId)
            .then((p) => p.variants.find((v) => v.id === l.variantId)?.price ?? p.price)
            .catch(() => l.price)
          : Promise.resolve(l.price),
      ),
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
    toast.show(changed
      ? t('invoiceEdit.repeatedPrices', { number: lastInvoice.number, count: copied.length, changed })
      : t('invoiceEdit.repeated', { number: lastInvoice.number, count: copied.length }))
  }, [lastInvoice, toast, t])

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

  const missing = [!client && t('invoiceEdit.missingClient'), lines.length === 0 && t('invoiceEdit.missingLines')].filter(Boolean)
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
        variantId: l.variantId ?? null,
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
      toast.show(t('invoiceEdit.saved'))
    }
  }, [save, allowNextNavigation, navigate, toast, t])

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

  /** New order from drag and drop; numbering follows it, so print and save keep it. */
  const reorder = (next: Line[]) => {
    setLines(next.map((l, i) => ({ ...l, sortOrder: i + 1 })))
    setDirty(true)
  }

  const setQuantity = (line: Line, quantity: number) => {
    setLines((ls) => ls.map((l) => (l.key === line.key ? { ...l, quantity, total: calcLine(l.price, quantity, l.discount).total } : l)))
    setDirty(true)
  }

  const upsertLine = (line: Line) => {
    setLines((ls) => (ls.some((l) => l.key === line.key) ? ls.map((l) => (l.key === line.key ? line : l)) : [...ls, line]))
    setEditingLine(null)
    setDirty(true)
  }

  if (loading) return <section className="page"><p className="muted">{t('common.loading')}</p></section>

  return (
    <section className="page page--editor">
      <div className="breadcrumbs">
        <Link to="/invoices">{t('invoiceEdit.breadcrumb')}</Link> › {isNew ? t('invoiceEdit.newCrumb') : t('invoiceEdit.number', { number: number ?? '' })}
      </div>
      <h1 className="page-title">{isNew ? t('invoiceEdit.newTitle') : t('invoiceEdit.title', { number: number ?? '' })}</h1>

      <div className="form-grid">
        <Field label={t('invoiceEdit.date')}>
          <DateInput
            value={date}
            max={today}
            clearable={false}
            ariaLabel={t('invoiceEdit.dateLabel')}
            onChange={(v) => {
              if (!v) return
              setDate(v)
              setDirty(true)
            }}
          />
        </Field>
        <Field label={t('invoiceEdit.client')} required>
          {phone ? (
            <button type="button" className={`client-card ${client ? '' : 'is-empty'}`} onClick={() => setClientSheet(true)}>
              <Icon name="client" />
              <span className="client-card__name">{client?.label ?? t('invoiceEdit.pickClient')}</span>
              <Icon name="chevronRight" />
            </button>
          ) : (
          <div className="inline">
            <AsyncSelect
              value={client}
              placeholder={t('invoiceEdit.pickClient')}
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
            <button className="btn btn--outline btn--icon" title={t('invoiceEdit.newClient')} aria-label={t('invoiceEdit.newClient')} onClick={() => setNewClient(true)}>
              <Icon name="plus" />
            </button>
          </div>
          )}
        </Field>
        {lastInvoice && (
          <div className="repeat-bar">
            <Icon name="repeat" />
            <span>
              {t('invoiceEdit.lastInvoice')} <b>№ {lastInvoice.number}</b> · {t('invoiceEdit.lastInvoiceMeta', { date: fmtDate(lastInvoice.createdAt), count: lastInvoice.lines.length })}{' '}
              {fmtMoney(lastInvoice.total)} ₸
            </span>
            <button className="btn btn--outline btn--s" onClick={() => (lines.length ? setConfirmRepeat(true) : repeatLast())}>
              {t('invoiceEdit.repeat')}
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2 className="card__title">{t('invoiceEdit.products')}</h2>
          <span className="card__sub">{t('invoiceEdit.positions', { count: lines.length })}</span>
          {unpriced > 0 && (
            <span className="badge badge--warning">
              <Icon name="warning" size={14} />
              {t('invoiceEdit.unpriced', { count: unpriced })}
            </span>
          )}
        </div>

        {phone ? (
          <SortableList items={lines} onMove={reorder}>
          <ul className="m-lines">
            {lines.length === 0 && <li className="m-lines__empty">{t('invoiceEdit.noLines')}</li>}
            {lines.map((l) => (
              <SortableCard key={l.key} id={l.key} className={`m-line ${l.price === 0 ? 'is-unpriced' : ''}`}>
                {(handle) => (<>
                {handle}
                <div className="m-line__body">
                <button type="button" className="m-line__main" onClick={() => setProductSheet(l)}>
                  <span className="m-line__name">{l.productName}</span>
                  <span className="m-line__calc">
                    {l.price === 0 ? <span className="price-missing"><Icon name="warning" size={14} />{t('invoiceEdit.noPrice')}</span> : `${fmtMoney(l.price)} ₸`}
                    {` / ${unitLabel(l.unit)}`}{l.discount ? ` · −${fmt(l.discount)}%` : ''}
                  </span>
                </button>
                <div className="m-line__foot">
                  <Stepper compact value={String(l.quantity)} label={t('invoiceEdit.lineQuantity', { name: l.productName })}
                    onChange={(v) => {
                      const q = parseNum(v)
                      if (q !== null && q > 0) setQuantity(l, q)
                    }} />
                  <span className="m-line__total">{fmtMoney(l.total)} ₸</span>
                </div>
                </div>
                </>)}
              </SortableCard>
            ))}
          </ul>
          </SortableList>
        ) : (
        <SortableList items={lines} onMove={reorder}>
        <div className="table-wrap">
          <table className="table table--lines">
            <thead>
              <tr>
                <th className="num" style={{ width: 64 }}>№</th>
                <th>{t('invoiceEdit.colProduct')}</th>
                <th className="num">{t('invoiceEdit.colPrice')}</th>
                <th className="num">{t('invoiceEdit.colQuantity')}</th>
                <th>{t('invoiceEdit.colUnit')}</th>
                <th className="num">{t('invoiceEdit.colDiscount')}</th>
                <th className="num">{t('invoiceEdit.colSum')}</th>
                <th aria-label={t('invoiceEdit.colActions')} style={{ width: 96 }} />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr><td colSpan={8} className="table__msg">{t('invoiceEdit.emptyHint')}</td></tr>
              )}
              {lines.map((l, i) => (
                <SortableRow key={l.key} id={l.key} className={l.price === 0 ? 'is-unpriced' : undefined} onDoubleClick={() => setEditingLine(l)}>
                  {(handle) => (<>
                  <td className="num muted-cell line-no"><span className="line-no__in">{handle}{i + 1}</span></td>
                  <td className="strong line-name">{l.productName}</td>
                  {/* Phones: one compact "qty × price" line instead of four columns */}
                  <td className="line-calc">
                    {fmt(l.quantity)} {unitLabel(l.unit)} × {l.price === 0 ? <span className="price-missing"><Icon name="warning" size={14} />0</span> : fmtMoney(l.price)} ₸
                    {l.discount ? ` · −${fmt(l.discount)}%` : ''}
                  </td>
                  <td className="num line-col">
                    {l.price === 0 ? (
                      <span className="price-missing" title={t('invoiceEdit.priceMissing')}>
                        <Icon name="warning" size={14} />0
                      </span>
                    ) : fmtMoney(l.price)}
                  </td>
                  <td className="num line-col">{fmt(l.quantity)}</td>
                  <td className="line-col">{unitLabel(l.unit)}</td>
                  <td className="num line-col">{l.discount ? `${fmt(l.discount)}%` : ''}</td>
                  <td className="num strong line-total">{fmtMoney(l.total)}</td>
                  <td className="row-actions">
                    <button className="icon-btn" title={t('common.edit')} aria-label={t('invoiceEdit.editLine', { name: l.productName })} onClick={() => setEditingLine(l)}>
                      <Icon name="edit" />
                    </button>
                    <button className="icon-btn icon-btn--danger" title={t('common.delete')} aria-label={t('invoiceEdit.deleteLine', { name: l.productName })} onClick={() => setDeleting(l)}>
                      <Icon name="trash" />
                    </button>
                  </td>
                  </>)}
                </SortableRow>
              ))}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={6} className="line-foot-label">{t('invoiceEdit.total')}</td>
                  <td className="num line-foot-total">{fmtMoney(totals.total)}</td>
                  <td className="line-col" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        </SortableList>
        )}

        {phone ? (
          <button type="button" className="btn btn--outline btn--lg m-add" onClick={() => setProductSheet('new')}>
            <Icon name="plus" />{t('invoiceEdit.addProduct')}
          </button>
        ) : (
        <QuickAdd
          units={units}
          nextSort={nextSort}
          onAdd={(line) => {
            setLines((ls) => [...ls, line])
            setDirty(true)
          }}
        />
        )}
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
        {phone && (
          <button className="btn btn--outline editor-actions__add" onClick={() => setProductSheet('new')} aria-label={t('invoiceEdit.addProduct')}>
            <Icon name="plus" />{t('invoiceEdit.addShort')}
          </button>
        )}
        <button className="btn btn--primary" onClick={ok} disabled={!canSave} title="Ctrl+S">{t('common.save')}</button>
        <button className="btn btn--ghost" onClick={() => navigate('/invoices')}>{t('common.close')}</button>
        <button className="btn btn--outline editor-actions__print" onClick={report} disabled={!canSave && (dirty || isNew)}
          title={t('invoiceEdit.print')} aria-label={t('invoiceEdit.print')}>
          <Icon name="print" /><span className="btn__label">{t('invoiceEdit.print')}</span>
        </button>
        <span className="muted editor-actions__status" role="status">
          {missing.length > 0 ? t('invoiceEdit.toSave', { list: missing.join(t('invoiceEdit.and')) }) : dirty ? t('invoiceEdit.unsaved') : ''}
        </span>
        <div className="editor-total" aria-live="polite">
          <span className="editor-total__label">{t('invoiceEdit.total')}</span>
          <span className="editor-total__value">{fmtMoney(totals.total)} ₸</span>
        </div>
      </div>

      {clientSheet && (
        <ClientSheet
          onClose={() => setClientSheet(false)}
          onNew={() => {
            setClientSheet(false)
            setNewClient(true)
          }}
          onPick={(c) => {
            setClient({ id: c.id, label: c.label })
            setDirty(true)
            setClientSheet(false)
          }}
        />
      )}
      {productSheet && (
        <ProductSheet
          key={productSheet === 'new' ? 'new' : productSheet.key}
          units={units}
          initial={productSheet === 'new' ? undefined : lineToDraft(productSheet)}
          onClose={() => setProductSheet(null)}
          onDelete={productSheet === 'new' ? undefined : () => {
            setDeleting(productSheet)
            setProductSheet(null)
          }}
          onSubmit={(d, again) => {
            if (productSheet === 'new') {
              setLines((ls) => [...ls, draftToLine(d, { key: keySeq++, id: null, sortOrder: nextSort })])
              setDirty(true)
              // The sheet stays open for the next product, so say the last one went in
              if (again) toast.show(t('invoiceEdit.productAdded'))
            } else {
              upsertLine(draftToLine(d, productSheet))
            }
            if (!again) setProductSheet(null)
          }}
        />
      )}
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
          title={t('invoiceEdit.deleteLineTitle')}
          text={t('invoiceEdit.deleteLineText', { name: deleting.productName })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
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
          title={t('invoiceEdit.repeatTitle')}
          text={t('invoiceEdit.repeatText', { count: lines.length, number: lastInvoice.number })}
          confirmLabel={t('invoiceEdit.replace')}
          cancelLabel={t('common.cancel')}
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
          title={t('invoiceEdit.unsavedTitle')}
          text={t('invoiceEdit.unsavedText')}
          confirmLabel={t('invoiceEdit.leave')}
          cancelLabel={t('invoiceEdit.stay')}
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
  const [product, setProduct] = useState<PickOption | null>(null)
  const { t } = useTranslation()
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
      categoryId: product.opt.categoryId,
      categoryName: product.opt.categoryName,
      productId: product.opt.productId,
      variantId: product.opt.variantId,
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
    <div className="quick-add" role="group" aria-label={t('invoiceEdit.addProduct')}>
      <label className="quick-add__product stack">
        <span className="stack__label">{t('invoiceEdit.colProduct')}</span>
        <AsyncSelect<PickOption>
          value={product}
          inputRef={productRef}
          invalid={errors.product}
          placeholder={t('invoiceEdit.productSearch')}
          ariaLabel={t('invoiceEdit.colProduct')}
          onChange={(o) => {
            setProduct(o)
            if (o) {
              setPrice(String(o.opt.price))
              setErrors((x) => ({ ...x, product: false }))
              requestAnimationFrame(() => qtyRef.current?.focus())
            }
          }}
          load={(text) => loadProducts(text)}
        />
      </label>
      <label className="stack">
        <span className="stack__label">{t('invoiceEdit.colPrice')}</span>
        <input className={`input num-input ${errors.price ? 'is-invalid' : ''}`} inputMode="decimal" value={price}
          onChange={(e) => setPrice(e.target.value)} onKeyDown={onEnter} />
      </label>
      <label className="stack">
        <span className="stack__label">{t('invoiceEdit.colQuantity')}</span>
        <input ref={qtyRef} className={`input num-input ${errors.quantity ? 'is-invalid' : ''}`} inputMode="decimal"
          value={quantity} onChange={(e) => setQuantity(numericInput(e.target.value))} onKeyDown={onEnter}
          onFocus={(e) => e.target.select()} />
      </label>
      <label className="stack">
        <span className="stack__label">{t('invoiceEdit.colUnit')}</span>
        <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as UnitCode)}>
          {units.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
      </label>
      <label className="stack">
        <span className="stack__label">{t('invoiceEdit.discount')}</span>
        <input className={`input num-input ${errors.discount ? 'is-invalid' : ''}`} inputMode="decimal" value={discount}
          onChange={(e) => setDiscount(e.target.value)} onKeyDown={onEnter} placeholder="0" />
      </label>
      <div className="stack quick-add__sum">
        <span className="stack__label">{t('invoiceEdit.colSum')}</span>
        <span className="quick-add__total">{calc ? `${fmt2(calc.total)} ₸` : '—'}</span>
      </div>
      <button className="btn btn--primary quick-add__btn" onClick={add}>
        <Icon name="plus" />{t('invoiceEdit.add')}
      </button>
      {/* Own full-width row: in the product cell a long colour list stretched the whole bar */}
      {product?.opt.variantId && (
        <div className="quick-add__colours">
          <ColourChips
            productId={product.opt.productId}
            selectedVariantId={product.opt.variantId}
            onPick={(o) => {
              setProduct(o)
              setPrice(String(o.opt.price))
              requestAnimationFrame(() => qtyRef.current?.focus())
            }}
          />
        </div>
      )}
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
  const { t } = useTranslation()
  const [product, setProduct] = useState<Option | null>({ id: line.variantId ? -line.variantId : line.productId ?? -1, label: line.productName })
  const [productId, setProductId] = useState<number | null>(line.productId ?? null)
  const [variantId, setVariantId] = useState<number | null>(line.variantId ?? null)
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
    if (!product) errs.product = t('invoiceEdit.pickProduct')
    if (p === null || p < 0) errs.price = t('invoiceEdit.priceRequired')
    if (q === null || q <= 0) errs.quantity = t('invoiceEdit.quantityRequired')
    if (d !== null && (d < 0 || d > 100)) errs.discount = t('invoiceEdit.discountRange')
    setErrors(errs)
    if (Object.keys(errs).length || !calc || !product) return
    onSave({
      ...line,
      categoryId,
      categoryName: categories.find((c) => c.id === categoryId)?.name ?? null,
      productId,
      variantId,
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
      title={t('invoiceEdit.lineTitle')}
      width={520}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={submit}>{t('common.save')}</button>
          <button className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit() }}>
        <Field label={t('invoiceEdit.colProduct')} required error={errors.product}>
          <AsyncSelect<PickOption>
            value={product}
            invalid={!!errors.product}
            placeholder={t('invoiceEdit.productSearchShort')}
            onChange={(o) => {
              setProduct(o)
              setProductId(o?.opt.productId ?? null)
              setVariantId(o?.opt.variantId ?? null)
              if (o) {
                setPrice(o.opt.price.toString())
                setCategoryId(o.opt.categoryId)
                requestAnimationFrame(() => qtyRef.current?.focus())
              }
            }}
            load={(text) => loadProducts(text, categoryId)}
          />
          {productId && variantId && (
            <ColourChips
              productId={productId}
              selectedVariantId={variantId}
              onPick={(o) => {
                setProduct(o)
                setVariantId(o.opt.variantId)
                setPrice(o.opt.price.toString())
              }}
            />
          )}
        </Field>
        <Field label={t('invoiceEdit.colQuantity')} required error={errors.quantity}>
          <input ref={qtyRef} className="input" inputMode="decimal" autoFocus value={quantity}
            onChange={(e) => setQuantity(numericInput(e.target.value))} onFocus={(e) => e.target.select()} />
        </Field>
        <Field label={t('invoiceEdit.colPrice')} required error={errors.price}>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label={t('invoiceEdit.unitOfMeasure')}>
          <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as UnitCode)}>
            {units.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </Field>
        <Field label={t('invoiceEdit.discountPercent')} error={errors.discount}>
          <input className="input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label={t('invoiceEdit.category')}>
          <select className="input" value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label={t('common.order')}>
          <input className="input" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        <div className="line-summary">
          <span>{t('invoiceEdit.sumLabel')} <b>{calc ? `${fmt2(calc.total)} ₸` : '—'}</b></span>
        </div>
        <button hidden />
      </form>
    </Modal>
  )
}
