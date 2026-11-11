import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import { SkeletonRows } from './Skeleton'
import { useTranslation } from 'react-i18next'

interface Props {
  onCreate: () => void
  search?: string
  onSearch?: (v: string) => void
  searchPlaceholder?: string
  createLabel?: string
  children?: ReactNode
}

/**
 * List toolbar: search, filters and the create button. Row actions live on the rows themselves.
 * Sticks to the top while the list scrolls and publishes its height as --toolbar-h,
 * so table headers can stick right below it. On phones the create button becomes a floating button.
 */
export function Toolbar(p: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const update = () => root.style.setProperty('--toolbar-h', `${el.offsetHeight}px`)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--toolbar-h')
    }
  }, [])

  const createLabel = p.createLabel ?? t('common.add')
  return (
    <div className="toolbar toolbar--sticky" ref={ref}>
      {p.onSearch && (
        <label className="search toolbar__search">
          <Icon name="search" />
          <input
            type="search"
            aria-label={p.searchPlaceholder ?? t('common.search')}
            placeholder={p.searchPlaceholder ?? t('common.searchPlaceholder')}
            value={p.search}
            onChange={(e) => p.onSearch!(e.target.value)}
          />
        </label>
      )}
      {p.children}
      <span className="toolbar__sep" />
      <button className="btn btn--primary toolbar__create" onClick={p.onCreate} aria-label={createLabel}>
        <Icon name="plus" />
        <span className="btn__label">{createLabel}</span>
      </button>
    </div>
  )
}

export function TableState({ loading, error, empty, colSpan, emptyText }: {
  loading: boolean
  error: string | null
  empty: boolean
  colSpan: number
  emptyText?: string
}) {
  const { t } = useTranslation()
  if (error) return <tr><td colSpan={colSpan} className="table__msg table__msg--error">{error}</td></tr>
  if (loading && empty) return <SkeletonRows cols={colSpan} />
  if (empty) return <tr><td colSpan={colSpan} className="table__msg">{emptyText ?? t('common.noData')}</td></tr>
  return null
}
