import { useState } from 'react'
import { api } from '../api'
import type { ApiError } from '../api/http'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { PageHeader } from '../components/Layout'
import { useToast } from '../components/Toast'
import { setCompany, useSettings } from '../lib/settings'

/** Company details printed on documents (invoice, price list). Admins only. */
export function SettingsPage() {
  const { company } = useSettings()
  const toast = useToast()
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
      toast.show('Баптаулар сақталды')
    } catch (e) {
      const err = e as ApiError
      setErrors({ ...err.fields, _: Object.keys(err.fields ?? {}).length ? '' : err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page">
      <PageHeader eyebrow="Баптаулар" title="Ұйым деректері" />
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save() }}>
        <p className="muted form-grid__intro">Бұл деректер жүкқұжатта және баға тізімінде басылады.</p>
        <Field label="Атауы" required error={errors.name}>
          <input className="input" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="БСН / ЖСН" error={errors.bin}>
          <input className="input" inputMode="numeric" maxLength={14} value={form.bin ?? ''} onChange={set('bin')} placeholder="12 цифр" />
        </Field>
        <Field label="Мекенжайы" error={errors.address}>
          <input className="input" value={form.address ?? ''} onChange={set('address')} />
        </Field>
        <Field label="Телефон" error={errors.phone}>
          <input className="input" type="tel" value={form.phone ?? ''} onChange={set('phone')} />
        </Field>
        <Field label="Берген" error={errors.releaseAllowedBy}>
          <input className="input" value={form.releaseAllowedBy ?? ''} onChange={set('releaseAllowedBy')} placeholder="Тегі, аты-жөні" />
          <span className="field__hint">Жүкқұжаттың «Берген» жолына басылады.</span>
        </Field>
        {errors._ && <Alert>{errors._}</Alert>}
        <div className="field__offset">
          <button className="btn btn--primary" disabled={busy}>Сақтау</button>
        </div>
      </form>
    </section>
  )
}
