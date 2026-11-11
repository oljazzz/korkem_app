import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Category, Product } from '../api/types'
import { Alert } from '../components/Alert'
import { Icon } from '../components/Icon'
import { fmtDayLong, fmtMoney, fmtPack, fmtPricePerBase, isoDay } from '../lib/format'
import { useSettings } from '../lib/settings'
import { useTranslation } from 'react-i18next'

/** Customer-facing price list, grouped by category; printed or saved as PDF from the browser (A4 portrait). */
export function PriceListPrintPage() {
  const [params, setParams] = useSearchParams()
  const categoryId = Number(params.get('category')) || null
  const { company } = useSettings()
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState<{ categoryId: number | null; items: Product[] } | null>(null)
  const products = loaded && loaded.categoryId === categoryId ? loaded.items : null
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [today] = useState(() => isoDay(new Date()))

  useEffect(() => {
    api.categories.all().then(setCategories).catch(() => undefined)
  }, [])

  useEffect(() => {
    let alive = true
    api.products.list({ categoryId, size: 200, page: 0 }).then(async (first) => {
      // Fetch the remaining pages so the list is complete
      const pages = Math.ceil(first.total / first.size)
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, pages - 1) }, (_, i) => api.products.list({ categoryId, size: 200, page: i + 1 })),
      )
      if (alive) setLoaded({ categoryId, items: [first, ...rest].flatMap((p) => p.items) })
    }).catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [categoryId])

  const groups = useMemo(() => {
    const map = new Map<string, Product[]>()
    ;(products ?? []).forEach((p) => {
      const key = p.categoryName ?? t('priceList.otherProducts')
      map.set(key, [...(map.get(key) ?? []), p])
    })
    return [...map.entries()]
  }, [products, t])

  const contacts = [company.address, company.phone].filter(Boolean).join(' · ')
  const selected = categories.find((c) => c.id === categoryId)

  return (
    <section className="page">
      <div className="print-actions no-print">
        <Link className="btn btn--ghost" to="/products"><Icon name="back" />{t('priceList.back')}</Link>
        <select
          className="input toolbar__select"
          aria-label={t('priceList.category')}
          value={categoryId ?? ''}
          onChange={(e) => setParams(e.target.value ? { category: e.target.value } : {})}
        >
          <option value="">{t('priceList.allCategories')}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn--primary" onClick={() => window.print()} disabled={!products}>
          <Icon name="print" />{t('priceList.print')}
        </button>
        <span className="muted">{t('priceList.printHint')}</span>
      </div>
      {error && <Alert>{error}</Alert>}
      {/* The default print page is landscape; a price list reads better in portrait */}
      <style>{'@media print { @page { size: A4 portrait; margin: 12mm; } }'}</style>

      <article className="pricelist" lang="kk">
        <header className="pricelist__head">
          <div>
            <div className="pricelist__company">{company.name}</div>
            {contacts && <div className="pricelist__contacts">{contacts}</div>}
            {company.bin && <div className="pricelist__contacts">{t('priceList.bin', { bin: company.bin })}</div>}
          </div>
          <div className="pricelist__title">
            <h1>{t('priceList.title')}</h1>
            <div>{t('priceList.asOf', { date: fmtDayLong(today) })}{selected ? ` · ${selected.name}` : ''}</div>
          </div>
        </header>

        {!products ? <p className="muted">{t('common.loading')}</p> : (
          <table className="pricelist__table">
            <thead>
              <tr><th className="c">{t('priceList.no')}</th><th>{t('priceList.name')}</th><th className="p">{t('priceList.pack')}</th><th className="n">{t('priceList.price')}</th></tr>
            </thead>
            {groups.map(([name, items]) => (
              <tbody key={name}>
                <tr className="pricelist__group"><td colSpan={4}>{name}</td></tr>
                {items.map((p, i) => (
                  <tr key={p.id}>
                    <td className="c">{i + 1}</td>
                    <td>
                      {p.name}
                      {p.variants.some((v) => v.active) && (
                        <span className="pricelist__colours">
                          {t('priceList.colours', { list: p.variants.filter((v) => v.active).map((v) => v.name + (v.price !== null ? ` (${fmtMoney(v.price)} ₸)` : '')).join(', ') })}
                        </span>
                      )}
                    </td>
                    <td className="p">{fmtPack(p.packAmount, p.packUnit)}</td>
                    <td className="n">
                      {fmtMoney(p.price)}
                      {p.packAmount && p.price > 0 && <span className="pricelist__per">{fmtPricePerBase(p.price, p.packAmount, p.packUnit)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        )}
        <footer className="pricelist__foot">{t('priceList.footer')}</footer>
      </article>
    </section>
  )
}
