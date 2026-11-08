import type { ReactNode } from 'react'
import { Icon } from './Icon'

interface Props {
  onCreate: () => void
  onEdit: () => void
  onDelete: () => void
  hasSelection: boolean
  search?: string
  onSearch?: (v: string) => void
  searchPlaceholder?: string
  right?: ReactNode
  children?: ReactNode
}

export function Toolbar(p: Props) {
  return (
    <div className="toolbar">
      {p.onSearch && (
        <label className="search toolbar__search">
          <Icon name="search" />
          <input
            type="search"
            placeholder={p.searchPlaceholder ?? 'Поиск…'}
            value={p.search}
            onChange={(e) => p.onSearch!(e.target.value)}
          />
        </label>
      )}
      {p.children}
      <span className="toolbar__sep" />
      <button className="btn btn--ghost" disabled={!p.hasSelection} onClick={p.onEdit}><Icon name="edit" />Изменить</button>
      <button className="btn btn--ghost btn--danger" disabled={!p.hasSelection} onClick={p.onDelete}><Icon name="trash" />Удалить</button>
      <button className="btn btn--primary" onClick={p.onCreate}><Icon name="plus" />Создать</button>
      <div className="toolbar__right">{p.right}</div>
    </div>
  )
}

export function TableState({ loading, error, empty, colSpan }: {
  loading: boolean
  error: string | null
  empty: boolean
  colSpan: number
}) {
  if (error) return <tr><td colSpan={colSpan} className="table__msg table__msg--error">{error}</td></tr>
  if (loading && empty) return <tr><td colSpan={colSpan} className="table__msg">Загрузка…</td></tr>
  if (empty) return <tr><td colSpan={colSpan} className="table__msg">Нет данных</td></tr>
  return null
}
