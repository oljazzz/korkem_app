import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { GroupSuggestion } from '../api/types'
import { Alert } from '../components/Alert'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { SkeletonList } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { fmt, fmtPack } from '../lib/format'

/**
 * Turns colour families (same price, category and pack; names differing by colour) into one product
 * with colours. The server suggests the groups; a person checks and confirms each one.
 */
export function ProductGroupingPage() {
  const toast = useToast()
  const [groups, setGroups] = useState<GroupSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(0)

  useEffect(() => {
    api.products.grouping().then(setGroups).catch((e: Error) => setError(e.message))
  }, [])

  const removeGroup = (g: GroupSuggestion) => setGroups((gs) => (gs ?? []).filter((x) => x !== g))
  const total = groups?.reduce((s, g) => s + g.members.length, 0) ?? 0

  return (
    <section className="page">
      <div className="breadcrumbs">
        <Link to="/products">Баға тізімі</Link> › Түстерге топтастыру
      </div>
      <PageHeader title="Түстерге топтастыру" />
      <p className="muted grouping-intro">
        Бағасы, санаты мен қаптамасы бірдей, атаулары тек түсімен ерекшеленетін тауарлар бір тауарға біріктіріледі,
        ал әрқайсысы оның түсі болады. Әр топты тексеріңіз: керек емес тауардың белгісін алып тастаңыз,
        атаулар мен түстерді түзетіңіз. Ескі жүкқұжаттар өзгермейді.
      </p>
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {groups && groups.length > 0 && (
        <div className="list-summary">
          <span><b>{groups.length}</b> ұсыныс</span>
          <span><b>{fmt(total)}</b> тауар</span>
          {done > 0 && <span>біріктірілді: <b>{done}</b></span>}
        </div>
      )}
      {!groups ? <SkeletonList rows={6} /> : groups.length === 0 ? (
        <div className="card"><p className="muted">Топтастыруға ұсыныс жоқ{done > 0 ? ' — бәрі дайын' : ''}.</p></div>
      ) : (
        <div className="grouping-list">
          {groups.map((g) => (
            <GroupCard
              key={g.members.map((m) => m.productId).join('-')}
              group={g}
              onSkip={() => removeGroup(g)}
              onDone={(text) => {
                removeGroup(g)
                setDone((d) => d + 1)
                toast.show(text)
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function GroupCard({ group, onSkip, onDone }: {
  group: GroupSuggestion
  onSkip: () => void
  onDone: (message: string) => void
}) {
  const [name, setName] = useState(group.name)
  const [rows, setRows] = useState(() => group.members.map((m) => ({ ...m, include: true })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const included = rows.filter((r) => r.include)

  // Colours written the same way become one colour; worth pointing out before merging
  const repeated = useMemo(() => {
    const seen = new Map<string, number>()
    included.forEach((r) => seen.set(r.variantName.trim().toLowerCase(), (seen.get(r.variantName.trim().toLowerCase()) ?? 0) + 1))
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k))
  }, [included])

  const merge = async () => {
    if (included.length < 2) return
    setBusy(true)
    setError(null)
    try {
      const r = await api.products.group(
        name,
        included.map((m) => ({ productId: m.productId, variantName: group.duplicates ? '' : m.variantName })),
      )
      onDone(
        r.variants > 0
          ? `«${r.product.name}»: ${r.variants} түс, ${r.removedProducts} тауар біріктірілді`
          : `«${r.product.name}»: ${r.removedProducts + 1} бірдей тауар біреуге біріктірілді`,
      )
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="grouping card">
      <div className="grouping__head">
        <input className="input grouping__name" value={name} aria-label="Тауардың атауы" onChange={(e) => setName(e.target.value)} />
        <div className="grouping__meta">
          {group.duplicates && <span className="status status--partial">Бірдей тауарлар</span>}
          {group.categoryName && <span>{group.categoryName}</span>}
          <span>{fmt(group.price)} ₸</span>
          {group.packAmount && <span>{fmtPack(group.packAmount, group.packUnit)}</span>}
        </div>
      </div>
      <ul className="grouping__members">
        {rows.map((m, i) => (
          <li key={m.productId} className={m.include ? '' : 'is-off'}>
            <label className="check__hit" title={m.include ? 'Топтан алып тастау' : 'Топқа қосу'}>
              <input type="checkbox" checked={m.include} aria-label={`«${m.name}» топқа қосу`}
                onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, include: e.target.checked } : r)))} />
            </label>
            {!group.duplicates && (
              <input className={`input grouping__variant ${repeated.has(m.variantName.trim().toLowerCase()) && m.include ? 'is-repeated' : ''}`}
                value={m.variantName} disabled={!m.include} aria-label="Түсі"
                onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, variantName: e.target.value } : r)))} />
            )}
            <span className="grouping__orig">
              {m.name}
              {m.price !== group.price && <b> · {fmt(m.price)} ₸</b>}
            </span>
            <span className="grouping__lines">{m.invoiceLines > 0 ? `${fmt(m.invoiceLines)} жол` : 'сатылмаған'}</span>
          </li>
        ))}
      </ul>
      {repeated.size > 0 && (
        <p className="grouping__note">
          <Icon name="warning" size={14} /> Сары түспен белгіленген түстер бірдей жазылған — олар бір түске біріктіріледі.
        </p>
      )}
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      <div className="grouping__actions">
        <button className="btn btn--primary" onClick={merge} disabled={busy || included.length < 2 || !name.trim()}>
          <Icon name="merge" />
          {group.duplicates ? 'Біреуге біріктіру' : `Біріктіру · ${included.length} түс`}
        </button>
        <button className="btn btn--ghost" onClick={onSkip}>Өткізіп жіберу</button>
      </div>
    </div>
  )
}
