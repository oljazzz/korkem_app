import { useState } from 'react'
import { api } from '../api'
import type { ApiError } from '../api/http'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { PageHeader } from '../components/Layout'
import { useToast } from '../components/Toast'
import { setCompany, useSettings } from '../lib/settings'
import { useTranslation } from 'react-i18next'

/** Company details printed on documents (invoice, price list). Admins only. */
export function SettingsPage() {
  const { company } = useSettings()
  const toast = useToast()
  const { t } = useTranslation()
  // null until the user edits: the form shows the loaded settings
  const [draft, setDraft] = useState<typeof company | null>(null)
  const form = draft ?? company
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setDraft({ ...form, [key]: e.target.value })

  const save = async () => {
    setBusy(true)
    setErrors({})
    try {
      const saved = await api.updateCompany({
        name: form.name,
        bin: form.bin?.replace(/\s/g, '') || null,
        address: form.address || null,
        phone: form.phone || null,
        chiefAccountant: form.chiefAccountant || null,
        releaseAllowedBy: form.releaseAllowedBy || null,
      })
      await setCompany(saved)
      setDraft(null)
      toast.show(t('settings.saved'))
    } catch (e) {
      const err = e as ApiError
      setErrors({ ...err.fields, _: Object.keys(err.fields ?? {}).length ? '' : err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page">
      <PageHeader eyebrow={t('settings.eyebrow')} title={t('settings.title')} />
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save() }}>
        <p className="muted form-grid__intro">{t('settings.intro')}</p>
        <Field label={t('common.name')} required error={errors.name}>
          <input className="input" value={form.name} onChange={set('name')} />
        </Field>
        <Field label={t('settings.bin')} error={errors.bin}>
          <input className="input" inputMode="numeric" maxLength={14} value={form.bin ?? ''} onChange={set('bin')} placeholder={t('settings.binPlaceholder')} />
        </Field>
        <Field label={t('settings.address')} error={errors.address}>
          <input className="input" value={form.address ?? ''} onChange={set('address')} />
        </Field>
        <Field label={t('settings.phone')} error={errors.phone}>
          <input className="input" type="tel" value={form.phone ?? ''} onChange={set('phone')} />
        </Field>
        <Field label={t('settings.releasedBy')} error={errors.releaseAllowedBy}>
          <input className="input" value={form.releaseAllowedBy ?? ''} onChange={set('releaseAllowedBy')} placeholder={t('settings.releasedByPlaceholder')} />
          <span className="field__hint">{t('settings.releasedByHint')}</span>
        </Field>
        {errors._ && <Alert>{errors._}</Alert>}
        <div className="field__offset">
          <button className="btn btn--primary" disabled={busy}>{t('common.save')}</button>
        </div>
      </form>
    </section>
  )
}
