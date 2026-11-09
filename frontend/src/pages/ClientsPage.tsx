import { useState } from 'react'
import { api } from '../api'
import { useIsAdmin } from '../auth/AuthContext'
import { PageHeader } from '../components/Layout'
import { ApiError } from '../api/http'
import type { Client } from '../api/types'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { ConfirmModal, Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { RowActions, rowProps } from '../components/RowActions'
import { useToast } from '../components/Toast'
import { TableState, Toolbar } from '../components/Toolbar'
import { useList } from '../lib/useList'

export function ClientsPage() {
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const list = useList<Client>((p) => api.clients.list(p))
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Client | null>(null)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    const c = deleting
    setDeleting(null)
    if (!c) return
    try {
      await api.clients.remove(c.id)
      list.reload()
      toast.show(`«${c.name}» жойылды`)
    } catch (e) {
      setError((e as ApiError).status === 409 ? 'Клиенттің жүкқұжаттары бар — жоюға болмайды' : (e as Error).message)
    }
  }

  return (
    <section className="page">
      <PageHeader eyebrow="Анықтамалық" title="Клиенттер" />
      <Toolbar
        onCreate={() => setEditing('new')}
        search={list.q}
        onSearch={list.search}
        searchPlaceholder="Аты немесе мекенжайы бойынша іздеу"
      />
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      <div className={`table-wrap ${list.loading ? 'is-loading' : ''}`} aria-busy={list.loading}>
        <table className="table table--cards">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Аты</th>
              <th>Мекенжайы</th>
              <th aria-label="Әрекеттер" />
            </tr>
          </thead>
          <tbody>
            <TableState loading={list.loading} error={list.error} empty={list.data.items.length === 0} colSpan={3} />
            {list.data.items.map((c) => (
              <tr key={c.id} {...rowProps(() => setEditing(c), isAdmin ? () => setDeleting(c) : undefined, list.selected?.id === c.id)}>
                <td className="strong" data-title>{c.name}</td>
                <td data-label="Мекенжайы">{c.address}</td>
                <RowActions name={c.name} onEdit={() => setEditing(c)} onDelete={isAdmin ? () => setDeleting(c) : undefined} />
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
            toast.show('Клиент сақталды')
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Клиентті жою"
          confirmLabel="Жою"
          cancelLabel="Болдырмау"
          danger
          text={`«${deleting.name}» клиентін жою керек пе?`}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
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
      title="Клиент"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={save} disabled={busy}>Сақтау</button>
          <button className="btn btn--ghost" onClick={onClose}>Болдырмау</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Аты" required error={errors.name}>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Мекенжайы" error={errors.address}>
          <textarea className="input" rows={4} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        {errors._ && <Alert>{errors._}</Alert>}
        <button hidden />
      </form>
    </Modal>
  )
}
