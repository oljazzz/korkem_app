import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { ApiError } from '../api/http'
import type { Role, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { PageHeader } from '../components/Layout'
import { ConfirmModal, Modal } from '../components/Modal'
import { RowActions, rowProps } from '../components/RowActions'
import { useToast } from '../components/Toast'
import { TableState, Toolbar } from '../components/Toolbar'
import { useTranslation } from 'react-i18next'

/** User management (ADMIN only; the route and the API both enforce it). */
export function UsersPage() {
  const { user: me } = useAuth()
  const toast = useToast()
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<number | null>(null)
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)

  const load = useCallback(() => {
    api.users
      .list()
      .then((u) => {
        setUsers(u)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const remove = async () => {
    const u = deleting
    setDeleting(null)
    if (!u) return
    try {
      await api.users.remove(u.id)
      load()
      toast.show(t('users.deleted', { name: u.username }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="page">
      <PageHeader eyebrow={t('users.eyebrow')} title={t('users.title')} />
      <Toolbar onCreate={() => setEditing('new')} />
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      <div className={`table-wrap ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
        <table className="table table--cards">
          <thead>
            <tr>
              <th>{t('users.username')}</th>
              <th>{t('users.firstName')}</th>
              <th>{t('users.lastName')}</th>
              <th>{t('users.role')}</th>
              <th>Email</th>
              <th>{t('users.status')}</th>
              <th aria-label={t('users.actions')} />
            </tr>
          </thead>
          <tbody>
            <TableState loading={loading} error={null} empty={users.length === 0} colSpan={7} />
            {users.map((u) => {
              const self = u.id === me?.id
              const del = self ? undefined : () => setDeleting(u)
              return (
                <tr key={u.id} {...rowProps(() => setEditing(u), del, highlight === u.id)}>
                  <td className="strong" data-title>{u.username}{self ? t('users.you') : ''}</td>
                  <td data-label={t('users.firstName')}>{u.firstName}</td>
                  <td data-label={t('users.lastName')}>{u.lastName}</td>
                  <td data-label={t('users.role')}>{t(`role.${u.role}`)}</td>
                  <td data-label="Email">{u.email}</td>
                  <td className={u.active ? '' : 'muted-cell'} data-label={t('users.status')}>{u.active ? t('users.active') : t('users.blocked')}</td>
                  <RowActions name={u.username} onEdit={() => setEditing(u)} onDelete={del} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editing && (
        <UserForm
          user={editing === 'new' ? null : editing}
          isSelf={editing !== 'new' && editing.id === me?.id}
          onClose={() => setEditing(null)}
          onSaved={(u) => {
            setEditing(null)
            setHighlight(u.id)
            load()
            toast.show(t('users.saved'))
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title={t('users.deleteTitle')}
          text={t('users.deleteText', { name: deleting.username })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          danger
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  )
}

function UserForm({ user, isSelf, onClose, onSaved }: {
  user: User | null
  isSelf: boolean
  onClose: () => void
  onSaved: (u: User) => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    username: user?.username ?? '',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    timeZone: user?.timeZone ?? 'Asia/Almaty',
    role: (user?.role ?? 'MANAGER') as Role,
    active: user?.active ?? true,
    password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    const body = {
      ...form,
      firstName: form.firstName || null,
      lastName: form.lastName || null,
      email: form.email || null,
      timeZone: form.timeZone || null,
      password: form.password || null,
    }
    try {
      onSaved(user ? await api.users.update(user.id, body) : await api.users.create(body))
    } catch (e) {
      const err = e as ApiError
      setErrors({ ...err.fields, _: Object.keys(err.fields).length ? '' : err.message })
    }
  }

  return (
    <Modal
      title={user ? t('users.editTitle') : t('users.newTitle')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={save}>{t('common.save')}</button>
          <button className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label={t('users.username')} required error={errors.username}>
          <input className="input" autoFocus value={form.username} onChange={(e) => set('username', e.target.value)} />
        </Field>
        <Field label={user ? t('users.newPassword') : t('users.password')} required={!user} error={errors.password}>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder={user ? t('users.keepPassword') : t('users.minPassword')}
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </Field>
        <Field label={t('users.role')} required error={errors.role}>
          <select className="input" value={form.role} disabled={isSelf} onChange={(e) => set('role', e.target.value as Role)}>
            <option value="MANAGER">{t('users.managerRole', { role: t('role.MANAGER') })}</option>
            <option value="ADMIN">{t('users.adminRole', { role: t('role.ADMIN') })}</option>
          </select>
        </Field>
        <Field label={t('users.firstName')}>
          <input className="input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </Field>
        <Field label={t('users.lastName')}>
          <input className="input" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <label className="checkbox field__offset">
          <input type="checkbox" checked={form.active} disabled={isSelf} onChange={(e) => set('active', e.target.checked)} />
          {t('users.activeHint')}
        </label>
        {errors._ && <Alert>{errors._}</Alert>}
        <button hidden />
      </form>
    </Modal>
  )
}
