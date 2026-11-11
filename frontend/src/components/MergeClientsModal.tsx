import { useEffect, useState } from 'react'
import { api } from '../api'
import type { MergePlan, MergeResult, MergeSide } from '../api/types'
import { fmt, fmtDate, fmtMoney } from '../lib/format'
import { Alert } from './Alert'
import { AsyncSelect, type Option } from './AsyncSelect'
import { Field } from './Field'
import { Modal } from './Modal'
import { useTranslation } from 'react-i18next'

/**
 * Merges two client records. The server decides which one stays: the client whose latest invoice
 * is newer. The dialog shows that plan before anything changes.
 */
export function MergeClientsModal({ clientId, otherId, onClose, onMerged }: {
  clientId: number
  /** Known duplicate; without it the user picks the other client first. */
  otherId?: number
  onClose: () => void
  onMerged: (result: MergeResult) => void
}) {
  const [other, setOther] = useState<Option | null>(null)
  const { t } = useTranslation()
  const [plan, setPlan] = useState<MergePlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const otherClientId = otherId ?? other?.id ?? null

  useEffect(() => {
    if (!otherClientId) return
    let alive = true
    api.clients.mergePlan(clientId, otherClientId)
      .then((p) => {
        if (!alive) return
        setPlan(p)
        setError(null)
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [clientId, otherClientId])

  const current = plan && otherClientId && (plan.primary.client.id === otherClientId || plan.secondary.client.id === otherClientId) ? plan : null

  const merge = async () => {
    if (!current) return
    setBusy(true)
    try {
      onMerged(await api.clients.merge(current.primary.client.id, current.secondary.client.id))
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('merge.title')}
      width={640}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--danger-solid" onClick={merge} disabled={!current || busy}>{t('merge.action')}</button>
          <button className="btn btn--ghost" onClick={onClose} autoFocus={!!otherId}>{t('common.cancel')}</button>
        </>
      }
    >
      {!otherId && (
        <Field label={t('merge.with')}>
          <AsyncSelect
            value={other}
            autoFocus
            placeholder={t('merge.searchPlaceholder')}
            ariaLabel={t('merge.searchLabel')}
            onChange={(o) => setOther(o)}
            load={(q) =>
              api.clients.list({ q, size: 30 }).then((p) =>
                p.items.filter((c) => c.id !== clientId).map((c) => ({
                  id: c.id,
                  label: c.name,
                  hint: [c.phone, c.city].filter(Boolean).join(' · ') || undefined,
                })),
              )
            }
          />
        </Field>
      )}
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {current && (
        <>
          <div className="merge">
            <MergeCard side={current.primary} kind="primary" />
            <span className="merge__arrow" aria-hidden="true">←</span>
            <MergeCard side={current.secondary} kind="secondary" />
          </div>
          <ul className="merge__rules">
            <li>{t('merge.ruleNewest')}</li>
            <li>
              {t('merge.ruleMove', { from: current.secondary.client.name, count: fmt(current.secondary.invoiceCount), to: current.primary.client.name })}
            </li>
            <li>{t('merge.ruleFields')}</li>
            <li><b>{t('merge.ruleDelete', { name: current.secondary.client.name })}</b></li>
          </ul>
        </>
      )}
    </Modal>
  )
}

function MergeCard({ side, kind }: { side: MergeSide; kind: 'primary' | 'secondary' }) {
  const c = side.client
  const { t } = useTranslation()
  return (
    <div className={`merge__card merge__card--${kind}`}>
      <span className="merge__tag">{kind === 'primary' ? t('merge.primary') : t('merge.secondary')}</span>
      <div className="merge__name">{c.name}</div>
      {c.phone && <div className="merge__line">{c.phone}</div>}
      {(c.city || c.address) && <div className="merge__line muted">{[c.city, c.address].filter(Boolean).join(' · ')}</div>}
      <dl className="merge__stats">
        <div><dt>{t('merge.invoices')}</dt><dd>{fmt(side.invoiceCount)}</dd></div>
        <div><dt>{t('merge.last')}</dt><dd>{side.lastInvoiceAt ? fmtDate(side.lastInvoiceAt) : '—'}</dd></div>
        <div><dt>{t('merge.debt')}</dt><dd>{fmtMoney(c.debt)} ₸</dd></div>
      </dl>
    </div>
  )
}
