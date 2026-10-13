import { useEffect, useRef, useState } from 'react'
import { useApp } from '../AppContext'
import Icon from './Icon'
import { Modal, Note } from './ui'

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'

// Add, rename and delete student profiles (stored by MATLAB in data/profiles.mat)
export function StudentsModal({ onClose }) {
  const { profiles, profileId, editProfiles, switchProfile, refreshProfiles } = useApp()
  useEffect(() => { refreshProfiles() }, [refreshProfiles])
  const [name, setName] = useState('')
  const [roll, setRoll] = useState('')
  const [editing, setEditing] = useState(null)   // { id, name, roll }
  const [confirm, setConfirm] = useState(null)

  const add = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    const list = await editProfiles({ action: 'add', name, roll }, 'Adding student')
    if (list) {
      setName('')
      setRoll('')
    }
  }
  const save = async (e) => {
    e.preventDefault()
    const list = await editProfiles({ action: 'update', id: editing.id, name: editing.name, roll: editing.roll }, 'Renaming student')
    if (list) setEditing(null)
  }
  const remove = async (id) => {
    await editProfiles({ action: 'remove', id }, 'Deleting student')
    setConfirm(null)
  }

  return (
    <Modal title="Students on this computer" onClose={onClose} wide>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Every student has their own XP, badges, quiz history and daily-challenge streak. Switch student from the menu at the top right.
      </p>
      <div className="table-scroll">
        <table className="data">
          <thead><tr><th>Student</th><th>Roll no.</th><th>Level</th><th>XP</th><th>Badges</th><th /></tr></thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className={p.id === profileId ? 'best' : ''}>
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
                    <td><span className="avatar sm">{initials(p.name)}</span> <b>{p.name}</b>{p.id === profileId && <span className="badge" style={{ marginLeft: 8 }}>active</span>}</td>
                    <td>{p.roll || <span className="faint">—</span>}</td>
                    <td>{p.level}</td>
                    <td>{p.xp}</td>
                    <td>{p.badges}</td>
                    <td className="row right" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      {p.id !== profileId && <button className="btn btn-small" onClick={() => { switchProfile(p.id); onClose() }}>Switch</button>}
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
          <input type="text" value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="Optional" maxLength={20} /></label>
        <button className="btn btn-primary" type="submit" disabled={!name.trim()}><Icon name="user" size={16} /> Add student</button>
      </form>
      {confirm && (
        <Note kind="warn">
          Delete <b>{confirm.name}</b> and all of their progress ({confirm.xp} XP, {confirm.badges} badges)? Leaderboard entries stay.
          <div className="row right mt-sm">
            <button className="btn btn-small" onClick={() => setConfirm(null)}>Keep</button>
            <button className="btn btn-small btn-danger" onClick={() => remove(confirm.id)}>Delete</button>
          </div>
        </Note>
      )}
    </Modal>
  )
}

// Top-bar menu: who is learning right now
export function ProfileMenu() {
  const { profiles, profile, profileId, switchProfile, matlab, refreshProfiles } = useApp()
  const [open, setOpen] = useState(false)
  const [manage, setManage] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    refreshProfiles()                     // XP may have changed since the last look
    const onDown = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); box.current?.querySelector('button')?.focus() } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  if (!matlab.ok) return null
  const name = profile?.name || 'Student'
  return (
    <div className="profile-menu" ref={box}>
      <button className="profile-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} title="Switch student">
        <span className="avatar">{initials(name)}</span>
        <span className="profile-name">{name}</span>
        <Icon name="chevron" size={14} className="chev-down" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-label">Who is learning?</div>
          {profiles.map((p) => (
            <button key={p.id} role="menuitemradio" aria-checked={p.id === profileId} className={`menu-item ${p.id === profileId ? 'active' : ''}`}
              onClick={() => { setOpen(false); if (p.id !== profileId) switchProfile(p.id) }}>
              <span className="avatar sm">{initials(p.name)}</span>
              <span className="grow">{p.name}<small>Level {p.level} · {p.xp} XP</small></span>
              {p.id === profileId && <Icon name="check" size={16} />}
            </button>
          ))}
          <div className="menu-sep" />
          <button role="menuitem" className="menu-item" onClick={() => { setOpen(false); setManage(true) }}>
            <Icon name="users" size={17} /> <span className="grow">Manage students…</span>
          </button>
        </div>
      )}
      {manage && <StudentsModal onClose={() => setManage(false)} />}
    </div>
  )
}
