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
import { useTranslation } from 'react-i18next'

/** Category list inside the price list page: add, rename, reorder (sort number), delete. */
export function CategoriesManager({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const isAdmin = useIsAdmin()
  const { t } = useTranslation()
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
      toast.show(t('categories.deleted', { name: c.name }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <Modal
        title={t('categories.title')}
        width={520}
        onClose={onClose}
        footer={
          <>
            <button className="btn btn--primary" onClick={() => setEditing('new')}><Icon name="plus" />{t('categories.add')}</button>
            <button className="btn btn--ghost" onClick={onClose}>{t('common.close')}</button>
          </>
        }
      >
        <p className="muted cat-intro">{t('categories.intro')}</p>
        {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
        {!categories ? <p className="muted">{t('common.loading')}</p> : (
          <ul className="cat-list">
            {categories.map((c) => (
              <li key={c.id}>
                <span className="cat-list__order">{c.sortOrder ?? '—'}</span>
                <span className="cat-list__name">{c.name}</span>
                <button className="icon-btn" title={t('common.edit')} aria-label={t('categories.editLabel', { name: c.name })} onClick={() => setEditing(c)}>
                  <Icon name="edit" />
                </button>
                {isAdmin && (
                  <button className="icon-btn icon-btn--danger" title={t('common.delete')} aria-label={t('categories.deleteLabel', { name: c.name })} onClick={() => setDeleting(c)}>
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
            toast.show(t('categories.saved'))
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title={t('categories.deleteTitle')}
          text={t('categories.deleteText', { name: deleting.name })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
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
  const { t } = useTranslation()
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
      title={category ? t('categories.editTitle') : t('categories.newTitle')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={save}>{t('common.save')}</button>
          <button className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label={t('common.name')} required error={errors.name}>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('common.order')} error={errors.sortOrder}>
          <input className="input" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        {errors._ && <Alert>{errors._}</Alert>}
        <button hidden />
      </form>
    </Modal>
  )
}
