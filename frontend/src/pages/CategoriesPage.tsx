import { useState } from 'react'
import { api } from '../api'
import { useIsAdmin } from '../auth/AuthContext'
import { PageHeader } from '../components/Layout'
import { ApiError } from '../api/http'
import type { Category } from '../api/types'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { ConfirmModal, Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { RowActions, rowProps } from '../components/RowActions'
import { useToast } from '../components/Toast'
import { TableState, Toolbar } from '../components/Toolbar'
import { parseNum } from '../lib/format'
import { useList } from '../lib/useList'

export function CategoriesPage() {
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const list = useList<Category>((p) => api.categories.list(p))
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    const c = deleting
    setDeleting(null)
    if (!c) return
    try {
      await api.categories.remove(c.id)
      list.reload()
      toast.show(`«${c.name}» санаты жойылды`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="page">
      <PageHeader eyebrow="Анықтамалық" title="Санаттар" />
      <Toolbar
        onCreate={() => setEditing('new')}
        search={list.q}
        onSearch={list.search}
        searchPlaceholder="Санатты іздеу"
      />
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      <div className={`table-wrap ${list.loading ? 'is-loading' : ''}`} aria-busy={list.loading}>
        <table className="table table--cards">
          <thead>
            <tr>
              <th>Санат</th>
              <th style={{ width: 200 }}>Реті</th>
              <th aria-label="Әрекеттер" />
            </tr>
          </thead>
          <tbody>
            <TableState loading={list.loading} error={list.error} empty={list.data.items.length === 0} colSpan={3} />
            {list.data.items.map((c) => (
              <tr key={c.id} {...rowProps(() => setEditing(c), isAdmin ? () => setDeleting(c) : undefined, list.selected?.id === c.id)}>
                <td className="strong" data-title>{c.name}</td>
                <td data-label="Реті">{c.sortOrder}</td>
                <RowActions name={c.name} onEdit={() => setEditing(c)} onDelete={isAdmin ? () => setDeleting(c) : undefined} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot"><Pagination page={list.page} size={list.data.size} total={list.data.total} onChange={list.setPage} /></div>

      {editing && (
        <CategoryForm
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(c) => {
            setEditing(null)
            list.setSelectedId(c.id)
            list.reload()
            toast.show('Санат сақталды')
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Санатты жою"
          confirmLabel="Жою"
          cancelLabel="Болдырмау"
          danger
          text={`«${deleting.name}» санатын жою керек пе? Тауарлар санатсыз қалады.`}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  )
}

function CategoryForm({ category, onClose, onSaved }: {
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
      setErrors({ ...err.fields, _: Object.keys(err.fields).length ? '' : err.message })
    }
  }

  return (
    <Modal
      title="Санат"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={save}>Сақтау</button>
          <button className="btn btn--ghost" onClick={onClose}>Болдырмау</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Санат" required error={errors.name}>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
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
