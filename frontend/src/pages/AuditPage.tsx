import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { AuditAction, AuditChange, AuditEntityType, AuditEntry, User } from '../api/types'
import { DateInput } from '../components/DateInput'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { Pagination } from '../components/Pagination'
import { TableState, Toolbar } from '../components/Toolbar'
import { fmtDate, fmtMoney } from '../lib/format'
import { useList } from '../lib/useList'
import { useTranslation } from 'react-i18next'

const ACTIONS: AuditAction[] = ['CREATE', 'UPDATE', 'DELETE', 'MERGE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT_ALL']
/** Shown in full; for the rest (a created or deleted record's whole state) the fields fold away. */
const INLINE: AuditAction[] = ['UPDATE', 'MERGE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT_ALL']
const TYPES: AuditEntityType[] = ['INVOICE', 'PAYMENT', 'CLIENT', 'PRODUCT', 'CATEGORY', 'USER', 'SETTINGS']
/** Fields holding money; shown with thousands separators. */
const MONEY = new Set(['total', 'amount', 'price', 'openingDebt'])
const DAY = /^\d{4}-\d{2}-\d{2}$/

const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' })

/** Where a record can be opened, if it still has a page of its own. */
function objectLink(e: AuditEntry): string | null {
  if (e.action === 'DELETE' || e.entityId === null) return null
  if (e.entityType === 'INVOICE') return `/invoices/${e.entityId}`
  if (e.entityType === 'CLIENT') return `/clients/${e.entityId}`
  return null
}

/** The admin's audit log: who created, changed or deleted what. Read-only. */
export function AuditPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  // Opened for one record (?type=INVOICE&id=5): its history only
  const objectType = (searchParams.get('type') as AuditEntityType | null) ?? null
  const objectId = Number(searchParams.get('id')) || null
  const [entityType, setEntityType] = useState<AuditEntityType | ''>(objectType ?? '')
  const [action, setAction] = useState<AuditAction | ''>('')
  const [username, setUsername] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [users, setUsers] = useState<User[]>([])

  const list = useList<AuditEntry>((p) =>
    api.audit.list({
      page: p.page,
      size: p.size,
      entityType: entityType || null,
      entityId: objectId,
      action: action || null,
      username: username || null,
      from: from || null,
      to: to || null,
    }),
  )

  useEffect(() => {
    api.users.list().then(setUsers).catch(() => setUsers([]))
  }, [])

  const refilter = <V,>(set: (v: V) => void) => (v: V) => {
    set(v)
    list.setPage(0)
    list.reload()
  }
  const clearObject = () => {
    setSearchParams({})
    list.setPage(0)
    list.reload()
  }

  return (
    <section className="page">
      <PageHeader eyebrow={t('audit.eyebrow')} title={t('audit.title')} />
      <p className="page-intro">{t('audit.intro')}</p>

      <Toolbar>
        <select className="input toolbar__select" aria-label={t('audit.colObject')} value={entityType}
          onChange={(e) => refilter(setEntityType)(e.target.value as AuditEntityType | '')}>
          <option value="">{t('audit.allTypes')}</option>
          {TYPES.map((x) => <option key={x} value={x}>{t(`audit.entity.${x}`)}</option>)}
        </select>
        <select className="input toolbar__select" aria-label={t('audit.colAction')} value={action}
          onChange={(e) => refilter(setAction)(e.target.value as AuditAction | '')}>
          <option value="">{t('audit.allActions')}</option>
          {ACTIONS.map((x) => <option key={x} value={x}>{t(`audit.action.${x}`)}</option>)}
        </select>
        <select className="input toolbar__select" aria-label={t('audit.colUser')} value={username}
          onChange={(e) => refilter(setUsername)(e.target.value)}>
          <option value="">{t('audit.allUsers')}</option>
          {users.map((u) => <option key={u.id} value={u.username}>{u.username}</option>)}
        </select>
        <div className="daterange" role="group" aria-label={t('period.group')}>
          <DateInput value={from} max={to || undefined} ariaLabel={t('period.from')} onChange={refilter(setFrom)} />
          <span aria-hidden="true">—</span>
          <DateInput value={to} min={from || undefined} ariaLabel={t('period.to')} onChange={refilter(setTo)} />
        </div>
      </Toolbar>

      {objectId && (
        <div className="filter-chip-row">
          <span className="filter-chip">
            {t('audit.objectFilter')} <b>{objectType ? t(`audit.entity.${objectType}`) : ''} #{objectId}</b>
            <button className="icon-btn" aria-label={t('audit.clearObject')} onClick={clearObject}><Icon name="close" size={16} /></button>
          </span>
        </div>
      )}

      <div className={`table-wrap ${list.loading ? 'is-loading' : ''}`} aria-busy={list.loading}>
        <table className="table table--cards audit-table">
          <thead>
            <tr>
              <th style={{ width: 150 }}>{t('audit.colTime')}</th>
              <th style={{ width: 130 }}>{t('audit.colUser')}</th>
              <th style={{ width: 150 }}>{t('audit.colAction')}</th>
              <th style={{ width: 220 }}>{t('audit.colObject')}</th>
              <th>{t('audit.colChanges')}</th>
            </tr>
          </thead>
          <tbody>
            <TableState loading={list.loading} error={list.error} empty={list.data.items.length === 0} colSpan={5}
              emptyText={t('audit.emptyList')} />
            {list.data.items.map((e) => {
              const link = objectLink(e)
              const label = e.entityLabel ?? (e.entityId === null ? '' : `#${e.entityId}`)
              return (
                <tr key={e.id}>
                  <td className="muted-cell" data-label={t('audit.colTime')} title={e.traceId ? t('audit.requestId', { id: e.traceId }) : undefined}>
                    {fmtDate(e.at)} <span className="mono">{time.format(new Date(e.at))}</span>
                  </td>
                  <td data-label={t('audit.colUser')}>
                    <span className="strong">{e.username ?? (e.action === 'LOGIN_FAILED' ? t('audit.unknownUser') : t('audit.system'))}</span>
                    {e.ip && <span className="cell-sub mono">{e.ip}</span>}
                  </td>
                  <td data-label={t('audit.colAction')}>
                    <span className={`status status--audit-${e.action.toLowerCase()}`}>{t(`audit.action.${e.action}`)}</span>
                  </td>
                  <td data-title>
                    <span className="cell-sub">{t(`audit.entity.${e.entityType}`)}</span>
                    {link ? <Link className="strong" to={link}>{label}</Link> : <span className="strong">{label}</span>}
                  </td>
                  <td data-label={t('audit.colChanges')}>
                    <Changes entry={e} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <Pagination page={list.page} size={list.data.size} total={list.data.total} onChange={list.setPage} />
      </div>
    </section>
  )
}

/**
 * The changed fields. Updates show "old → new" (lists show what was added and removed); a created
 * or deleted record's full state is folded away under the field count.
 */
function Changes({ entry }: { entry: AuditEntry }) {
  const { t } = useTranslation()
  const fields = Object.entries(entry.changes)
  if (fields.length === 0) return null
  const rows = (
    <ul className="audit-changes">
      {fields.map(([field, change]) => (
        <li key={field}>
          <span className="audit-changes__field">{t(`audit.field.${field}`, { defaultValue: field })}:</span>{' '}
          <ChangeValue field={field} change={change} />
        </li>
      ))}
    </ul>
  )
  if (INLINE.includes(entry.action)) return rows
  return (
    <details className="audit-details">
      <summary>{t('audit.fields', { count: fields.length })}</summary>
      {rows}
    </details>
  )
}

function ChangeValue({ field, change }: { field: string; change: AuditChange }) {
  const { t } = useTranslation()
  const show = (v: unknown): string => {
    if (v === undefined || v === null) return t('audit.empty')
    if (field === 'password') return t('audit.passwordChanged')
    if (typeof v === 'boolean') return v ? t('common.yes') : t('common.no')
    if (field === 'role' && typeof v === 'string') return t(`role.${v}`, { defaultValue: v })
    if (field === 'reason' && typeof v === 'string') return t(`audit.reason.${v}`, { defaultValue: v })
    if (typeof v === 'number' && MONEY.has(field)) return `${fmtMoney(v)} ₸`
    if (typeof v === 'string' && DAY.test(v)) return fmtDate(v)
    return String(v)
  }

  if (field === 'password') return <span>{t('audit.passwordChanged')}</span>

  const oldList = Array.isArray(change.old) ? (change.old as unknown[]).map(String) : null
  const newList = Array.isArray(change.new) ? (change.new as unknown[]).map(String) : null
  if (oldList || newList) {
    const before = oldList ?? []
    const after = newList ?? []
    const removed = before.filter((x) => !after.includes(x))
    const added = after.filter((x) => !before.includes(x))
    return (
      <ul className="audit-list">
        {removed.map((x, i) => <li key={`-${i}`} className="audit-list__removed">− {x}</li>)}
        {added.map((x, i) => <li key={`+${i}`} className="audit-list__added">+ {x}</li>)}
      </ul>
    )
  }

  const hasOld = 'old' in change
  const hasNew = 'new' in change
  if (hasOld && hasNew) {
    return (
      <span>
        <s className="audit-old">{show(change.old)}</s> → <b>{show(change.new)}</b>
      </span>
    )
  }
  return hasNew ? <b>{show(change.new)}</b> : <span className="audit-old">{show(change.old)}</span>
}
