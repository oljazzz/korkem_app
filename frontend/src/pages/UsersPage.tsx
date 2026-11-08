import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { ApiError } from '../api/http'
import type { Role, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Field } from '../components/Field'
import { PageHeader, ROLE_LABEL } from '../components/Layout'
import { ConfirmModal, Modal } from '../components/Modal'
import { TableState, Toolbar } from '../components/Toolbar'

/** User management (ADMIN only; the route and the API both enforce it). */
export function UsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [confirm, setConfirm] = useState(false)

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

  const selected = users.find((u) => u.id === selectedId) ?? null

  const remove = async () => {
    setConfirm(false)
    if (!selected) return
    try {
      await api.users.remove(selected.id)
      setSelectedId(null)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="page">
      <PageHeader eyebrow="Баптаулар" title="Пайдаланушылар" />
      <Toolbar
        onCreate={() => setEditing('new')}
        onEdit={() => selected && setEditing(selected)}
        onDelete={() => setConfirm(true)}
        hasSelection={!!selected && selected.id !== me?.id}
      />
      {error && <div className="alert" onClick={() => setError(null)}>{error}</div>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Логин</th>
              <th>Аты</th>
              <th>Тегі</th>
              <th>Рөлі</th>
              <th>Email</th>
              <th>Күйі</th>
            </tr>
          </thead>
          <tbody>
            <TableState loading={loading} error={null} empty={users.length === 0} colSpan={6} />
            {users.map((u) => (
              <tr
                key={u.id}
                className={selectedId === u.id ? 'is-selected' : ''}
                onClick={() => setSelectedId(u.id)}
                onDoubleClick={() => setEditing(u)}
              >
                <td className="strong">{u.username}{u.id === me?.id ? ' (сіз)' : ''}</td>
                <td>{u.firstName}</td>
                <td>{u.lastName}</td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td>{u.email}</td>
                <td className={u.active ? '' : 'muted-cell'}>{u.active ? 'Белсенді' : 'Бұғатталған'}</td>
              </tr>
            ))}
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
            setSelectedId(u.id)
            load()
          }}
        />
      )}
      {confirm && selected && (
        <ConfirmModal
          text={`«${selected.username}» пайдаланушысын жою керек пе?`}
          onConfirm={remove}
          onClose={() => setConfirm(false)}
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
      title={user ? 'Пайдаланушы' : 'Жаңа пайдаланушы'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={save}>Сақтау</button>
          <button className="btn btn--ghost" onClick={onClose}>Болдырмау</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Логин" required error={errors.username}>
          <input className="input" autoFocus value={form.username} onChange={(e) => set('username', e.target.value)} />
        </Field>
        <Field label={user ? 'Жаңа құпиясөз' : 'Құпиясөз'} required={!user} error={errors.password}>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder={user ? 'өзгертпеу үшін бос қалдырыңыз' : 'кемінде 8 таңба'}
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </Field>
        <Field label="Рөлі" required error={errors.role}>
          <select className="input" value={form.role} disabled={isSelf} onChange={(e) => set('role', e.target.value as Role)}>
            <option value="MANAGER">{ROLE_LABEL.MANAGER} — жүкқұжаттар, баға тізімі, есептер</option>
            <option value="ADMIN">{ROLE_LABEL.ADMIN} — бәрі, пайдаланушыларды басқару және жою</option>
          </select>
        </Field>
        <Field label="Аты">
          <input className="input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </Field>
        <Field label="Тегі">
          <input className="input" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <label className="checkbox field__offset">
          <input type="checkbox" checked={form.active} disabled={isSelf} onChange={(e) => set('active', e.target.checked)} />
          Белсенді (бұғатталған пайдаланушы бірден жүйеден шығарылады)
        </label>
        {errors._ && <div className="alert">{errors._}</div>}
        <button hidden />
      </form>
    </Modal>
  )
}
