import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Product } from '../api/types'
import { pickFor, type PickOption } from '../lib/productPick'
import { useTranslation } from 'react-i18next'

/** Colour chips for the selected product: switch colour without searching again. */
export function ColourChips({ productId, selectedVariantId, onPick }: {
  productId: number
  selectedVariantId: number | null
  onPick: (o: PickOption) => void
}) {
  const [product, setProduct] = useState<Product | null>(null)
  const { t } = useTranslation()
  useEffect(() => {
    let alive = true
    api.products.get(productId).then((p) => alive && setProduct(p)).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [productId])
  const colours = product?.variants.filter((v) => v.active) ?? []
  if (!product || colours.length < 2) return null
  return (
    <div className="colour-chips" role="radiogroup" aria-label={t('colour.label')}>
      <span className="colour-chips__label">{t('colour.labelColon')}</span>
      {colours.map((v) => (
        <button key={v.id} type="button" role="radio" aria-checked={v.id === selectedVariantId}
          className={`chip ${v.id === selectedVariantId ? 'is-active' : ''}`} onClick={() => onPick(pickFor(product, v))}>
          {v.name}
        </button>
      ))}
    </div>
  )
}
