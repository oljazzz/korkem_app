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
  const [units, setUnits] = useState<Unit[]>([{ value: 'SHT', label: 'Шт' }])
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
    if (dirty && !window.confirm('Есть несохранённые изменения. Закрыть без сохранения?')) return
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

  if (loading) return <section className="page"><p>Загрузка…</p></section>

  return (
    <section className="page page--editor">
      <div className="breadcrumbs">
        <Link to="/invoices">Накладные</Link> › {isNew ? 'Новая' : `№ ${number ?? ''}`}
      </div>
      <h1 className="page-title">{isNew ? 'Новая накладная' : `Накладная № ${number ?? ''}`}</h1>

      <div className="form-grid">
        <Field label="Номер накладного">
          <input className="input" disabled value={number?.toLocaleString('ru-RU') ?? 'будет присвоен при сохранении'} />
        </Field>
        <Field label="Клиент">
          <div className="inline">
            <AsyncSelect
              value={client}
              placeholder="Выберите клиента"
              onChange={(o) => {
                setClient(o)
                setDirty(true)
              }}
              load={(q) =>
                api.clients.list({ q, size: 30 }).then((p) => p.items.map((c) => ({ id: c.id, label: c.displayName })))
              }
            />
            <button className="btn btn--outline btn--icon" title="Новый клиент" onClick={() => setNewClient(true)}><Icon name="plus" /></button>
          </div>
        </Field>
      </div>

      <div className="panel">
        <div className="panel__head"><h2 className="card__title">Товары</h2><span className="card__sub">{lines.length} поз. · {fmt2(totals.total)} ₸</span></div>
        <div className="toolbar">
          <button className="btn btn--primary" onClick={() => setEditingLine('new')}><Icon name="plus" />Добавить товар</button>
          <button className="btn btn--ghost" disabled={!selected} onClick={() => selected && setEditingLine(selected)}>
            <Icon name="edit" />Изменить
          </button>
          <button className="btn btn--ghost" disabled={!selected} onClick={() => setConfirmDelete(true)}><Icon name="trash" />Удалить</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Товар</th>
                <th className="num">Сортировка</th>
                <th className="num">Цена</th>
                <th>Мера измерения</th>
                <th className="num">Количество</th>
                <th className="num">Общая сумма</th>
                <th className="num">НДС</th>
                <th className="num">Скидка (%)</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr><td colSpan={8} className="table__msg">Добавьте товары кнопкой «Создать»</td></tr>
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
                  <td colSpan={5}>Итого</td>
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
        <button className="btn btn--primary" onClick={ok} disabled={busy}>Сохранить</button>
        <button className="btn btn--ghost" onClick={close}>Закрыть</button>
        <button className="btn btn--outline" onClick={report} disabled={busy || (lines.length === 0 && isNew)}><Icon name="print" />Печать З-2</button>
        {dirty && <span className="muted">Есть несохранённые изменения</span>}
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
          text={`Удалить «${selected.productName}» из накладной?`}
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
  const calc = p !== null && q !== null ? calcLine(p, q, d) : null

  const submit = () => {
    const errs: Record<string, string> = {}
    if (!product) errs.product = 'Выберите товар'
    if (p === null || p < 0) errs.price = 'Укажите цену'
    if (q === null || q <= 0) errs.quantity = 'Укажите количество'
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
      title="Редактор ед. товара"
      width={520}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={submit}>Сохранить</button>
          <button className="btn btn--ghost" onClick={onClose}>Отмена</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit() }}>
        <Field label="Категория">
          <select
            className="input"
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Товар" required error={errors.product}>
          <AsyncSelect<ProductOption>
            value={product}
            autoFocus={!line}
            invalid={!!errors.product}
            placeholder="Начните вводить название"
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
        <Field label="Мера измерения">
          <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as UnitCode)}>
            {units.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Цена" required error={errors.price}>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Количество" required error={errors.quantity}>
          <input
            className="input"
            inputMode="decimal"
            autoFocus={!!line}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label="Общая сумма">
          <input className="input" disabled value={calc ? fmt2(calc.total) : ''} />
        </Field>
        <Field label="НДС (12%)">
          <input className="input" disabled value={calc ? fmt2(calc.vat) : ''} />
        </Field>
        <Field label="Скидка (%)" error={errors.discount}>
          <input className="input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label="Сортировка">
          <input className="input" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        <button hidden />
      </form>
    </Modal>
  )
}
