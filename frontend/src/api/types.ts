export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface Client {
  id: number
  name: string
  address: string | null
  phone: string | null
  city: string | null
  note: string | null
  openingDebt: number
  /** Full "name - address", as printed on documents. */
  displayName: string
  /** Name without phone numbers, for lists. */
  label: string
  /** Town/market, or the address without phone numbers. */
  place: string | null
  /** Opening debt plus what is still owed on invoices. */
  debt: number
}

export interface TopProduct {
  name: string
  quantity: number
  total: number
  invoices: number
}

export interface ClientSummary {
  client: Client
  invoiceCount: number
  total: number
  lastInvoiceAt: string | null
  recentInvoices: InvoiceListItem[]
  topProducts: TopProduct[]
}

/** A client in a merge: the figures that decide which record stays. */
export interface MergeSide {
  client: Client
  invoiceCount: number
  lastInvoiceAt: string | null
}

export interface MergePlan {
  primary: MergeSide
  secondary: MergeSide
}

export interface MergeResult {
  primary: Client
  movedInvoices: number
  removedName: string
}

export interface Debts {
  total: number
  debtors: { client: Client; debt: number }[]
}

export interface InvoiceSummary {
  count: number
  total: number
  due: number
}

export interface CityCount {
  city: string
  clients: number
}

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID'
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER'

export interface Payment {
  id: number
  invoiceId: number
  amount: number
  paidOn: string
  method: PaymentMethod
  methodLabel: string
  note: string | null
  createdBy: string | null
  createdAt: string
}

export interface Category {
  id: number
  name: string
  sortOrder: number | null
}

export interface Product {
  id: number
  categoryId: number | null
  categoryName: string | null
  name: string
  price: number
  sortOrder: number | null
  /** How much one unit holds, in packUnit (kg or l). */
  packAmount: number | null
  packUnit: 'KG' | 'L' | null
  /** Colours; empty when the product is sold without them. */
  variants: ProductVariant[]
}

export interface ProductVariant {
  id: number
  name: string
  /** Own price; null = the product price. */
  price: number | null
  active: boolean
  sortOrder: number | null
}

/** One thing that can go on an invoice line: a product, or one colour of it. */
export interface ProductOption {
  productId: number
  variantId: number | null
  label: string
  productName: string
  variantName: string | null
  price: number
  packAmount: number | null
  packUnit: 'KG' | 'L' | null
  categoryId: number | null
  categoryName: string | null
}

export interface GroupMember {
  productId: number
  name: string
  variantName: string
  price: number
  invoiceLines: number
}

export interface GroupSuggestion {
  name: string
  categoryId: number | null
  categoryName: string | null
  price: number
  packAmount: number | null
  packUnit: 'KG' | 'L' | null
  /** Same product spelled differently: merge without colours. */
  duplicates: boolean
  members: GroupMember[]
}

export type UnitCode = 'SHT' | 'KG' | 'M' | 'L' | 'PACK'

export interface Unit {
  value: UnitCode
  label: string
}

export interface InvoiceListItem {
  id: number
  number: number
  clientId: number | null
  /** Short client name (no phone numbers). */
  clientName: string | null
  clientPlace: string | null
  createdAt: string
  total: number
  paid: number
  due: number
  status: PaymentStatus
}

export interface InvoiceLine {
  id?: number | null
  categoryId: number | null
  categoryName: string | null
  productId: number | null
  variantId?: number | null
  productName: string
  unit: UnitCode
  unitLabel?: string
  price: number
  quantity: number
  discount: number | null
  total: number
  /** Sent by the server; not shown in the UI. */
  vat?: number
  sortOrder: number | null
}

export interface Invoice {
  id: number
  number: number
  clientId: number | null
  /** Full "name - address", printed on form Q-2. */
  clientName: string | null
  clientLabel: string | null
  createdAt: string
  createdBy: string | null
  lines: InvoiceLine[]
  total: number
  vat: number
  paid: number
  due: number
  status: PaymentStatus
  /** Created before payments were tracked; counts as paid. */
  legacyPaid: boolean
}

export type Role = 'ADMIN' | 'MANAGER'

export interface User {
  id: number
  username: string
  firstName: string | null
  lastName: string | null
  email: string | null
  timeZone: string | null
  role: Role
  active: boolean
}

export interface Company {
  name: string
  bin: string | null
  address: string | null
  phone: string | null
  chiefAccountant: string | null
  releaseAllowedBy: string | null
}

export interface Settings {
  company: Company
}

export interface SalesRow {
  productName: string
  /** Product a colour belongs to; equals productName for products without colours. */
  groupName: string
  categoryName: string | null
  quantity: number
  avgPrice: number
  total: number
  vat: number
  invoices: number
}

export interface SalesReport {
  from: string | null
  to: string | null
  invoiceCount: number
  rows: SalesRow[]
  totalQuantity: number
  total: number
  vat: number
}

export interface Kpi {
  revenue: number
  invoices: number
  avgCheck: number
  vat: number
  clients: number
}

export interface Ranked {
  /** Client id in the top-clients list. */
  id: number | null
  name: string
  revenue: number
  quantity: number
  invoices: number
}

export interface Dashboard {
  from: string
  to: string
  granularity: 'day' | 'month'
  current: Kpi
  previous: Kpi
  series: { label: string; start: string; revenue: number; invoices: number }[]
  topProducts: Ranked[]
  topClients: Ranked[]
  categories: Ranked[]
  lastInvoiceAt: string | null
}
