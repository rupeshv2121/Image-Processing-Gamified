import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, run } from '../api'
import { ChangePasswordModal } from './Account'
import Icon from './Icon'
import { Modal, Note } from './ui'

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'

function AccountBadge({ a }) {
  if (!a) return <span className="faint small">—</span>
  if (a.locked) return <span className="badge badge-locked">locked (wrong passwords)</span>
  if (!a.hasPassword) return <span className="badge badge-warn">no password yet</span>
  if (a.mustChange) return <span className="badge badge-navy">temporary password</span>
  return <span className="badge">active</span>
}

// Teacher: add, rename, delete students and reset their passwords
// (stored by the backend in data/imagelab.db)
export function StudentsModal({ onClose }) {
  const { profiles, editProfiles, refreshProfiles, call } = useApp()
  const [accounts, setAccounts] = useState({})
  const [name, setName] = useState('')
  const [roll, setRoll] = useState('')
  const [password, setPassword] = useState('')
  const [editing, setEditing] = useState(null)   // { id, name, roll }
  const [confirm, setConfirm] = useState(null)
  const [issued, setIssued] = useState(null)     // { name, roll, password } shown once
  const [query, setQuery] = useState('')

  const loadAccounts = useCallback(async () => {
    const a = await call('profiles', { action: 'accounts' }, { quiet: true })
    if (a) setAccounts(Object.fromEntries(asArray(a).map((x) => [x.id, x])))
  }, [call])
  useEffect(() => { refreshProfiles(); loadAccounts() }, [refreshProfiles, loadAccounts])

  const add = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    const d = await editProfiles({ action: 'add', name, roll, password }, 'Adding student')
    if (d) {
      setIssued({ name, roll, password: d.password })
      setName(''); setRoll(''); setPassword('')
      loadAccounts()
    }
  }
  const save = async (e) => {
    e.preventDefault()
    const d = await editProfiles({ action: 'update', id: editing.id, name: editing.name, roll: editing.roll }, 'Renaming student')
    if (d) setEditing(null)
  }
  const remove = async (id) => {
    await editProfiles({ action: 'remove', id }, 'Deleting student')
    setConfirm(null)
    loadAccounts()
  }
  const reset = async (p) => {
    const d = await call('profiles', { action: 'resetPassword', id: p.id }, { label: 'Resetting password' })
    if (d) { setIssued({ name: p.name, roll: p.roll, password: d.password }); loadAccounts() }
  }

  const q = query.trim().toLowerCase()
  const shown = q ? profiles.filter((p) => p.name.toLowerCase().includes(q) || (p.roll || '').toLowerCase().includes(q)) : profiles
  return (
    <Modal title={`Students (${profiles.length})`} onClose={onClose} wide>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Students sign in with their <b>roll number</b> (or name) and password. A new or reset password is temporary: the
        student must choose their own at the next sign-in.
      </p>
      {issued && (
        <Note kind="ok">
          Password for <b>{issued.name}</b>{issued.roll ? ` (${issued.roll})` : ''}: <code className="issued-pw">{issued.password}</code>
          <span className="small"> — give it to the student now; it is not shown again.</span>
          <button className="btn btn-small" style={{ marginLeft: 8 }} onClick={() => setIssued(null)}>Done</button>
        </Note>
      )}
      {profiles.length > 8 && <input type="search" placeholder="Search name or roll no." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search students" style={{ margin: '10px 0' }} />}
      <div className="table-scroll" style={{ maxHeight: '48vh' }}>
        <table className="data">
          <thead><tr><th>Student</th><th>Roll no.</th><th>Account</th><th>Last sign-in</th><th>XP</th><th /></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                {editing?.id === p.id ? (
                  <td colSpan={6}>
                    <form className="row" onSubmit={save}>
                      <input type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Name" style={{ flex: 2, minWidth: 140 }} autoFocus />
                      <input type="text" value={editing.roll} onChange={(e) => setEditing({ ...editing, roll: e.target.value })} aria-label="Roll number" placeholder="Roll no." style={{ flex: 1, minWidth: 90 }} />
                      <button className="btn btn-primary btn-small" type="submit">Save</button>
                      <button className="btn btn-small" type="button" onClick={() => setEditing(null)}>Cancel</button>
                    </form>
                  </td>
                ) : (
                  <>
                    <td><span className="avatar sm">{initials(p.name)}</span> <b>{p.name}</b></td>
                    <td>{p.roll || <span className="faint">—</span>}</td>
                    <td><AccountBadge a={accounts[p.id]} /></td>
                    <td className="small muted">{accounts[p.id]?.lastLogin || '—'}</td>
                    <td>{p.xp}</td>
                    <td className="row right" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      <button className="btn btn-small" onClick={() => reset(p)} title="Give the student a new temporary password">Reset password</button>
                      <button className="icon-btn" onClick={() => setEditing({ id: p.id, name: p.name, roll: p.roll || '' })} aria-label={`Rename ${p.name}`} title="Rename"><Icon name="sliders" size={16} /></button>
                      {p.id !== 'default' && <button className="icon-btn" onClick={() => setConfirm(p)} aria-label={`Delete ${p.name}`} title="Delete"><Icon name="close" size={16} /></button>}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="add-student" onSubmit={add}>
        <label className="field"><span className="field-label">New student</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={40} /></label>
        <label className="field"><span className="field-label">Roll number</span>
          <input type="text" value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="Used to sign in" maxLength={20} /></label>
        <label className="field"><span className="field-label">First password</span>
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Empty = generate one" maxLength={64} autoComplete="off" /></label>
        <button className="btn btn-primary" type="submit" disabled={!name.trim()}><Icon name="user" size={16} /> Add student</button>
      </form>
      {confirm && (
        <Note kind="warn">
          Delete <b>{confirm.name}</b>, their account and all of their progress and Code Lab work ({confirm.xp} XP, {confirm.badges} badges)? Leaderboard entries stay.
          <div className="row right mt-sm">
            <button className="btn btn-small" onClick={() => setConfirm(null)}>Keep</button>
            <button className="btn btn-small btn-danger" onClick={() => remove(confirm.id)}>Delete</button>
          </div>
        </Note>
      )}
    </Modal>
  )
}

// Top-bar account menu: the signed-in student, or the teacher
export function ProfileMenu() {
  const { profile, matlab, role, session, signOut } = useApp()
  const [open, setOpen] = useState(false)
  const [changing, setChanging] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); box.current?.querySelector('button')?.focus() } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  if (!matlab.ok || !role) return null
  const teacher = role === 'teacher'
  const name = teacher ? 'Teacher' : profile?.name || session?.name || 'Student'
  return (
    <div className="profile-menu" ref={box}>
      <button className="profile-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} title={teacher ? 'Teacher' : 'Your account'}>
        <span className={`avatar ${teacher ? 'teacher' : ''}`}>{teacher ? <Icon name="lock" size={14} /> : initials(name)}</span>
        <span className="profile-name">{name}</span>
        <Icon name="chevron" size={14} className="chev-down" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-label">{teacher ? 'Signed in as the teacher' : `${profile?.roll ? `${profile.roll} · ` : ''}Level ${profile?.level ?? 1} · ${profile?.xp ?? 0} XP`}</div>
          {!teacher && (
            <button role="menuitem" className="menu-item" onClick={() => { setOpen(false); setChanging(true) }}>
              <Icon name="lock" size={17} /> <span className="grow">Change password</span>
            </button>
          )}
          <button role="menuitem" className="menu-item" onClick={() => { setOpen(false); signOut() }}>
            <Icon name="close" size={17} /> <span className="grow">Sign out</span>
          </button>
        </div>
      )}
      {changing && <ChangePasswordModal onClose={() => setChanging(false)} />}
    </div>
  )
}

// Used by Class settings: may students create their own accounts?
export function useSelfRegister() {
  const [value, setValue] = useState(null)
  useEffect(() => { run('auth', { action: 'options' }).then((o) => setValue(!!o.selfRegister)).catch(() => {}) }, [])
  const update = async (v) => {
    const s = await run('classroom', { action: 'setSelfRegister', value: v })
    setValue(!!s.selfRegister)
  }
  return [value, update]
}
