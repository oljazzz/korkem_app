import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type InvoiceRequest } from '../api'
import { ApiError } from '../api/http'
import type { Category, InvoiceLine, Product, Unit, UnitCode } from '../api/types'
import { AsyncSelect, type Option } from '../components/AsyncSelect'
import { Icon } from '../components/Icon'
import { Field } from '../components/Field'
import { ConfirmModal, Modal } from '../components/Modal'
import { ClientForm } from './ClientsPage'
import { calcLine, fmt, fmt2, parseNum } from '../lib/format'
import { useSettings } from '../lib/settings'

type Line = InvoiceLine & { key: number }
let keySeq = 1

export function InvoiceEditPage() {
  const { id } = useParams()
  const isNew = id === undefined
  const navigate = useNavigate()

  const [number, setNumber] = useState<number | null>(null)
  const [client, setClient] = useState<Option | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [editingLine, setEditingLine] = useState<Line | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newClient, setNewClient] = useState(false)
  const [units, setUnits] = useState<Unit[]>([{ value: 'SHT', label: 'дана' }])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        setClient(inv.clientId ? { id: inv.clientId, label: inv.clientName ?? '' } : null)
        setLines(inv.lines.map((l) => ({ ...l, key: keySeq++ })))
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const totals = useMemo(
    () => lines.reduce((acc, l) => ({ total: acc.total + l.total, vat: acc.vat + l.vat }), { total: 0, vat: 0 }),
    [lines],
  )
  const selected = lines.find((l) => l.key === selectedKey) ?? null
  const nextSort = lines.reduce((m, l) => Math.max(m, l.sortOrder ?? 0), 0) + 1

  const save = async (): Promise<number | null> => {
    setBusy(true)
    setError(null)
    const body: InvoiceRequest = {
      clientId: client?.id ?? null,
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
      return saved.id
    } catch (e) {
      setError((e as ApiError).message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const ok = async () => {
    if ((await save()) !== null) navigate('/invoices')
  }

  const report = async () => {
    const savedId = dirty || isNew ? await save() : Number(id)
    if (savedId !== null) navigate(`/invoices/${savedId}/print`)
  }

  const close = () => {
    if (dirty && !window.confirm('Сақталмаған өзгерістер бар. Сақтамай жабу керек пе?')) return
    navigate('/invoices')
  }

  const upsertLine = (line: Line) => {
    setLines((ls) => {
      const exists = ls.some((l) => l.key === line.key)
      return exists ? ls.map((l) => (l.key === line.key ? line : l)) : [...ls, line]
    })
    setSelectedKey(line.key)
    setEditingLine(null)
    setDirty(true)
  }

  if (loading) return <section className="page"><p>Жүктелуде…</p></section>

  return (
    <section className="page page--editor">
      <div className="breadcrumbs">
        <Link to="/invoices">Жүкқұжаттар</Link> › {isNew ? 'Жаңа' : `№ ${number ?? ''}`}
      </div>
      <h1 className="page-title">{isNew ? 'Жаңа жүкқұжат' : `Жүкқұжат № ${number ?? ''}`}</h1>

      <div className="form-grid">
        <Field label="Жүкқұжат нөмірі">
          <input className="input" disabled value={(number !== null ? fmt(number) : null) ?? 'сақтағанда беріледі'} />
        </Field>
        <Field label="Клиент">
          <div className="inline">
            <AsyncSelect
              value={client}
              placeholder="Клиентті таңдаңыз"
              onChange={(o) => {
                setClient(o)
                setDirty(true)
              }}
              load={(q) =>
                api.clients.list({ q, size: 30 }).then((p) => p.items.map((c) => ({ id: c.id, label: c.displayName })))
              }
            />
            <button className="btn btn--outline btn--icon" title="Жаңа клиент" onClick={() => setNewClient(true)}><Icon name="plus" /></button>
          </div>
        </Field>
      </div>

      <div className="panel">
        <div className="panel__head"><h2 className="card__title">Тауарлар</h2><span className="card__sub">{lines.length} поз. · {fmt2(totals.total)} ₸</span></div>
        <div className="toolbar">
          <button className="btn btn--primary" onClick={() => setEditingLine('new')}><Icon name="plus" />Тауар қосу</button>
          <button className="btn btn--ghost" disabled={!selected} onClick={() => selected && setEditingLine(selected)}>
            <Icon name="edit" />Өзгерту
          </button>
          <button className="btn btn--ghost" disabled={!selected} onClick={() => setConfirmDelete(true)}><Icon name="trash" />Жою</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Тауар</th>
                <th className="num">Реті</th>
                <th className="num">Бағасы</th>
                <th>Өлшем бірлігі</th>
                <th className="num">Саны</th>
                <th className="num">Жалпы сома</th>
                <th className="num">ҚҚС</th>
                <th className="num">Жеңілдік (%)</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr><td colSpan={8} className="table__msg">Тауарларды «Тауар қосу» батырмасымен қосыңыз</td></tr>
              )}
              {lines.map((l) => (
                <tr
                  key={l.key}
                  className={selectedKey === l.key ? 'is-selected' : ''}
                  onClick={() => setSelectedKey(l.key)}
                  onDoubleClick={() => setEditingLine(l)}
                >
                  <td>{l.productName}</td>
                  <td className="num">{l.sortOrder}</td>
                  <td className="num">{fmt(l.price)}</td>
                  <td>{units.find((u) => u.value === l.unit)?.label ?? l.unit}</td>
                  <td className="num">{fmt(l.quantity)}</td>
                  <td className="num">{fmt(l.total)}</td>
                  <td className="num">{fmt2(l.vat)}</td>
                  <td className="num">{fmt(l.discount)}</td>
                </tr>
              ))}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5}>Барлығы</td>
                  <td className="num">{fmt2(totals.total)}</td>
                  <td className="num">{fmt2(totals.vat)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="editor-actions">
        <button className="btn btn--primary" onClick={ok} disabled={busy}>Сақтау</button>
        <button className="btn btn--ghost" onClick={close}>Жабу</button>
        <button className="btn btn--outline" onClick={report} disabled={busy || (lines.length === 0 && isNew)}><Icon name="print" />З-2 басып шығару</button>
        {dirty && <span className="muted">Сақталмаған өзгерістер бар</span>}
      </div>

      {editingLine && (
        <LineForm
          line={editingLine === 'new' ? null : editingLine}
          nextSort={nextSort}
          units={units}
          categories={categories}
          onClose={() => setEditingLine(null)}
          onSave={upsertLine}
        />
      )}
      {confirmDelete && selected && (
        <ConfirmModal
          text={`«${selected.productName}» жүкқұжаттан жойылсын ба?`}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            setLines((ls) => ls.filter((l) => l.key !== selected.key))
            setSelectedKey(null)
            setConfirmDelete(false)
            setDirty(true)
          }}
        />
      )}
      {newClient && (
        <ClientForm
          client={null}
          onClose={() => setNewClient(false)}
          onSaved={(c) => {
            setClient({ id: c.id, label: c.displayName })
            setNewClient(false)
            setDirty(true)
          }}
        />
      )}
    </section>
  )
}

type ProductOption = Option & { product: Product }

function LineForm({ line, nextSort, units, categories, onClose, onSave }: {
  line: Line | null
  nextSort: number
  units: Unit[]
  categories: Category[]
  onClose: () => void
  onSave: (l: Line) => void
}) {
  const { vatRate } = useSettings()
  const [categoryId, setCategoryId] = useState<number | null>(line?.categoryId ?? null)
  const [product, setProduct] = useState<Option | null>(
    line ? { id: line.productId ?? -1, label: line.productName } : null,
  )
  const [productId, setProductId] = useState<number | null>(line?.productId ?? null)
  const [unit, setUnit] = useState<UnitCode>(line?.unit ?? 'SHT')
  const [price, setPrice] = useState(line?.price?.toString() ?? '')
  const [quantity, setQuantity] = useState(line?.quantity?.toString() ?? '')
  const [discount, setDiscount] = useState(line?.discount?.toString() ?? '')
  const [sortOrder, setSortOrder] = useState((line?.sortOrder ?? nextSort).toString())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const p = parseNum(price)
  const q = parseNum(quantity)
  const d = parseNum(discount)
  const calc = p !== null && q !== null ? calcLine(p, q, d, vatRate) : null

  const submit = () => {
    const errs: Record<string, string> = {}
    if (!product) errs.product = 'Тауарды таңдаңыз'
    if (p === null || p < 0) errs.price = 'Бағасын көрсетіңіз'
    if (q === null || q <= 0) errs.quantity = 'Санын көрсетіңіз'
    if (d !== null && (d < 0 || d > 100)) errs.discount = '0–100'
    setErrors(errs)
    if (Object.keys(errs).length || !calc || !product) return
    onSave({
      key: line?.key ?? keySeq++,
      id: line?.id ?? null,
      categoryId,
      categoryName: categories.find((c) => c.id === categoryId)?.name ?? null,
      productId,
      productName: product.label,
      unit,
      price: p!,
      quantity: q!,
      discount: d,
      total: calc.total,
      vat: calc.vat,
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
        <Field label="Санат">
          <select
            className="input"
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Барлық санаттар</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Тауар" required error={errors.product}>
          <AsyncSelect<ProductOption>
            value={product}
            autoFocus={!line}
            invalid={!!errors.product}
            placeholder="Атауын жаза бастаңыз"
            onChange={(o) => {
              setProduct(o)
              setProductId(o?.product.id ?? null)
              if (o) {
                setPrice(o.product.price.toString())
                if (o.product.categoryId) setCategoryId(o.product.categoryId)
              }
            }}
            load={(text) =>
              api.products
                .list({ q: text, categoryId, size: 30 })
                .then((pg) => pg.items.map((pr) => ({ id: pr.id, label: pr.name, product: pr })))
            }
          />
        </Field>
        <Field label="Өлшем бірлігі">
          <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as UnitCode)}>
            {units.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Бағасы" required error={errors.price}>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Саны" required error={errors.quantity}>
          <input
            className="input"
            inputMode="decimal"
            autoFocus={!!line}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label="Жалпы сома">
          <input className="input" disabled value={calc ? fmt2(calc.total) : ''} />
        </Field>
        <Field label={`ҚҚС (${vatRate}%)`}>
          <input className="input" disabled value={calc ? fmt2(calc.vat) : ''} />
        </Field>
        <Field label="Жеңілдік (%)" error={errors.discount}>
          <input className="input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label="Реті">
          <input className="input" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        <button hidden />
      </form>
    </Modal>
  )
}
