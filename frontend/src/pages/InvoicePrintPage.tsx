import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { Invoice } from '../api/types'
import { Icon } from '../components/Icon'
import { fmtDate, fmtMoney } from '../lib/format'
import { useSettings } from '../lib/settings'
import { moneyToWords, quantityToWords } from '../lib/words'

/**
 * Goods issue note, form Z-2 (appendix 26 to order No. 562 of the Minister of Finance of the
 * Republic of Kazakhstan, 20.12.2012), Kazakh version. Replaces the legacy "invoice report" template.
 */
export function InvoicePrintPage() {
  const { id } = useParams()
  const { company } = useSettings()
  const [inv, setInv] = useState<Invoice | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.invoices.get(Number(id)).then(setInv).catch((e: Error) => setError(e.message))
  }, [id])

  if (error) return <section className="page"><div className="alert">{error}</div></section>
  if (!inv) return <section className="page"><p className="muted">Жүктелуде…</p></section>

  const qty = inv.lines.reduce((s, l) => s + l.quantity, 0)

  return (
    <section className="page">
      <div className="print-actions no-print">
        <Link className="btn btn--ghost" to={`/invoices/${inv.id}`}>
          <Icon name="back" />
          Жүкқұжатқа оралу
        </Link>
        <button className="btn btn--primary" onClick={() => window.print()}>
          <Icon name="print" />
          Басып шығару / PDF
        </button>
        <span className="muted">З-2 нысаны · альбомдық бағдар</span>
      </div>

      <article className="z2" lang="kk">
        <div className="z2__appendix">
          Қазақстан Республикасы
          <br />Қаржы министрінің
          <br />2012 жылғы 20 желтоқсандағы
          <br />№ 562 бұйрығына 26-қосымша
          <div className="z2__form">З-2 нысаны</div>
        </div>

        <div className="z2__org">
          <span>Ұйым (дара кәсіпкер)</span>
          <b>{company.name}</b>
        </div>

        <table className="z2__doc">
          <thead>
            <tr>
              <th>Құжат нөмірі</th>
              <th>Жасалған күні</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{inv.number}</td>
              <td>{fmtDate(inv.createdAt)}</td>
            </tr>
          </tbody>
        </table>

        <h1 className="z2__title">ҚОРЛАРДЫ ЖАҚҚА БОСАТУҒА АРНАЛҒАН ЖҮКҚҰЖАТ</h1>

        <table className="z2__table">
          <thead>
            <tr>
              <th>Жіберуші ұйым (дара кәсіпкер)</th>
              <th>Алушы ұйым (дара кәсіпкер)</th>
              <th>Жеткізуге жауапты адам (Т.А.Ә.)</th>
              <th>Көлік ұйымы</th>
              <th>Тауар-көлік жүкқұжаты (нөмірі, күні)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{company.name}</td>
              <td>{inv.clientName ?? ''}</td>
              <td />
              <td />
              <td />
            </tr>
          </tbody>
        </table>

        <table className="z2__table z2__items">
          <thead>
            <tr>
              <th rowSpan={2}>Реттік нөмірі</th>
              <th rowSpan={2}>Атауы, сипаттамасы</th>
              <th rowSpan={2}>Номенкла&shy;туралық нөмірі</th>
              <th rowSpan={2}>Өлшем бірлігі</th>
              <th colSpan={2}>Саны</th>
              <th rowSpan={2}>Бірлік бағасы, KZT</th>
              <th rowSpan={2}>ҚҚС-пен сомасы, KZT</th>
              <th rowSpan={2}>ҚҚС сомасы, KZT</th>
            </tr>
            <tr>
              <th>босатуға жататыны</th>
              <th>босатылғаны</th>
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
                <td className="c">{l.unitLabel ?? 'дана'}</td>
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
              <td colSpan={4} className="r">Барлығы</td>
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
            <span>Барлық босатылған қорлар саны (жазумен)</span>
            <b>{quantityToWords(qty)}</b>
          </div>
          <div>
            <span>сомасы (жазумен), KZT</span>
            <b>{moneyToWords(inv.total)}</b>
          </div>
        </div>

        <div className="z2__signs">
          <div className="z2__sign">
            <span className="z2__role">Босатуға рұқсат берген</span>
            <span className="z2__line"><i>лауазымы</i></span>/
            <span className="z2__line"><i>қолы</i></span>/
            <span className="z2__line z2__line--name">{company.releaseAllowedBy}<i>қолтаңбаның толық жазылуы</i></span>
          </div>
          <div className="z2__sign">
            <span className="z2__role">Сенімхат бойынша №</span>
            <span className="z2__line" />
            <span>20___ жылғы «___» ____________</span>
          </div>
          <div className="z2__sign">
            <span className="z2__role">Бас бухгалтер</span>
            <span className="z2__line"><i>қолы</i></span>/
            <span className="z2__line z2__line--name">{company.chiefAccountant}<i>қолтаңбаның толық жазылуы</i></span>
          </div>
          <div className="z2__sign">
            <span className="z2__role">берілген</span>
            <span className="z2__line z2__line--wide" />
          </div>
          <div className="z2__sign z2__mp">М.О.</div>
          <div className="z2__sign" />
          <div className="z2__sign">
            <span className="z2__role">Босатқан</span>
            <span className="z2__line"><i>қолы</i></span>/
            <span className="z2__line z2__line--name"><i>қолтаңбаның толық жазылуы</i></span>
          </div>
          <div className="z2__sign">
            <span className="z2__role">Қорларды алған</span>
            <span className="z2__line"><i>қолы</i></span>/
            <span className="z2__line z2__line--name"><i>қолтаңбаның толық жазылуы</i></span>
          </div>
        </div>
      </article>
    </section>
  )
}
