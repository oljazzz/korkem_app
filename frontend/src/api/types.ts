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
  displayName: string
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
  chiefAccountant: string
  releaseAllowedBy: string
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
