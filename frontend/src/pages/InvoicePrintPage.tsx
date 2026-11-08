import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { Company, Invoice } from '../api/types'
import { Icon } from '../components/Icon'
import { fmtDate, fmtMoney } from '../lib/format'
import { moneyToWords, quantityToWords } from '../lib/words'

/**
 * Накладная на отпуск запасов на сторону — Форма З-2
 * (Приложение 26 к приказу Министра финансов РК от 20.12.2012 № 562).
 * Ескі жүйедегі «Отчет по накладным» шаблонының көшірмесі.
 */
export function InvoicePrintPage() {
  const { id } = useParams()
  const [inv, setInv] = useState<Invoice | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.invoices.get(Number(id)).then(setInv).catch((e: Error) => setError(e.message))
    api.reports.company().then(setCompany).catch(() => undefined)
  }, [id])

  if (error) return <section className="page"><div className="alert">{error}</div></section>
  if (!inv) return <section className="page"><p className="muted">Загрузка…</p></section>

  const qty = inv.lines.reduce((s, l) => s + l.quantity, 0)
  const sender = company?.name ?? ''
  const client = inv.clientName ?? ''

  return (
    <section className="page">
      <div className="print-actions no-print">
        <Link className="btn btn--ghost" to={`/invoices/${inv.id}`}>
          <Icon name="back" />
          К накладной
        </Link>
        <button className="btn btn--primary" onClick={() => window.print()}>
          <Icon name="print" />
          Печать / PDF
        </button>
        <span className="muted">Форма З-2 · альбомная ориентация</span>
      </div>

      <article className="z2">
        <div className="z2__appendix">
          Приложение 26
          <br />к приказу Министра финансов
          <br />Республики Казахстан
          <br />от 20 декабря 2012 года № 562
          <div className="z2__form">Форма З-2</div>
        </div>

        <div className="z2__org">
          <span>Организация (индивидуальный предприниматель)</span>
          <b>{sender}</b>
        </div>

        <table className="z2__doc">
          <thead>
            <tr>
              <th>Номер документа</th>
              <th>Дата составления</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{inv.number}</td>
              <td>{fmtDate(inv.createdAt)}</td>
            </tr>
          </tbody>
        </table>

        <h1 className="z2__title">НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ</h1>

        <table className="z2__table">
          <thead>
            <tr>
              <th>Организация (индивидуальный предприниматель) — отправитель</th>
              <th>Организация (индивидуальный предприниматель) — получатель</th>
              <th>Ответственный за поставку (Ф.И.О.)</th>
              <th>Транспортная организация</th>
              <th>Товарно-транспортная накладная (номер, дата)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{sender}</td>
              <td>{client}</td>
              <td />
              <td />
              <td />
            </tr>
          </tbody>
        </table>

        <table className="z2__table z2__items">
          <thead>
            <tr>
              <th rowSpan={2}>Номер по порядку</th>
              <th rowSpan={2}>Наименование, характеристика</th>
              <th rowSpan={2}>Номенкла&shy;турный номер</th>
              <th rowSpan={2}>Единица измерения</th>
              <th colSpan={2}>Количество</th>
              <th rowSpan={2}>Цена за единицу, в KZT</th>
              <th rowSpan={2}>Сумма с НДС, в KZT</th>
              <th rowSpan={2}>Сумма НДС, в KZT</th>
            </tr>
            <tr>
              <th>подлежит отпуску</th>
              <th>отпущено</th>
            </tr>
            <tr className="z2__nums">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <th key={n}>{n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={l.id ?? i}>
                <td className="c">{i + 1}</td>
                <td>{l.productName}</td>
                <td />
                <td className="c">шт</td>
                <td className="n">{fmtMoney(l.quantity)}</td>
                <td className="n">{fmtMoney(l.quantity)}</td>
                <td className="n">{fmtMoney(l.quantity ? l.total / l.quantity : l.price)}</td>
                <td className="n">{fmtMoney(l.total)}</td>
                <td className="n">{fmtMoney(l.vat)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="r">Итого</td>
              <td className="n">{fmtMoney(qty)}</td>
              <td className="n">{fmtMoney(qty)}</td>
              <td className="x">x</td>
              <td className="n">{fmtMoney(inv.total)}</td>
              <td className="n">{fmtMoney(inv.vat)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="z2__words">
          <div>
            <span>Всего отпущено количество запасов (прописью)</span>
            <b>{quantityToWords(qty)}</b>
          </div>
          <div>
            <span>на сумму (прописью), в KZT</span>
            <b>{moneyToWords(inv.total)}</b>
          </div>
        </div>

        <div className="z2__signs">
          <div className="z2__sign">
            <span className="z2__role">Отпуск разрешил</span>
            <span className="z2__line"><i>должность</i></span>/
            <span className="z2__line"><i>подпись</i></span>/
            <span className="z2__line z2__line--name">{company?.releaseAllowedBy}<i>расшифровка подписи</i></span>
          </div>
          <div className="z2__sign">
            <span className="z2__role">По доверенности №</span>
            <span className="z2__line" />
            <span>от «___» ____________ 20___ года</span>
          </div>
          <div className="z2__sign">
            <span className="z2__role">Главный бухгалтер</span>
            <span className="z2__line"><i>подпись</i></span>/
            <span className="z2__line z2__line--name">{company?.chiefAccountant}<i>расшифровка подписи</i></span>
          </div>
          <div className="z2__sign">
            <span className="z2__role">выданной</span>
            <span className="z2__line z2__line--wide" />
          </div>
          <div className="z2__sign z2__mp">М.П.</div>
          <div className="z2__sign" />
          <div className="z2__sign">
            <span className="z2__role">Отпустил</span>
            <span className="z2__line"><i>подпись</i></span>/
            <span className="z2__line z2__line--name"><i>расшифровка подписи</i></span>
          </div>
          <div className="z2__sign">
            <span className="z2__role">Запасы получил</span>
            <span className="z2__line"><i>подпись</i></span>/
            <span className="z2__line z2__line--name"><i>расшифровка подписи</i></span>
          </div>
        </div>
      </article>
    </section>
  )
}
