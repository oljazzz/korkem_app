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
  displayName: string
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

export interface Debts {
  total: number
  debtors: { client: Client; debt: number }[]
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
  clientName: string | null
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
  productName: string
  unit: UnitCode
  unitLabel?: string
  price: number
  quantity: number
  discount: number | null
  total: number
  vat: number
  sortOrder: number | null
}

export interface Invoice {
  id: number
  number: number
  clientId: number | null
  clientName: string | null
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
  vatRate: number
}

export interface SalesRow {
  productName: string
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
