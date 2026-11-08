import { useState } from 'react'
import { api } from '../api'
import { PageHeader } from '../components/Layout'
import { ApiError } from '../api/http'
import type { Client } from '../api/types'
import { Field } from '../components/Field'
import { ConfirmModal, Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { TableState, Toolbar } from '../components/Toolbar'
import { useList } from '../lib/useList'

export function ClientsPage() {
  const list = useList<Client>((p) => api.clients.list(p))
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setConfirm(false)
    if (!list.selected) return
    try {
      await api.clients.remove(list.selected.id)
      list.setSelectedId(null)
      list.reload()
    } catch (e) {
      setError(
        (e as ApiError).status === 409 ? 'У клиента есть накладные — удалить нельзя' : (e as Error).message,
      )
    }
  }

  return (
    <section className="page">
      <PageHeader eyebrow="Справочник" title="Клиенты" />
      <Toolbar
        onCreate={() => setEditing('new')}
        onEdit={() => list.selected && setEditing(list.selected)}
        onDelete={() => setConfirm(true)}
        hasSelection={!!list.selected}
        search={list.q}
        onSearch={list.search}
        searchPlaceholder="Поиск по имени или адресу"
      />
      {error && <div className="alert" onClick={() => setError(null)}>{error}</div>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Имя</th>
              <th>Адрес</th>
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
                <td>{c.address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot"><Pagination page={list.page} size={list.data.size} total={list.data.total} onChange={list.setPage} /></div>

      {editing && (
        <ClientForm
          client={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(c) => {
            setEditing(null)
            list.setSelectedId(c.id)
            list.reload()
          }}
        />
      )}
      {confirm && list.selected && (
        <ConfirmModal text={`Удалить клиента «${list.selected.name}»?`} onConfirm={remove} onClose={() => setConfirm(false)} />
      )}
    </section>
  )
}

export function ClientForm({ client, onClose, onSaved }: {
  client: Client | null
  onClose: () => void
  onSaved: (c: Client) => void
}) {
  const [name, setName] = useState(client?.name ?? '')
  const [address, setAddress] = useState(client?.address ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const body = { name, address: address || null }
      onSaved(client ? await api.clients.update(client.id, body) : await api.clients.create(body))
    } catch (e) {
      const err = e as ApiError
      setErrors({ ...err.fields, _: err.fields && Object.keys(err.fields).length ? '' : err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Редактор клиента"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={save} disabled={busy}>Сохранить</button>
          <button className="btn btn--ghost" onClick={onClose}>Отмена</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Имя" required error={errors.name}>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Адрес" error={errors.address}>
          <textarea className="input" rows={4} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        {errors._ && <div className="alert">{errors._}</div>}
        <button hidden />
      </form>
    </Modal>
  )
}
