import { useCallback, useEffect, useState } from 'react'
import type { Page } from '../api/types'

/** Беттелген тізімді жүктеу, іздеу және таңдалған жолды басқару. */
export function useList<T extends { id: number }>(
  fetcher: (params: { q: string; page: number; size: number }) => Promise<Page<T>>,
  size = 50,
) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Page<T>>({ items: [], total: 0, page: 0, size })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      fetcher({ q, page, size })
        .then((d) => {
          if (cancelled) return
          setData(d)
          setError(null)
        })
        .catch((e: Error) => !cancelled && setError(e.message))
        .finally(() => !cancelled && setLoading(false))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // fetcher әр рендерде жаңа болуы мүмкін — тек параметрлер өзгергенде жүктейміз
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page, size, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const search = useCallback((value: string) => {
    setQ(value)
    setPage(0)
  }, [])

  const selected = data.items.find((i) => i.id === selectedId) ?? null
  return { q, search, page, setPage, data, loading, error, selected, setSelectedId, reload }
}
