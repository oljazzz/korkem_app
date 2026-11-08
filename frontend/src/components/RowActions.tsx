import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { Icon } from './Icon'

const INTERACTIVE = 'button, a, input, select, textarea, label'

/**
 * Props for a clickable, keyboard-reachable table row:
 * click or Enter opens it, Delete removes it (when allowed), ↑/↓ move between rows.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function rowProps(open: () => void, remove?: () => void, selected = false) {
  return {
    tabIndex: 0,
    className: `row-link ${selected ? 'is-selected' : ''}`,
    onClick: (e: MouseEvent<HTMLTableRowElement>) => {
      if ((e.target as HTMLElement).closest(INTERACTIVE)) return
      open()
    },
    onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter') {
        e.preventDefault()
        open()
      } else if (e.key === 'Delete' && remove) {
        e.preventDefault()
        remove()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        let sib = e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling
        while (sib && !(sib as HTMLElement).classList.contains('row-link')) {
          sib = e.key === 'ArrowDown' ? sib.nextElementSibling : sib.previousElementSibling
        }
        ;(sib as HTMLElement | null)?.focus()
      }
    },
  }
}

/** Trailing cell with per-row actions; `name` makes the button labels specific for screen readers. */
export function RowActions({ name, onEdit, onDelete, children }: {
  name: string
  onEdit?: () => void
  onDelete?: () => void
  children?: ReactNode
}) {
  return (
    <td className="row-actions">
      {children}
      {onEdit && (
        <button className="icon-btn" title="Өзгерту" aria-label={`${name} — өзгерту`} onClick={onEdit}>
          <Icon name="edit" />
        </button>
      )}
      {onDelete && (
        <button className="icon-btn icon-btn--danger" title="Жою" aria-label={`${name} — жою`} onClick={onDelete}>
          <Icon name="trash" />
        </button>
      )}
    </td>
  )
}
