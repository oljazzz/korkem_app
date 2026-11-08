import { useState } from 'react'
import { api } from '../api'
import { PageHeader } from '../components/Layout'
import { ApiError } from '../api/http'
import type { Category } from '../api/types'
import { Field } from '../components/Field'
import { ConfirmModal, Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { TableState, Toolbar } from '../components/Toolbar'
import { parseNum } from '../lib/format'
import { useList } from '../lib/useList'

export function CategoriesPage() {
  const list = useList<Category>((p) => api.categories.list(p))
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setConfirm(false)
    if (!list.selected) return
    try {
      await api.categories.remove(list.selected.id)
      list.setSelectedId(null)
      list.reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="page">
      <PageHeader eyebrow="Справочник" title="Категории" />
      <Toolbar
        onCreate={() => setEditing('new')}
        onEdit={() => list.selected && setEditing(list.selected)}
        onDelete={() => setConfirm(true)}
        hasSelection={!!list.selected}
        search={list.q}
        onSearch={list.search}
        searchPlaceholder="Поиск категории"
      />
      {error && <div className="alert" onClick={() => setError(null)}>{error}</div>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Категория</th>
              <th style={{ width: 200 }}>Сортировка</th>
            </tr>
          </thead>
          <tbody>
            <TableState loading={list.loading} error={list.error} empty={list.data.items.length === 0} colSpan={2} />
            {list.data.items.map((c) => (
              <tr
                key={c.id}
                className={list.selected?.id === c.id ? 'is-selected' : ''}
                onClick={() => list.setSelectedId(c.id)}
                onDoubleClick={() => setEditing(c)}
              >
                <td>{c.name}</td>
                <td>{c.sortOrder}</td>
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
          }}
        />
      )}
      {confirm && list.selected && (
        <ConfirmModal
          text={`Удалить категорию «${list.selected.name}»? Товары останутся без категории.`}
          onConfirm={remove}
          onClose={() => setConfirm(false)}
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
      title="Редактор категории"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={save}>Сохранить</button>
          <button className="btn btn--ghost" onClick={onClose}>Отмена</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Категория" required error={errors.name}>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Сортировка">
          <input className="input" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        {errors._ && <div className="alert">{errors._}</div>}
        <button hidden />
      </form>
    </Modal>
  )
}
