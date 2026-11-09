import { api } from '../api'
import type { Product, ProductOption as ProductPick, ProductVariant } from '../api/types'
import type { Option } from '../components/AsyncSelect'
import { fmtMoney, fmtPack } from './format'

export type PickOption = Option & { opt: ProductPick }

/** Products without colours and each colour of the rest; colours get negative ids so they never clash. */
export const loadProducts = (text: string, categoryId: number | null = null): Promise<PickOption[]> =>
  api.products.options(text, categoryId).then((items) =>
    items.map((o) => ({
      id: o.variantId ? -o.variantId : o.productId,
      label: o.label,
      hint: [`${fmtMoney(o.price)} ₸`, fmtPack(o.packAmount, o.packUnit) || null, o.categoryName].filter(Boolean).join(' · '),
      opt: o,
    })),
  )

/** Option built from a product and one of its colours (used when switching colour with the chips). */
export function pickFor(product: Product, variant: ProductVariant | null): PickOption {
  const label = variant ? `${product.name} — ${variant.name}` : product.name
  const price = variant?.price ?? product.price
  return {
    id: variant ? -variant.id : product.id,
    label,
    opt: {
      productId: product.id, variantId: variant?.id ?? null, label, productName: product.name,
      variantName: variant?.name ?? null, price, packAmount: product.packAmount, packUnit: product.packUnit,
      categoryId: product.categoryId, categoryName: product.categoryName,
    },
  }
}
