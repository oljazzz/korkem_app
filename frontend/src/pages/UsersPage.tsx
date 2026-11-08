import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { PageHeader } from '../components/Layout'
import { ApiError } from '../api/http'
import type { User } from '../api/types'
import { Field } from '../components/Field'
import { ConfirmModal, Modal } from '../components/Modal'
import { TableState, Toolbar } from '../components/Toolbar'

export function UsersPage() {
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
      <PageHeader eyebrow="Настройки" title="Пользователи" />
      <Toolbar
        onCreate={() => setEditing('new')}
        onEdit={() => selected && setEditing(selected)}
        onDelete={() => setConfirm(true)}
        hasSelection={!!selected}
      />
      {error && <div className="alert" onClick={() => setError(null)}>{error}</div>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Имя пользователя</th>
              <th>Имя</th>
              <th>Фамилия</th>
              <th>Email</th>
              <th>Часовой пояс</th>
              <th>Активный</th>
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
                <td>{u.username}</td>
                <td>{u.firstName}</td>
                <td>{u.lastName}</td>
                <td>{u.email}</td>
                <td>{u.timeZone}</td>
                <td>{u.active ? '☑' : '☐'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <UserForm
          user={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(u) => {
            setEditing(null)
            setSelectedId(u.id)
            load()
          }}
        />
      )}
      {confirm && selected && (
        <ConfirmModal text={`Удалить пользователя «${selected.username}»?`} onConfirm={remove} onClose={() => setConfirm(false)} />
      )}
    </section>
  )
}

function UserForm({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: (u: User) => void }) {
  const [form, setForm] = useState({
    username: user?.username ?? '',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    timeZone: user?.timeZone ?? 'Asia/Almaty',
    active: user?.active ?? true,
    password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

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
      title={user ? 'Пользователь' : 'Новый пользователь'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={save}>Сохранить</button>
          <button className="btn btn--ghost" onClick={onClose}>Отмена</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Логин" required error={errors.username}>
          <input className="input" autoFocus value={form.username} onChange={(e) => set('username', e.target.value)} />
        </Field>
        <Field label={user ? 'Новый пароль' : 'Пароль'} required={!user} error={errors.password}>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder={user ? 'оставьте пустым, чтобы не менять' : ''}
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </Field>
        <Field label="Имя">
          <input className="input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </Field>
        <Field label="Фамилия">
          <input className="input" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Часовой пояс">
          <input className="input" value={form.timeZone} onChange={(e) => set('timeZone', e.target.value)} />
        </Field>
        <label className="checkbox field__offset">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          Активный
        </label>
        {errors._ && <div className="alert">{errors._}</div>}
        <button hidden />
      </form>
    </Modal>
  )
}
