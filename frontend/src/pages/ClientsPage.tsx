import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useIsAdmin } from '../auth/AuthContext'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { ApiError } from '../api/http'
import type { CityCount, Client, Debts, MergeSide } from '../api/types'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { MergeClientsModal } from '../components/MergeClientsModal'
import { ConfirmModal, Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { RowActions, rowProps } from '../components/RowActions'
import { useToast } from '../components/Toast'
import { TableState, Toolbar } from '../components/Toolbar'
import { fmt, fmtDate, fmtMoney, parseNum } from '../lib/format'
import { useList } from '../lib/useList'

type View = 'all' | 'debtors' | 'duplicates'

export function ClientsPage() {
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialView = searchParams.get('view')
  const [view, setView] = useState<View>(initialView === 'debtors' || initialView === 'duplicates' ? initialView : 'all')
  const [duplicates, setDuplicates] = useState<MergeSide[][] | null>(null)
  const [dupVersion, setDupVersion] = useState(0)
  const [mergePair, setMergePair] = useState<[number, number] | null>(null)
  const [city, setCity] = useState('')
  const [cities, setCities] = useState<CityCount[]>([])
  const list = useList<Client>((p) => api.clients.list({ ...p, city: city || null }))
  const [debts, setDebts] = useState<Debts | null>(null)
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Client | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.clients.cities().then(setCities).catch(() => setCities([]))
  }, [])

  useEffect(() => {
    if (view !== 'debtors') return
    let alive = true
    api.clients.debtors(200).then((d) => alive && setDebts(d)).catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [view])

  useEffect(() => {
    if (view !== 'duplicates') return
    let alive = true
    api.clients.duplicates().then((d) => alive && setDuplicates(d)).catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [view, dupVersion])

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
          <button className={`chip ${view === 'duplicates' ? 'is-active' : ''}`} aria-pressed={view === 'duplicates'} onClick={() => setView('duplicates')}>
            Қайталанатындар
          </button>
        </div>
        {view === 'all' && cities.length > 0 && (
          <select
            className="input toolbar__select"
            aria-label="Елді мекен / базар бойынша сүзу"
            value={city}
            onChange={(e) => {
              setCity(e.target.value)
              list.setPage(0)
              list.reload()
            }}
          >
            <option value="">Барлық елді мекендер</option>
            {cities.map((c) => <option key={c.city} value={c.city}>{c.city} ({c.clients})</option>)}
          </select>
        )}
      </Toolbar>
      {view === 'debtors' && debts && (
        <div className="selection-bar">
          Жалпы қарыз: <b>{fmtMoney(debts.total)} ₸</b>
          <span className="selection-bar__nums">{debts.debtors.length} клиент</span>
        </div>
      )}
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {view === 'duplicates' ? (
        <Duplicates
          groups={duplicates}
          canMerge={isAdmin}
          onOpen={open}
          onMerge={(primaryId, otherId) => setMergePair([primaryId, otherId])}
        />
      ) : (
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
                  <span className="strong">{c.label}</span>
                  {c.city && c.address && <span className="cell-sub">{c.address}</span>}
                  {!c.city && c.place && <span className="cell-sub">{c.place}</span>}
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
      )}
      {view === 'all' && (
        <div className="table-foot"><Pagination page={list.page} size={list.data.size} total={list.data.total} onChange={list.setPage} /></div>
      )}

      {mergePair && (
        <MergeClientsModal
          clientId={mergePair[0]}
          otherId={mergePair[1]}
          onClose={() => setMergePair(null)}
          onMerged={(r) => {
            setMergePair(null)
            setDupVersion((v) => v + 1)
            list.reload()
            toast.show(`«${r.removedName}» → «${r.primary.name}»: ${r.movedInvoices} жүкқұжат көшірілді`)
          }}
        />
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

/** Groups of clients sharing a phone number. The first in each group would stay after a merge. */
function Duplicates({ groups, canMerge, onOpen, onMerge }: {
  groups: MergeSide[][] | null
  canMerge: boolean
  onOpen: (c: Client) => void
  onMerge: (primaryId: number, otherId: number) => void
}) {
  if (!groups) return <div className="card"><p className="muted">Жүктелуде…</p></div>
  if (groups.length === 0) return <div className="card"><p className="muted">Телефоны бірдей клиенттер жоқ</p></div>
  return (
    <>
      <p className="muted dup-intro">
        Телефоны бірдей {groups.length} топ. Әр топта бірінші тұрған клиенттің соңғы жүкқұжаты жаңа, біріктіргенде сол қалады.
      </p>
      <div className="dup-list">
        {groups.map((g) => (
          <div key={g.map((s) => s.client.id).join('-')} className="dup">
            {g.map((s, i) => (
              <div key={s.client.id} className={`dup__row ${i === 0 ? 'is-primary' : ''}`}>
                <button className="dup__name link-btn" onClick={() => onOpen(s.client)}>{s.client.name}</button>
                <span className="dup__meta">
                  {s.client.phone}
                  {(s.client.city || s.client.address) && ` · ${s.client.city ?? s.client.address}`}
                </span>
                <span className="dup__stats">
                  {fmt(s.invoiceCount)} жүкқұжат · {s.lastInvoiceAt ? fmtDate(s.lastInvoiceAt) : 'жүкқұжаты жоқ'}
                </span>
                {i === 0 ? (
                  <span className="dup__tag">Басты</span>
                ) : canMerge ? (
                  <button className="btn btn--outline btn--s" onClick={() => onMerge(g[0].client.id, s.client.id)}>
                    <Icon name="merge" />Біріктіру
                  </button>
                ) : <span />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
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
