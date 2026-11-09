import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Settings } from '../api/types'

const DEFAULTS: Settings = {
  company: { name: '', bin: '', chiefAccountant: '', releaseAllowedBy: '' },
  vatRate: 12,
}

let cache: Promise<Settings> | null = null

/** Server settings (company details, VAT rate), fetched once per session. */
export function useSettings(): Settings {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  useEffect(() => {
    if (!cache) cache = api.settings().catch(() => {
      cache = null
      return DEFAULTS
    })
    let alive = true
    cache.then((s) => alive && setSettings(s))
    return () => {
      alive = false
    }
  }, [])
  return settings
}
