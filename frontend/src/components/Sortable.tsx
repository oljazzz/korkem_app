import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * Drag-and-drop ordering for a list of items with a numeric {@code key}. Items are moved by their
 * grip handle: with the mouse, a finger, or the keyboard (Space, arrows, Space). {@code onMove} gets
 * the list in its new order.
 */
export function SortableList<T extends { key: number }>({ items, onMove, children }: {
  items: T[]
  onMove: (next: T[]) => void
  children: ReactNode
}) {
  const sensors = useSensors(
    // A few pixels of movement before a drag starts, so a tap on the handle stays a tap
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const place = (id: UniqueIdentifier) => items.findIndex((x) => x.key === id) + 1

  const end = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = items.findIndex((x) => x.key === active.id)
    const to = items.findIndex((x) => x.key === over.id)
    if (from >= 0 && to >= 0) onMove(arrayMove(items, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={end}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'Жолды жылжыту үшін бос орынды басыңыз, жоғары не төмен көрсеткімен жылжытып, қайта бос орынды басыңыз. Болдырмау — Escape.',
        },
        announcements: {
          onDragStart: ({ active }) => `${place(active.id)}-жол алынды`,
          onDragOver: ({ over }) => (over ? `${place(over.id)}-орын` : 'Тізімнен тыс'),
          onDragEnd: ({ over }) => (over ? `Жол ${place(over.id)}-орынға қойылды` : 'Жол орнында қалды'),
          onDragCancel: () => 'Жылжыту тоқтатылды, жол орнында қалды',
        },
      }}
    >
      <SortableContext items={items.map((x) => x.key)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

function useSortableItem(id: number) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    attributes: { roleDescription: 'жылжытылатын жол' },
  })
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 2 : undefined,
  }
  const handle = (
    <button type="button" ref={setActivatorNodeRef} className="drag-handle" title="Сүйреп орнын ауыстыру"
      aria-label="Жылжыту" {...attributes} {...listeners}>
      <Icon name="grip" />
    </button>
  )
  return { setNode: setNodeRef, style, dragging: isDragging, handle }
}

/** Table row that can be dragged; {@code children} receives the grip handle to place in a cell. */
export function SortableRow({ id, className, onDoubleClick, children }: {
  id: number
  className?: string
  onDoubleClick?: () => void
  children: (handle: ReactNode) => ReactNode
}) {
  const { setNode, style, dragging, handle } = useSortableItem(id)
  return (
    <tr ref={setNode} style={style} className={`${className ?? ''} ${dragging ? 'is-dragging' : ''}`} onDoubleClick={onDoubleClick}>
      {children(handle)}
    </tr>
  )
}

/** List item (a card on phones) that can be dragged by its handle. */
export function SortableCard({ id, className, children }: {
  id: number
  className?: string
  children: (handle: ReactNode) => ReactNode
}) {
  const { setNode, style, dragging, handle } = useSortableItem(id)
  return (
    <li ref={setNode} style={style} className={`${className ?? ''} ${dragging ? 'is-dragging' : ''}`}>
      {children(handle)}
    </li>
  )
}
