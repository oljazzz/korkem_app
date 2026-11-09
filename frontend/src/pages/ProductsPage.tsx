import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CategoriesManager, CategoryForm } from '../components/CategoriesManager'
import { Icon } from '../components/Icon'
import { api } from '../api'
import { useIsAdmin } from '../auth/AuthContext'
import { PageHeader } from '../components/Layout'
import { ApiError } from '../api/http'
import type { Category, Product } from '../api/types'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { ConfirmModal, Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { RowActions, rowProps } from '../components/RowActions'
import { useToast } from '../components/Toast'
import { TableState, Toolbar } from '../components/Toolbar'
import { fmt, fmtPack, fmtPricePerBase, packFromName, parseNum, type PackUnit } from '../lib/format'
import { useList } from '../lib/useList'

export function ProductsPage() {
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const list = useList<Product>((p) => api.products.list({ ...p, categoryId }))
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [searchParams, setSearchParams] = useSearchParams()
  const [managing, setManaging] = useState(searchParams.get('categories') === '1')
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [catVersion, setCatVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.categories.all().then(setCategories).catch(() => setCategories([]))
  }, [catVersion])

  const categoriesChanged = () => {
    setCatVersion((v) => v + 1)
    list.reload()
  }

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
    const p = deleting
    setDeleting(null)
    if (!p) return
    try {
      await api.products.remove(p.id)
      list.reload()
      toast.show(`«${p.name}» жойылды`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="page">
      <PageHeader eyebrow="Анықтамалық" title="Баға тізімі">
        {isAdmin && (
          <Link className="btn btn--ghost" to="/products/grouping">
            <Icon name="merge" />Түстерге топтастыру
          </Link>
        )}
        <Link className="btn btn--outline" to={`/products/print${categoryId ? `?category=${categoryId}` : ''}`}>
          <Icon name="print" />Басып шығару / PDF
        </Link>
      </PageHeader>
      <Toolbar
        onCreate={() => setEditing('new')}
        search={list.q}
        onSearch={list.search}
        searchPlaceholder="Атауы бойынша іздеу"
      >
        <button className="btn btn--ghost" onClick={() => setManaging(true)}>
          <Icon name="folder" />Санаттар
        </button>
        <select
          className="input toolbar__select"
          aria-label="Санат бойынша сүзу"
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
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      <div className={`table-wrap ${list.loading ? 'is-loading' : ''}`} aria-busy={list.loading}>
        <table className="table table--cards">
          <thead>
            <tr>
              <th>Атауы</th>
              <th className="num" style={{ width: 130 }}>Қаптама</th>
              <th className="num" style={{ width: 160 }}>Бағасы</th>
              <th aria-label="Әрекеттер" style={{ width: 96 }} />
            </tr>
          </thead>
          <tbody>
            <TableState loading={list.loading} error={list.error} empty={list.data.items.length === 0} colSpan={4} />
            {groups.map(([key, items]) => (
              <GroupRows
                key={key}
                title={key}
                items={items}
                collapsed={collapsed.has(key)}
                onToggle={() => toggle(key)}
                onEditGroup={(() => {
                  const cat = categories.find((c) => c.name === key)
                  return cat ? () => setEditingCategory(cat) : undefined
                })()}
                selectedId={list.selected?.id ?? null}
                onOpen={setEditing}
                onDelete={isAdmin ? setDeleting : undefined}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot"><Pagination page={list.page} size={list.data.size} total={list.data.total} onChange={list.setPage} /></div>

      {managing && (
        <CategoriesManager
          onClose={() => {
            setManaging(false)
            if (searchParams.get('categories')) setSearchParams({})
          }}
          onChanged={categoriesChanged}
        />
      )}
      {editingCategory && (
        <CategoryForm
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSaved={() => {
            setEditingCategory(null)
            categoriesChanged()
            toast.show('Санат сақталды')
          }}
        />
      )}
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
            toast.show('Тауар сақталды')
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Тауарды жою"
          confirmLabel="Жою"
          cancelLabel="Болдырмау"
          danger
          text={`«${deleting.name}» тауарын жою керек пе? Бұрынғы жүкқұжаттарда атауы сақталады.`}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  )
}

function GroupRows({ title, items, collapsed, onToggle, onEditGroup, selectedId, onOpen, onDelete }: {
  title: string
  items: Product[]
  collapsed: boolean
  onToggle: () => void
  onEditGroup?: () => void
  selectedId: number | null
  onOpen: (p: Product) => void
  onDelete?: (p: Product) => void
}) {
  return (
    <>
      <tr className="group-row">
        <td colSpan={3}>
          <button className="group-row__toggle" aria-expanded={!collapsed} onClick={onToggle}>
            <span className="group-row__icon" aria-hidden="true">{collapsed ? '▸' : '▾'}</span> {title} ({items.length})
          </button>
        </td>
        <td className="row-actions">
          {onEditGroup && (
            <button className="icon-btn" title="Санатты өзгерту" aria-label={`«${title}» санатын өзгерту`} onClick={onEditGroup}>
              <Icon name="edit" />
            </button>
          )}
        </td>
      </tr>
      {!collapsed &&
        items.map((p) => (
          <tr key={p.id} {...rowProps(() => onOpen(p), onDelete ? () => onDelete(p) : undefined, selectedId === p.id)}>
            <td className="indent" data-title>
              <span className="strong">{p.name}</span>
              {p.variants.length > 0 && <VariantPills product={p} />}
            </td>
            <td className={`num ${p.packAmount ? '' : 'muted-cell'}`} data-label="Қаптама">{p.packAmount ? fmtPack(p.packAmount, p.packUnit) : '—'}</td>
            <td className="num cell-amount">
              {fmt(p.price)} ₸
              {p.packAmount && p.price > 0 && <span className="cell-sub">{fmtPricePerBase(p.price, p.packAmount, p.packUnit)}</span>}
            </td>
            <RowActions name={p.name} onEdit={() => onOpen(p)} onDelete={onDelete ? () => onDelete(p) : undefined} />
          </tr>
        ))}
    </>
  )
}

/** Colour names under a product row; long lists collapse to the first few. */
function VariantPills({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const shown = open ? product.variants : product.variants.slice(0, 8)
  const hidden = product.variants.length - shown.length
  return (
    <span className="variant-pills" onClick={(e) => e.stopPropagation()}>
      <span className="variant-pills__count">{product.variants.length} түс:</span>
      {shown.map((v) => (
        <span key={v.id} className={`variant-pill ${v.active ? '' : 'is-off'}`}
          title={v.price !== null ? `${fmt(v.price)} ₸` : undefined}>
          {v.name}{v.price !== null && <b> · {fmt(v.price)} ₸</b>}
        </span>
      ))}
      {hidden > 0 && <button type="button" className="link-btn variant-pills__more" onClick={() => setOpen(true)}>тағы {hidden}</button>}
    </span>
  )
}

type VariantDraft = { key: number; id: number | null; name: string; price: string; active: boolean }
let variantKey = 1

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
  // Pack size is edited in the unit people think in (800 г, 500 мл) and stored as kg / l
  const initialPack = toInput(product?.packAmount ?? null, product?.packUnit ?? null)
  const [packValue, setPackValue] = useState(initialPack.value)
  const [packInputUnit, setPackInputUnit] = useState<InputUnit>(initialPack.unit)
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    (product?.variants ?? []).map((v) => ({
      key: variantKey++, id: v.id, name: v.name, price: v.price === null ? '' : String(v.price), active: v.active,
    })),
  )
  const [newVariant, setNewVariant] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const suggested = !packValue.trim() ? packFromName(name) : null

  const addVariants = () => {
    // Several colours can be pasted at once, separated by commas or new lines
    const names = newVariant.split(/[,\n]/).map((n) => n.trim()).filter(Boolean)
    if (names.length === 0) return
    const taken = new Set(variants.map((v) => v.name.toLowerCase()))
    setVariants((vs) => [
      ...vs,
      ...names.filter((n) => !taken.has(n.toLowerCase())).map((n) => ({ key: variantKey++, id: null, name: n, price: '', active: true })),
    ])
    setNewVariant('')
  }
  const updateVariant = (key: number, patch: Partial<VariantDraft>) =>
    setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)))

  const save = async () => {
    const priceNum = parseNum(price)
    const packNum = parseNum(packValue)
    if (packValue.trim() && (packNum === null || packNum <= 0)) {
      setErrors({ packAmount: '0-ден үлкен сан енгізіңіз' })
      return
    }
    const pack = packNum === null ? null : fromInput(packNum, packInputUnit)
    try {
      const body = {
        categoryId,
        name,
        price: priceNum as number,
        sortOrder: parseNum(sortOrder),
        packAmount: pack?.amount ?? null,
        packUnit: pack?.unit ?? null,
        variants: variants.map((v) => ({
          id: v.id,
          name: v.name,
          price: v.price.trim() ? parseNum(v.price) : null,
          active: v.active,
        })),
      }
      onSaved(product ? await api.products.update(product.id, body) : await api.products.create(body))
    } catch (e) {
      const err = e as ApiError
      setErrors({ ...err.fields, _: Object.keys(err.fields).length ? '' : err.message })
    }
  }

  return (
    <Modal
      title={product ? 'Тауарды өзгерту' : 'Жаңа тауар'}
      width={600}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={save}>Сақтау</button>
          <button className="btn btn--ghost" onClick={onClose}>Болдырмау</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Атауы" required error={errors.name}>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
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
        <Field label="Бағасы, ₸" required error={errors.price}>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Қаптама" error={errors.packAmount}>
          <div className="inline pack-input">
            <input className="input num-input" inputMode="decimal" value={packValue} placeholder="мысалы, 20"
              aria-label="Қаптама мөлшері" onChange={(e) => setPackValue(e.target.value)} />
            <select className="input" aria-label="Қаптама бірлігі" value={packInputUnit}
              onChange={(e) => setPackInputUnit(e.target.value as InputUnit)}>
              {INPUT_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          {suggested ? (
            <span className="field__hint">
              Атауында {fmtPack(suggested.amount, suggested.unit)} деп жазылған —{' '}
              <button type="button" className="link-btn" onClick={() => {
                const v = toInput(suggested.amount, suggested.unit)
                setPackValue(v.value)
                setPackInputUnit(v.unit)
              }}>қолдану</button>
            </span>
          ) : (
            <span className="field__hint">Бір дананың ішіндегі мөлшері: массасы (кг, г) немесе көлемі (л, мл).</span>
          )}
        </Field>
        <Field label="Түстер">
          <div className="variants-edit">
            {variants.length > 0 && (
              <ul className="variants-edit__list">
                {variants.map((v) => (
                  <li key={v.key} className={v.active ? '' : 'is-off'}>
                    <input className="input" value={v.name} aria-label="Түстің атауы"
                      onChange={(e) => updateVariant(v.key, { name: e.target.value })} />
                    <input className="input num-input variants-edit__price" inputMode="decimal" value={v.price}
                      placeholder={price || 'баға'} aria-label={`«${v.name}» бағасы`} title="Бос болса — тауардың бағасы"
                      onChange={(e) => updateVariant(v.key, { price: e.target.value })} />
                    <label className="checkbox" title="Жүкқұжатта таңдауға болады">
                      <input type="checkbox" checked={v.active} onChange={(e) => updateVariant(v.key, { active: e.target.checked })} />
                      бар
                    </label>
                    <button type="button" className="icon-btn icon-btn--danger" aria-label={`«${v.name}» түсін алып тастау`}
                      onClick={() => setVariants((vs) => vs.filter((x) => x.key !== v.key))}>
                      <Icon name="close" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="inline">
              <input className="input" value={newVariant} placeholder="Ақ, Қара, Қызыл…"
                aria-label="Жаңа түстер"
                onChange={(e) => setNewVariant(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addVariants()
                  }
                }} />
              <button type="button" className="btn btn--outline" onClick={addVariants}><Icon name="plus" />Қосу</button>
            </div>
            <span className="field__hint">
              {variants.length === 0
                ? 'Түсі жоқ тауар болса, бос қалдырыңыз. Бірнеше түсті үтір арқылы жазуға болады.'
                : 'Түстің бағасы бос болса, тауардың бағасы алынады. «бар» белгісі алынған түс жүкқұжатта шықпайды.'}
            </span>
          </div>
        </Field>
        <Field label="Реті">
          <input className="input" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        {errors._ && <Alert>{errors._}</Alert>}
        <button hidden />
      </form>
    </Modal>
  )
}

type InputUnit = 'KG' | 'G' | 'L' | 'ML'

const INPUT_UNITS: { value: InputUnit; label: string }[] = [
  { value: 'KG', label: 'кг' },
  { value: 'G', label: 'г' },
  { value: 'L', label: 'л' },
  { value: 'ML', label: 'мл' },
]

/** Stored pack (kg / l) → form value in a friendly unit: 0.8 kg shows as 800 г. */
function toInput(amount: number | null, unit: PackUnit | null): { value: string; unit: InputUnit } {
  if (amount === null || !unit) return { value: '', unit: 'KG' }
  const small = amount < 1
  const value = small ? Math.round(amount * 1000) : amount
  return { value: String(value).replace('.', ','), unit: unit === 'KG' ? (small ? 'G' : 'KG') : small ? 'ML' : 'L' }
}

/** Form value → stored pack in kg or l. */
function fromInput(value: number, unit: InputUnit): { amount: number; unit: PackUnit } {
  const small = unit === 'G' || unit === 'ML'
  return { amount: small ? value / 1000 : value, unit: unit === 'KG' || unit === 'G' ? 'KG' : 'L' }
}
