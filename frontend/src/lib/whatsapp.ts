import type { TFunction } from 'i18next'
import type { Client, Invoice, InvoiceListItem, Reconciliation } from '../api/types'
import { fmt, fmtDate, fmtMoney } from './format'

/**
 * WhatsApp "click to chat" links (wa.me): they open the chat with the text filled in, and the user
 * sends it. No API and no account on our side, but text only: a PDF has to be attached by hand.
 */

/** The numbers in a client's phone field (comma-separated, any format). */
export function phonesOf(field: string | null | undefined): string[] {
  return (field ?? '').split(',').map((p) => p.trim()).filter(Boolean)
}

/**
 * The number as wa.me wants it: country code and digits only. Kazakh numbers written locally
 * ("8 701 …", "701 …") get the 7 prefix. Null when it does not look like a phone number.
 */
export function waNumber(phone: string): string | null {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('8')) return `7${d.slice(1)}`
  if (d.length === 10 && d.startsWith('7')) return `7${d}`
  return d.length >= 11 && d.length <= 15 ? d : null
}

/** Without a number WhatsApp asks whom to send the text to. */
export function waLink(phone: string | null, text: string): string {
  const number = phone ? waNumber(phone) : null
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`
}

/** Long invoices are cut so the link stays within what browsers and WhatsApp accept. */
const MAX_LINES = 30

export function invoiceText(inv: Invoice, company: string, t: TFunction): string {
  const lines = inv.lines.slice(0, MAX_LINES).map((l, i) => t('whatsapp.invoiceLine', {
    n: i + 1,
    name: l.productName,
    quantity: fmt(l.quantity),
    unit: l.unitLabel ?? t('invoicePrint.pieces'),
    price: fmtMoney(l.quantity ? l.total / l.quantity : l.price),
    sum: fmtMoney(l.total),
  }))
  if (inv.lines.length > MAX_LINES) lines.push(t('whatsapp.moreLines', { count: inv.lines.length - MAX_LINES }))
  const paid = inv.legacyPaid || inv.status === 'PAID' ? t('whatsapp.paid')
    : inv.status === 'PARTIAL' ? t('whatsapp.partlyPaid', { paid: fmtMoney(inv.paid), due: fmtMoney(inv.due) })
      : t('whatsapp.toPay', { due: fmtMoney(inv.due) })
  return [
    t('whatsapp.invoiceHead', { company, number: inv.number, date: fmtDate(inv.createdAt) }),
    ...lines,
    t('whatsapp.total', { total: fmtMoney(inv.total) }),
    paid,
  ].join('\n')
}

/** A reminder of what the client owes, with the unpaid invoices (and the opening debt, if any). */
export function debtText(client: Client, unpaid: InvoiceListItem[], company: string, companyPhone: string | null,
                         t: TFunction): string {
  const items = unpaid.map((i) => t('whatsapp.debtInvoice', { number: i.number, date: fmtDate(i.createdAt), due: fmtMoney(i.due) }))
  if (client.openingDebt > 0) items.push(t('whatsapp.debtOpening', { amount: fmtMoney(client.openingDebt) }))
  return [
    t('whatsapp.debtHead', { name: client.name, company, date: fmtDate(new Date().toISOString()), debt: fmtMoney(client.debt) }),
    ...(items.length ? [t('whatsapp.debtList'), ...items] : []),
    companyPhone ? t('whatsapp.debtContact', { phone: companyPhone }) : null,
    t('whatsapp.thanks'),
  ].filter(Boolean).join('\n')
}

/** The figures of a reconciliation statement; the PDF itself is attached by hand. */
export function actText(act: Reconciliation, company: string, t: TFunction): string {
  const client = act.client.name
  const result = act.closing > 0 ? t('act.resultClientOwes', { date: fmtDate(act.to), client, company, amount: fmtMoney(act.closing) })
    : act.closing < 0 ? t('act.resultWeOwe', { date: fmtDate(act.to), client, company, amount: fmtMoney(-act.closing) })
      : t('act.resultSettled', { date: fmtDate(act.to) })
  return [
    t('whatsapp.actHead', { company, client, from: fmtDate(act.from), to: fmtDate(act.to) }),
    t('whatsapp.actOpening', { amount: fmtMoney(act.opening) }),
    t('whatsapp.actDebit', { amount: fmtMoney(act.debit) }),
    t('whatsapp.actCredit', { amount: fmtMoney(act.credit) }),
    t('whatsapp.actClosing', { amount: fmtMoney(act.closing) }),
    result,
    t('whatsapp.actAsk'),
  ].join('\n')
}
