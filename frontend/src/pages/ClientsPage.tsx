import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useIsAdmin } from '../auth/AuthContext'
import { PageHeader } from '../components/Layout'
import { ApiError } from '../api/http'
import type { Client, Debts } from '../api/types'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { ConfirmModal, Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { RowActions, rowProps } from '../components/RowActions'
import { useToast } from '../components/Toast'
import { TableState, Toolbar } from '../components/Toolbar'
import { fmtMoney, parseNum } from '../lib/format'
import { useList } from '../lib/useList'

type View = 'all' | 'debtors'

export function ClientsPage() {
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [view, setView] = useState<View>(searchParams.get('view') === 'debtors' ? 'debtors' : 'all')
  const list = useList<Client>((p) => api.clients.list(p))
  const [debts, setDebts] = useState<Debts | null>(null)
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Client | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (view !== 'debtors') return
    let alive = true
    api.clients.debtors(200).then((d) => alive && setDebts(d)).catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [view])

  const open = (c: Client) => navigate(`/clients/${c.id}`)

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

  const rows = view === 'debtors' ? (debts?.debtors.map((d) => d.client) ?? []) : list.data.items
  const loading = view === 'debtors' ? debts === null : list.loading

  return (
    <section className="page">
      <PageHeader eyebrow="Анықтамалық" title="Клиенттер" />
      <Toolbar
        onCreate={() => setEditing('new')}
        search={list.q}
        onSearch={(q) => {
          setView('all')
          list.search(q)
        }}
        searchPlaceholder="Аты, телефоны немесе елді мекені"
      >
        <div className="chips" role="group" aria-label="Көрініс">
          <button className={`chip ${view === 'all' ? 'is-active' : ''}`} aria-pressed={view === 'all'} onClick={() => setView('all')}>
            Барлығы
          </button>
          <button className={`chip ${view === 'debtors' ? 'is-active' : ''}`} aria-pressed={view === 'debtors'} onClick={() => setView('debtors')}>
            Қарызы барлар
          </button>
        </div>
      </Toolbar>
      {view === 'debtors' && debts && (
        <div className="selection-bar">
          Жалпы қарыз: <b>{fmtMoney(debts.total)} ₸</b>
          <span className="selection-bar__nums">{debts.debtors.length} клиент</span>
        </div>
      )}
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      <div className={`table-wrap ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
        <table className="table table--cards">
          <thead>
            <tr>
              <th>Аты</th>
              <th style={{ width: 190 }}>Телефон</th>
              <th style={{ width: 200 }}>Елді мекен / базар</th>
              <th className="num" style={{ width: 150 }}>Қарызы, ₸</th>
              <th aria-label="Әрекеттер" style={{ width: 96 }} />
            </tr>
          </thead>
          <tbody>
            <TableState
              loading={loading}
              error={view === 'all' ? list.error : null}
              empty={rows.length === 0}
              emptyText={view === 'debtors' ? 'Қарызы бар клиент жоқ' : undefined}
              colSpan={5}
            />
            {rows.map((c) => (
              <tr key={c.id} {...rowProps(() => open(c), isAdmin ? () => setDeleting(c) : undefined, list.selected?.id === c.id)}>
                <td data-title>
                  <span className="strong">{c.name}</span>
                  {c.address && <span className="cell-sub">{c.address}</span>}
                </td>
                <td data-label="Телефон" className="nowrap">{c.phone}</td>
                <td data-label="Елді мекен">{c.city}</td>
                <td className={`num cell-amount ${c.debt > 0 ? 'text-debt' : 'muted-cell'}`}>
                  {c.debt > 0 ? `${fmtMoney(c.debt)} ₸` : '—'}
                </td>
                <RowActions name={c.name} onEdit={() => setEditing(c)} onDelete={isAdmin ? () => setDeleting(c) : undefined} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view === 'all' && (
        <div className="table-foot"><Pagination page={list.page} size={list.data.size} total={list.data.total} onChange={list.setPage} /></div>
      )}

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
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [city, setCity] = useState(client?.city ?? '')
  const [address, setAddress] = useState(client?.address ?? '')
  const [note, setNote] = useState(client?.note ?? '')
  const [openingDebt, setOpeningDebt] = useState(client?.openingDebt ? String(client.openingDebt) : '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const debt = parseNum(openingDebt)
    if (openingDebt.trim() && (debt === null || debt < 0)) {
      setErrors({ openingDebt: 'Теріс емес сан енгізіңіз' })
      return
    }
    setBusy(true)
    try {
      const body = {
        name,
        phone: phone || null,
        city: city || null,
        address: address || null,
        note: note || null,
        openingDebt: debt,
      }
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
      title={client ? 'Клиентті өзгерту' : 'Жаңа клиент'}
      width={560}
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
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ип.Анар" />
        </Field>
        <Field label="Телефон" error={errors.phone}>
          <input className="input" type="tel" inputMode="tel" autoComplete="off" value={phone}
            onChange={(e) => setPhone(e.target.value)} placeholder="+7 701 123 45 67" />
        </Field>
        <Field label="Елді мекен / базар" error={errors.city}>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Узынагаш, Еламан базары" />
        </Field>
        <Field label="Мекенжайы" error={errors.address}>
          <textarea className="input" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Қатар, контейнер, бағдар" />
        </Field>
        <Field label="Ескертпе" error={errors.note}>
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label="Бастапқы қарыз, ₸" error={errors.openingDebt}>
          <input className="input num-input" inputMode="decimal" value={openingDebt}
            onChange={(e) => setOpeningDebt(e.target.value)} placeholder="0" />
          <span className="field__hint">Жүйеге дейінгі қарыз. Ескі жүкқұжаттар төленген деп саналады.</span>
        </Field>
        {errors._ && <Alert>{errors._}</Alert>}
        <button hidden />
      </form>
    </Modal>
  )
}
