import { useState } from 'react'
import { useApp } from '../AppContext'
import { Modal, Note } from './ui'

// Change the signed-in student's password. After a teacher reset (temporary
// password) the current password is not asked again.
export function ChangePasswordForm({ forced = false, onDone }) {
  const { changePassword } = useApp()
  const [f, setF] = useState({ old: '', next: '', repeat: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (f.next !== f.repeat) { setError('The two passwords do not match.'); return }
    setBusy(true)
    try {
      await changePassword(f.old, f.next)
      onDone?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="signin-form" onSubmit={submit}>
      {!forced && (
        <label className="field"><span className="field-label">Current password</span>
          <input type="password" autoComplete="current-password" value={f.old} onChange={set('old')} required autoFocus /></label>
      )}
      <label className="field"><span className="field-label">New password (at least 6 characters)</span>
        <input type="password" autoComplete="new-password" value={f.next} onChange={set('next')} minLength={6} required autoFocus={forced} /></label>
      <label className="field"><span className="field-label">Repeat the new password</span>
        <input type="password" autoComplete="new-password" value={f.repeat} onChange={set('repeat')} required /></label>
      <button className="btn btn-primary" type="submit" disabled={busy || f.next.length < 6}>Save new password</button>
      {error && <Note kind="error">{error}</Note>}
    </form>
  )
}

export function ChangePasswordModal({ onClose }) {
  const { notify } = useApp()
  return (
    <Modal title="Change your password" onClose={onClose}>
      <ChangePasswordForm onDone={() => { notify('Password changed'); onClose() }} />
    </Modal>
  )
}

// Shown right after signing in with a temporary password from the teacher
export function ForcedPasswordChange() {
  const { session, signOut, notify } = useApp()
  return (
    <div className="start">
      <main className="start-main signin">
        <h1>Choose your own password</h1>
        <p className="subtitle">Hi {session?.name}! Your teacher gave you a temporary password. Choose a new one that only you know.</p>
        <section className="card start-card">
          <ChangePasswordForm forced onDone={() => notify('Password saved — welcome!')} />
          <button className="link-btn mt-sm" onClick={() => signOut()}>Sign out</button>
        </section>
      </main>
    </div>
  )
}
