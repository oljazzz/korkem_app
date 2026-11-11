import { useTranslation } from 'react-i18next'
interface Props {
  page: number
  size: number
  total: number
  onChange: (page: number) => void
}

export function Pagination({ page, size, total, onChange }: Props) {
  const last = Math.max(0, Math.ceil(total / size) - 1)
  const { t } = useTranslation()
  const from = total === 0 ? 0 : page * size + 1
  const to = Math.min(total, (page + 1) * size)
  return (
    <div className="pager">
      <button className="pager__btn" disabled={page === 0} onClick={() => onChange(0)} title={t('pager.first')}>«</button>
      <button className="pager__btn" disabled={page === 0} onClick={() => onChange(page - 1)} title={t('pager.prev')}>‹</button>
      <span className="pager__label">
        <b>{total}</b> {t('pager.range', { from, to })}
      </span>
      <button className="pager__btn" disabled={page >= last} onClick={() => onChange(page + 1)} title={t('pager.next')}>›</button>
      <button className="pager__btn" disabled={page >= last} onClick={() => onChange(last)} title={t('pager.last')}>»</button>
    </div>
  )
}
