import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { ApiError } from '../api/http'
import type { Category } from '../api/types'
import { useIsAdmin } from '../auth/AuthContext'
import { parseNum } from '../lib/format'
import { Alert } from './Alert'
import { Field } from './Field'
import { Icon } from './Icon'
import { ConfirmModal, Modal } from './Modal'
import { useToast } from './Toast'

/** Category list inside the price list page: add, rename, reorder (sort number), delete. */
export function CategoriesManager({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api.categories.all().then(setCategories).catch((e: Error) => setError(e.message))
  }, [])
  useEffect(load, [load])

  const remove = async () => {
    const c = deleting
    setDeleting(null)
    if (!c) return
    try {
      await api.categories.remove(c.id)
      load()
      onChanged()
      toast.show(`«${c.name}» санаты жойылды`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <Modal
        title="Санаттар"
        width={520}
        onClose={onClose}
        footer={
          <>
            <button className="btn btn--primary" onClick={() => setEditing('new')}><Icon name="plus" />Санат қосу</button>
            <button className="btn btn--ghost" onClick={onClose}>Жабу</button>
          </>
        }
      >
        <p className="muted cat-intro">Баға тізімі санаттар бойынша топталады. «Реті» — тізімдегі орны.</p>
        {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
        {!categories ? <p className="muted">Жүктелуде…</p> : (
          <ul className="cat-list">
            {categories.map((c) => (
              <li key={c.id}>
                <span className="cat-list__order">{c.sortOrder ?? '—'}</span>
                <span className="cat-list__name">{c.name}</span>
                <button className="icon-btn" title="Өзгерту" aria-label={`«${c.name}» өзгерту`} onClick={() => setEditing(c)}>
                  <Icon name="edit" />
                </button>
                {isAdmin && (
                  <button className="icon-btn icon-btn--danger" title="Жою" aria-label={`«${c.name}» жою`} onClick={() => setDeleting(c)}>
                    <Icon name="trash" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
      {editing && (
        <CategoryForm
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
            onChanged()
            toast.show('Санат сақталды')
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Санатты жою"
          text={`«${deleting.name}» санатын жою керек пе? Ондағы тауарлар «Санатсыз» болып қалады.`}
          confirmLabel="Жою"
          cancelLabel="Болдырмау"
          danger
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}

export function CategoryForm({ category, onClose, onSaved }: {
  category: Category | null
  onClose: () => void
  onSaved: (c: Category) => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [sortOrder, setSortOrder] = useState(category?.sortOrder?.toString() ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = async () => {
    try {
      const body = { name, sortOrder: parseNum(sortOrder) }
      onSaved(category ? await api.categories.update(category.id, body) : await api.categories.create(body))
    } catch (e) {
      const err = e as ApiError
      setErrors({ ...err.fields, _: Object.keys(err.fields ?? {}).length ? '' : err.message })
    }
  }

  return (
    <Modal
      title={category ? 'Санатты өзгерту' : 'Жаңа санат'}
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
        <Field label="Реті" error={errors.sortOrder}>
          <input className="input" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        {errors._ && <Alert>{errors._}</Alert>}
        <button hidden />
      </form>
    </Modal>
  )
}
