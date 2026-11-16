import { useEffect, useState } from 'react'

/** A4 portrait at 96 dpi. */
export const SHEET_WIDTH = 794

/**
 * Zoom factor that fits a sheet of the given width into its container (never enlarges).
 * Returns [zoom, attach]: pass `attach` as the container's ref callback (it may mount after loading).
 */
export function useFitScale(width: number): [number, (el: HTMLDivElement | null) => void] {
  const [el, attach] = useState<HTMLDivElement | null>(null)
  const [value, setValue] = useState(1)
  useEffect(() => {
    if (!el) return
    const update = () => setValue(Math.min(1, el.clientWidth / width))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el, width])
  return [value, attach]
}
