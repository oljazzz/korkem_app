import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useIsAdmin } from '../auth/AuthContext'
import { PageHeader } from '../components/Layout'
import { ApiError } from '../api/http'
import type { Category, Product } from '../api/types'
import { Field } from '../components/Field'
import { ConfirmModal, Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { TableState, Toolbar } from '../components/Toolbar'
import { fmt, parseNum } from '../lib/format'
import { useList } from '../lib/useList'
import { useNarrow } from '../lib/useNarrow'

export function ProductsPage() {
  const narrow = useNarrow()
  const isAdmin = useIsAdmin()
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const list = useList<Product>((p) => api.products.list({ ...p, categoryId }))
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.categories.all().then(setCategories).catch(() => setCategories([]))
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, Product[]>()
    list.data.items.forEach((p) => {
      const key = p.categoryName ?? '— Санатсыз —'
      map.set(key, [...(map.get(key) ?? []), p])
    })
    return [...map.entries()]
  }, [list.data.items])

  const toggle = (key: string) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  const remove = async () => {
    setConfirm(false)
    if (!list.selected) return
    try {
      await api.products.remove(list.selected.id)
      list.setSelectedId(null)
      list.reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="page">
      <PageHeader eyebrow="Анықтамалық" title="Баға тізімі" />
      <Toolbar
        onCreate={() => setEditing('new')}
        onEdit={() => list.selected && setEditing(list.selected)}
        onDelete={isAdmin ? () => setConfirm(true) : undefined}
        hasSelection={!!list.selected}
        search={list.q}
        onSearch={list.search}
        searchPlaceholder="Атауы бойынша іздеу"
      >
        <select
          className="input toolbar__select"
          value={categoryId ?? ''}
          onChange={(e) => {
            setCategoryId(e.target.value ? Number(e.target.value) : null)
            list.setPage(0)
            list.reload()
          }}
        >
          <option value="">Барлық санаттар</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Toolbar>
      {error && <div className="alert" onClick={() => setError(null)}>{error}</div>}
      <div className="table-wrap">
        <table className="table table--cards">
          <thead>
            <tr>
              <th>Атауы</th>
              <th className="num" style={{ width: 160 }}>Бағасы</th>
              <th className="num" style={{ width: 140 }}>Реті</th>
            </tr>
          </thead>
          <tbody>
            <TableState loading={list.loading} error={list.error} empty={list.data.items.length === 0} colSpan={3} />
            {groups.map(([key, items]) => (
              <GroupRows
                key={key}
                title={key}
                items={items}
                collapsed={collapsed.has(key)}
                onToggle={() => toggle(key)}
                selectedId={list.selected?.id ?? null}
                onSelect={list.setSelectedId}
                onOpen={setEditing}
                narrow={narrow}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot"><Pagination page={list.page} size={list.data.size} total={list.data.total} onChange={list.setPage} /></div>

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          categories={categories}
          defaultCategoryId={categoryId}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            setEditing(null)
            list.setSelectedId(p.id)
            list.reload()
          }}
        />
      )}
      {confirm && list.selected && (
        <ConfirmModal confirmLabel="Жою" cancelLabel="Болдырмау" danger text={`«${list.selected.name}» тауарын жою керек пе?`} onConfirm={remove} onClose={() => setConfirm(false)} />
      )}
    </section>
  )
}

function GroupRows({ title, items, collapsed, onToggle, selectedId, onSelect, onOpen, narrow }: {
  title: string
  items: Product[]
  collapsed: boolean
  onToggle: () => void
  selectedId: number | null
  onSelect: (id: number) => void
  onOpen: (p: Product) => void
  narrow: boolean
}) {
  return (
    <>
      <tr className="group-row" onClick={onToggle}>
        <td colSpan={3}>
          <span className="group-row__icon">{collapsed ? '▸' : '▾'}</span> {title} ({items.length})
        </td>
      </tr>
      {!collapsed &&
        items.map((p) => (
          <tr
            key={p.id}
            className={selectedId === p.id ? 'is-selected' : ''}
            onClick={() => (narrow ? onOpen(p) : onSelect(p.id))}
            onDoubleClick={() => onOpen(p)}
          >
            <td className="indent strong" data-title>{p.name}</td>
            <td className="num cell-amount">{fmt(p.price)} ₸</td>
            <td className="num" data-label="Реті">{p.sortOrder}</td>
          </tr>
        ))}
    </>
  )
}

function ProductForm({ product, categories, defaultCategoryId, onClose, onSaved }: {
  product: Product | null
  categories: Category[]
  defaultCategoryId: number | null
  onClose: () => void
  onSaved: (p: Product) => void
}) {
  const [categoryId, setCategoryId] = useState<number | null>(product ? product.categoryId : defaultCategoryId)
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product?.price?.toString() ?? '')
  const [sortOrder, setSortOrder] = useState(product?.sortOrder?.toString() ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = async () => {
    const priceNum = parseNum(price)
    try {
      const body = { categoryId, name, price: priceNum as number, sortOrder: parseNum(sortOrder) }
      onSaved(product ? await api.products.update(product.id, body) : await api.products.create(body))
    } catch (e) {
      const err = e as ApiError
      setErrors({ ...err.fields, _: Object.keys(err.fields).length ? '' : err.message })
    }
  }

  return (
    <Modal
      title="Тауар"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={save}>Сақтау</button>
          <button className="btn btn--ghost" onClick={onClose}>Болдырмау</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Санат">
          <select
            className="input"
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Атауы" required error={errors.name}>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Бағасы" required error={errors.price}>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Реті">
          <input className="input" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        {errors._ && <div className="alert">{errors._}</div>}
        <button hidden />
      </form>
    </Modal>
  )
}
