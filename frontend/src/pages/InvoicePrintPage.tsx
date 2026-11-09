import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { Invoice } from '../api/types'
import { Alert } from '../components/Alert'
import { Icon } from '../components/Icon'
import { fmtDate, fmtMoney } from '../lib/format'
import { useNarrow } from '../lib/useNarrow'
import { useSettings } from '../lib/settings'
import { moneyToWords, quantityToWords } from '../lib/words'

/**
 * Goods issue note, form Q-2 (Kazakh edition of Z-2): appendix 26 to order No. 562 of the
 * Minister of Finance of the Republic of Kazakhstan, 20.12.2012. Layout follows the official
 * template. Desktop shows and prints A4 landscape; phones get A4 portrait, which fits a narrow
 * screen better. On screen the sheet is scaled down to fit the available width.
 */
export function InvoicePrintPage() {
  const { id } = useParams()
  const { company } = useSettings()
  const [inv, setInv] = useState<Invoice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const portrait = useNarrow()
  const scale = useFitScale(portrait ? SHEET_WIDTH.portrait : SHEET_WIDTH.landscape)

  useEffect(() => {
    api.invoices.get(Number(id)).then(setInv).catch((e: Error) => setError(e.message))
  }, [id])

  if (error) return <section className="page"><Alert>{error}</Alert></section>
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
        <span className="muted">Қ-2 нысаны · А4, {portrait ? 'кітаптық' : 'альбомдық'} бағдар</span>
      </div>

      {/* Overrides the default landscape page size when printing from a phone */}
      <style>{`@media print { @page { size: A4 ${portrait ? 'portrait' : 'landscape'}; margin: 10mm; } }`}</style>
      <div className="z2-scroll" ref={scale.ref}>
      <article className={`z2 ${portrait ? 'z2--portrait' : ''}`} style={{ zoom: scale.value }} lang="kk">
        <div className="z2__appendix">
          Қазақстан Республикасы
          <br />Қаржы министрінің
          <br />2012 жылғы 20 желтоқсандағы
          <br />№ 562 бұйрығына
          <br />26-қосымша
          <div className="z2__form">Қ-2 нысаны</div>
        </div>

        <div className="z2__head">
          <div className="z2__org">
            <span>Ұйым (жеке кәсіпкер)</span>
            <b>{company.name}</b>
          </div>
          <div className="z2__bin">
            <span>ЖСН/БСН</span>
            <BinBoxes value={company.bin} />
          </div>
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

        <h1 className="z2__title">ҚОРЛАРДЫ ШЕТКЕ БЕРУГЕ АРНАЛҒАН ЖҮКҚҰЖАТ</h1>

        <table className="z2__table z2__parties">
          <thead>
            <tr>
              <th>Жөнелтуші ұйым (жеке кәсіпкер)</th>
              <th>Алушы ұйым (жеке кәсіпкер)</th>
              <th>Жеткізуге жауапты (аты-жөні)</th>
              <th>Көліктік ұйым</th>
              <th>Тауарлық-көліктік жүкқұжат (нөмірі, күні)</th>
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
          <colgroup>
            <col style={{ width: '5%' }} />
            <col />
            <col style={{ width: '9%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '7.5%' }} />
            <col style={{ width: '7.5%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>Ретімен нөмірі</th>
              <th rowSpan={2}>Атауы, мінездемесі</th>
              <th rowSpan={2}>Номенклатуралық нөмірі</th>
              <th rowSpan={2}>Өлшем бірлігі</th>
              <th colSpan={2}>Саны</th>
              <th rowSpan={2}>Бірлігінің бағасы, теңгемен</th>
              <th rowSpan={2}>ҚҚС-пен сомасы, теңгемен</th>
              <th rowSpan={2}>ҚҚС сомасы, теңгемен</th>
            </tr>
            <tr>
              <th>беруге жатады</th>
              <th>берілгені</th>
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
              <td colSpan={4} className="r">Жиыны</td>
              <td className="n">{fmtMoney(qty)}</td>
              <td className="n">{fmtMoney(qty)}</td>
              <td className="c">х</td>
              <td className="n">{fmtMoney(inv.total)}</td>
              <td className="n">{fmtMoney(inv.vat)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="z2__words">
          <div>
            <span>Барлық берілген қорлардың саны (жазумен)</span>
            <b>{quantityToWords(qty)}</b>
            <span>сомаға (жазумен), теңгемен</span>
          </div>
          <div>
            <b>{moneyToWords(inv.total)}</b>
          </div>
        </div>

        <div className="z2__signs">
          <div className="z2__col">
            <Sign role="Беруге рұқсат еткен" hints={['лауазымы', 'қолы', 'қолды таратып жазу']} values={['', '', company.releaseAllowedBy]} />
            <Sign role="Бас бухгалтер" hints={['қолы', 'қолды таратып жазу']} values={['', company.chiefAccountant]} />
            <div className="z2__mp">М.О.</div>
            <Sign role="Берген" hints={['қолы', 'қолды таратып жазу']} />
          </div>
          <div className="z2__col">
            <div className="z2__row">
              <span className="z2__line z2__line--grow" />
              <span>берген</span>
            </div>
            <div className="z2__row">
              <span>20</span><span className="z2__line z2__line--xs" /><span>жылғы «</span>
              <span className="z2__line z2__line--xs" /><span>»</span>
              <span className="z2__line z2__line--s" />
              <span>№</span><span className="z2__line z2__line--grow" />
              <span>сенімхат бойынша</span>
            </div>
            <Sign role="Қорларды алған" hints={['қолы', 'қолды таратып жазу']} />
          </div>
        </div>
      </article>
      </div>
    </section>
  )
}

/** Sheet widths in CSS pixels: A4 at 96 dpi. */
const SHEET_WIDTH = { landscape: 1123, portrait: 794 }

/** Zoom factor that fits a sheet of the given width into its container (never enlarges). */
function useFitScale(width: number) {
  // Callback ref: the container mounts only after the invoice has loaded
  const [el, ref] = useState<HTMLDivElement | null>(null)
  const [value, setValue] = useState(1)
  useEffect(() => {
    if (!el) return
    const update = () => setValue(Math.min(1, el.clientWidth / width))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el, width])
  return { ref, value }
}

/** A label followed by underlined fields separated by "/", each with a small caption below. */
function Sign({ role, hints, values = [] }: { role: string; hints: string[]; values?: ReactNode[] }) {
  return (
    <div className="z2__row z2__row--sign">
      <span className="z2__role">{role}</span>
      {hints.map((h, i) => (
        <span key={h} className="z2__field">
          {i > 0 && <span className="z2__slash">/</span>}
          <span className={`z2__line ${i === hints.length - 1 ? 'z2__line--name' : ''}`}>
            {values[i]}
            <i>{h}</i>
          </span>
        </span>
      ))}
    </div>
  )
}

/** IIN/BIN as 12 boxed digits, like the boxes on the paper form. */
function BinBoxes({ value }: { value: string }) {
  const digits = (value ?? '').replace(/\D/g, '').slice(0, 12).padEnd(12, ' ').split('')
  return (
    <span className="z2__boxes" aria-label={value || 'ЖСН/БСН көрсетілмеген'}>
      {digits.map((d, i) => (
        <span key={i}>{d.trim()}</span>
      ))}
    </span>
  )
}
