import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Company, Settings } from '../api/types'

const DEFAULTS: Settings = {
  company: { name: '', bin: null, address: null, phone: null, chiefAccountant: null, releaseAllowedBy: null },
}

let cache: Promise<Settings> | null = null
const listeners = new Set<(s: Settings) => void>()

function load() {
  if (!cache) cache = api.settings().catch(() => {
    cache = null
    return DEFAULTS
  })
  return cache
}

/** Server settings (company details), fetched once per session and shared by all pages. */
export function useSettings(): Settings {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  useEffect(() => {
    let alive = true
    load().then((s) => alive && setSettings(s))
    listeners.add(setSettings)
    return () => {
      alive = false
      listeners.delete(setSettings)
    }
  }, [])
  return settings
}

/** Publishes saved company details to every page that shows them. */
export async function setCompany(company: Company) {
  const next = { ...(await load()), company }
  cache = Promise.resolve(next)
  listeners.forEach((l) => l(next))
}
