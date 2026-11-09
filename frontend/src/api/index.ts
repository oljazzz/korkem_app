import { http } from './http'
import type { Category, Client, ClientSummary, Company, Dashboard, Debts, MergePlan, MergeResult, MergeSide, Invoice, InvoiceListItem, Page, Payment, PaymentMethod, Product, SalesReport, Settings, Unit, User } from './types'

export interface ListParams {
  q?: string
  page?: number
  size?: number
  [key: string]: string | number | null | undefined
}

function crud<T, R>(base: string) {
  return {
    list: (p: ListParams = {}) => http.get<Page<T>>(base, p),
    get: (id: number) => http.get<T>(`${base}/${id}`),
    create: (body: R) => http.post<T>(base, body),
    update: (id: number, body: R) => http.put<T>(`${base}/${id}`, body),
    remove: (id: number) => http.delete(`${base}/${id}`),
  }
}

export type ClientRequest = {
  name: string
  address: string | null
  phone: string | null
  city: string | null
  note: string | null
  openingDebt: number | null
}
export type PaymentRequest = { amount: number; paidOn: string; method: PaymentMethod; note: string | null }
export type CompanyRequest = Omit<Company, never>
export type CategoryRequest = { name: string; sortOrder: number | null }
export type ProductRequest = { categoryId: number | null; name: string; price: number; sortOrder: number | null }
export type InvoiceRequest = {
  clientId: number | null
  /** Document date, YYYY-MM-DD (Almaty); omitted keeps the current date. */
  date?: string | null
  lines: {
    categoryId: number | null
    productId: number | null
    productName: string
    unit: string
    price: number
    quantity: number
    discount: number | null
    sortOrder: number | null
  }[]
}
export type UserRequest = Omit<User, 'id'> & { password: string | null }

export const api = {
  settings: () => http.get<Settings>('/api/settings'),
  updateCompany: (body: CompanyRequest) => http.put<Company>('/api/settings/company', body),
  clients: {
    ...crud<Client, ClientRequest>('/api/clients'),
    summary: (id: number) => http.get<ClientSummary>(`/api/clients/${id}/summary`),
    lastInvoice: (id: number) => http.get<Invoice>(`/api/clients/${id}/last-invoice`),
    debtors: (limit = 50) => http.get<Debts>('/api/clients/debtors', { limit }),
    duplicates: () => http.get<MergeSide[][]>('/api/clients/duplicates'),
    mergePlan: (clientId: number, otherId: number) => http.get<MergePlan>('/api/clients/merge-plan', { clientId, otherId }),
    merge: (clientId: number, otherId: number) => http.post<MergeResult>('/api/clients/merge', { clientId, otherId }),
  },
  payments: {
    list: (invoiceId: number) => http.get<Payment[]>(`/api/invoices/${invoiceId}/payments`),
    add: (invoiceId: number, body: PaymentRequest) => http.post<Payment>(`/api/invoices/${invoiceId}/payments`, body),
    remove: (id: number) => http.delete(`/api/payments/${id}`),
    methods: () => http.get<{ value: PaymentMethod; label: string }[]>('/api/payments/methods'),
  },
  categories: {
    ...crud<Category, CategoryRequest>('/api/categories'),
    all: () => http.get<Category[]>('/api/categories/all'),
  },
  products: crud<Product, ProductRequest>('/api/products'),
  invoices: {
    list: (p: ListParams = {}) => http.get<Page<InvoiceListItem>>('/api/invoices', p),
    get: (id: number) => http.get<Invoice>(`/api/invoices/${id}`),
    create: (body: InvoiceRequest) => http.post<Invoice>('/api/invoices', body),
    update: (id: number, body: InvoiceRequest) => http.put<Invoice>(`/api/invoices/${id}`, body),
    remove: (id: number) => http.delete(`/api/invoices/${id}`),
    units: () => http.get<Unit[]>('/api/invoices/units'),
  },
  reports: {
    dashboard: (from: string, to: string) => http.get<Dashboard>('/api/reports/dashboard', { from, to }),
    sales: (p: { from?: string; to?: string; clientId?: number | null; invoiceIds?: string }) =>
      http.get<SalesReport>('/api/reports/sales', p),
  },
  users: {
    list: () => http.get<User[]>('/api/users'),
    create: (body: UserRequest) => http.post<User>('/api/users', body),
    update: (id: number, body: UserRequest) => http.put<User>(`/api/users/${id}`, body),
    remove: (id: number) => http.delete(`/api/users/${id}`),
  },
}
