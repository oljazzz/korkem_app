import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import type { ClientSummary } from '../api/types'
import { Alert } from '../components/Alert'
import { Icon } from '../components/Icon'
import { PaymentBadge } from '../components/PaymentBadge'
import { rowProps } from '../components/RowActions'
import { SkeletonList } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { fmt, fmtDate, fmtMoney } from '../lib/format'
import { ClientForm } from './ClientsPage'

/** Client card: contacts, debt, purchase history and favourite products, with "repeat last order". */
export function ClientPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState<ClientSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    api.clients.summary(Number(id)).then((d) => alive && setData(d)).catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [id, version])

  if (error) return <section className="page"><Alert>{error}</Alert></section>
  const c = data?.client
  const phones = c?.phone?.split(',').map((p) => p.trim()).filter(Boolean) ?? []

  return (
    <section className="page client">
      <div className="breadcrumbs">
        <Link to="/clients">Клиенттер</Link> › {c?.name ?? '…'}
      </div>
      <header className="client__head">
        <div className="client__who">
          <h1 className="page-title">{c?.name ?? 'Жүктелуде…'}</h1>
          {c && (
            <ul className="client__meta">
              {phones.map((p) => (
                <li key={p}>
                  <a className="text-link" href={`tel:${p.replace(/[^\d+]/g, '')}`}>{p}</a>
                </li>
              ))}
              {c.city && <li>{c.city}</li>}
              {c.address && <li className="muted">{c.address}</li>}
            </ul>
          )}
          {c?.note && <p className="client__note">{c.note}</p>}
        </div>
        <div className="client__actions">
          <button className="btn btn--ghost" onClick={() => setEditing(true)} disabled={!c}>
            <Icon name="edit" />Өзгерту
          </button>
          <button
            className="btn btn--outline"
            disabled={!data || data.invoiceCount === 0}
            title="Соңғы жүкқұжаттың тауарларын жаңа жүкқұжатқа көшіру"
            onClick={() => navigate(`/invoices/new?client=${id}&repeat=1`)}
          >
            <Icon name="repeat" />Соңғыны қайталау
          </button>
          <button className="btn btn--primary" disabled={!c} onClick={() => navigate(`/invoices/new?client=${id}`)}>
            <Icon name="plus" />Жаңа жүкқұжат
          </button>
        </div>
      </header>

      <div className={`kpis ${data ? '' : 'is-loading'}`}>
        <div className={`stat ${c && c.debt > 0 ? 'stat--debt' : ''}`}>
          <div className="stat__label">Қарызы</div>
          <div className="stat__value">{c ? fmtMoney(c.debt) : '—'}<span className="stat__unit">₸</span></div>
          {c && c.openingDebt > 0 && <div className="stat__exact">оның ішінде бастапқы {fmtMoney(c.openingDebt)} ₸</div>}
        </div>
        <div className="stat stat--plain">
          <div className="stat__label">Жүкқұжаттар</div>
          <div className="stat__value">{data ? fmt(data.invoiceCount) : '—'}</div>
        </div>
        <div className="stat stat--plain">
          <div className="stat__label">Жалпы сатып алу</div>
          <div className="stat__value">{data ? fmtMoney(data.total) : '—'}<span className="stat__unit">₸</span></div>
        </div>
        <div className="stat stat--plain">
          <div className="stat__label">Соңғы сатып алу</div>
          <div className="stat__value stat__value--date">{data?.lastInvoiceAt ? fmtDate(data.lastInvoiceAt) : '—'}</div>
        </div>
      </div>

      <div className="grid-2 client__grid">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Соңғы жүкқұжаттар</h2>
            {data && data.invoiceCount > data.recentInvoices.length && (
              <Link className="text-link" to={`/invoices?client=${id}`}>Барлығы ({fmt(data.invoiceCount)})</Link>
            )}
          </div>
          {!data ? <SkeletonList rows={5} /> : data.recentInvoices.length === 0 ? (
            <p className="muted">Жүкқұжаттар әлі жоқ</p>
          ) : (
            <table className="table table--compact">
              <tbody>
                {data.recentInvoices.map((i) => (
                  <tr key={i.id} {...rowProps(() => navigate(`/invoices/${i.id}`))}>
                    <td>
                      <span className="strong nowrap">№ {i.number}</span>
                      <span className="cell-sub">{fmtDate(i.createdAt)}</span>
                    </td>
                    <td><PaymentBadge status={i.status} /></td>
                    <td className="num strong">{fmtMoney(i.total)} ₸</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Жиі алатын тауарлары</h2>
            <span className="card__sub">барлық уақыт, сома бойынша</span>
          </div>
          {!data ? <SkeletonList rows={5} /> : data.topProducts.length === 0 ? (
            <p className="muted">Деректер жоқ</p>
          ) : (
            <ol className="top-products">
              {data.topProducts.map((p) => (
                <li key={p.name}>
                  <span className="top-products__name">{p.name}</span>
                  <span className="top-products__meta">{fmt(p.quantity)} дана · {p.invoices} рет</span>
                  <span className="top-products__sum">{fmtMoney(p.total)} ₸</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {editing && c && (
        <ClientForm
          client={c}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            setVersion((v) => v + 1)
            toast.show('Клиент сақталды')
          }}
        />
      )}
    </section>
  )
}
