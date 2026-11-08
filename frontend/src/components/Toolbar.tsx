import type { ReactNode } from 'react'
import { Icon } from './Icon'

interface Props {
  onCreate: () => void
  onEdit: () => void
  /** Omit to hide the delete button (e.g. for the MANAGER role). */
  onDelete?: () => void
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
            placeholder={p.searchPlaceholder ?? 'Іздеу…'}
            value={p.search}
            onChange={(e) => p.onSearch!(e.target.value)}
          />
        </label>
      )}
      {p.children}
      <span className="toolbar__sep" />
      <button className="btn btn--ghost" disabled={!p.hasSelection} onClick={p.onEdit}><Icon name="edit" />Өзгерту</button>
      {p.onDelete && (
        <button className="btn btn--ghost btn--danger" disabled={!p.hasSelection} onClick={p.onDelete}><Icon name="trash" />Жою</button>
      )}
      <button className="btn btn--primary" onClick={p.onCreate}><Icon name="plus" />Қосу</button>
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
  if (loading && empty) return <tr><td colSpan={colSpan} className="table__msg">Жүктелуде…</td></tr>
  if (empty) return <tr><td colSpan={colSpan} className="table__msg">Деректер жоқ</td></tr>
  return null
}
