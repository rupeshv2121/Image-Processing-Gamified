import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { run } from '../api'
import Icon from '../components/Icon'
import ThemeToggle from '../components/ThemeToggle'
import { Note, Tabs } from '../components/ui'

// Sign-in page. Students sign in with their roll number (or name) and
// password; the teacher with the PIN. MATLAB checks the credentials
// (authManager.m) and returns a session token.
export default function Start({ next }) {
  const { matlab, login, register, teacherLogin, sessionMessage } = useApp()
  const [tab, setTab] = useState('student')
  const [mode, setMode] = useState('login')        // login | claim | register
  const [options, setOptions] = useState({ selfRegister: false, hasPin: true })
  const [form, setForm] = useState({ identifier: '', password: '', repeat: '', name: '', roll: '', pin: '' })
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (matlab.ok) run('auth', { action: 'options' }).then(setOptions).catch(() => {})
  }, [matlab.ok])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const go = (hash) => { window.location.hash = hash }
  const submit = (fn) => async (e) => {
    e.preventDefault()
    setError(null); setBusy(true)
    try { await fn() } catch (err) { setError(err) } finally { setBusy(false) }
  }

  const studentLogin = submit(async () => {
    try {
      await login(form.identifier, form.password, remember)
      go(next?.student || 'dashboard')
    } catch (err) {
      if (err.errorId === 'ImageLab:needsPassword') {     // first sign-in: choose a password
        setMode('claim'); setInfo(err.message); setForm((f) => ({ ...f, password: '', repeat: '' }))
        return
      }
      throw err
    }
  })
  const claim = submit(async () => {
    if (form.password !== form.repeat) throw new Error('The two passwords do not match.')
    await login(form.identifier, form.password, remember, true)
    go(next?.student || 'dashboard')
  })
  const signUp = submit(async () => {
    if (form.password !== form.repeat) throw new Error('The two passwords do not match.')
    await register(form.name, form.roll, form.password, remember)
    go(next?.student || 'dashboard')
  })
  const teacher = submit(async () => {
    await teacherLogin(form.pin)
    go(next?.teacher || 'class')
  })

  const switchMode = (m) => { setMode(m); setError(null); setInfo(null); setForm((f) => ({ ...f, password: '', repeat: '' })) }
  const disabled = !matlab.ok || busy

  return (
    <div className="start">
      <header className="start-head">
        <a className="brand" href="#home">
          <span className="logo" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><b>ImageLab</b><small>Image Processing Laboratory</small></span>
        </a>
        <ThemeToggle />
      </header>
      <main className="start-main signin">
        <h1>Sign in to ImageLab</h1>
        <p className="subtitle">Your dashboard, progress and Code Lab work are kept under your own account.</p>
        {!matlab.ok && <Note kind="warn">{matlab.ready ? 'MATLAB is not available.' : 'Starting MATLAB… this takes up to a minute the first time.'}</Note>}
        {sessionMessage && <Note kind="warn">{sessionMessage}</Note>}

        <section className="card start-card">
          {matlab.remote ? <Note>Sign in with your student account to join the live quiz.</Note> : (
            <Tabs tabs={[{ key: 'student', label: 'Student' }, { key: 'teacher', label: 'Teacher' }]} active={tab}
              onChange={(t) => { setTab(t); setError(null) }} />
          )}

          {tab === 'student' && mode === 'login' && (
            <form className="signin-form" onSubmit={studentLogin}>
              <label className="field"><span className="field-label">Roll number or name</span>
                <input type="text" autoComplete="username" value={form.identifier} onChange={set('identifier')} autoFocus required /></label>
              <label className="field"><span className="field-label">Password</span>
                <input type="password" autoComplete="current-password" value={form.password} onChange={set('password')} required /></label>
              <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in on this computer</label>
              <button className="btn btn-primary" type="submit" disabled={disabled || !form.identifier || !form.password}>Sign in</button>
              <p className="small muted">First time? Type your roll number and the password you want — ImageLab will ask you to confirm it.
                Forgot your password? Ask your teacher to reset it.</p>
              {options.selfRegister && (
                <p className="small">New to the class? <button type="button" className="link-btn" onClick={() => switchMode('register')}>Create an account</button></p>
              )}
            </form>
          )}

          {tab === 'student' && mode === 'claim' && (
            <form className="signin-form" onSubmit={claim}>
              {info && <Note>{info}</Note>}
              <label className="field"><span className="field-label">New password (at least 6 characters)</span>
                <input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} minLength={6} autoFocus required /></label>
              <label className="field"><span className="field-label">Repeat the password</span>
                <input type="password" autoComplete="new-password" value={form.repeat} onChange={set('repeat')} required /></label>
              <button className="btn btn-primary" type="submit" disabled={disabled || form.password.length < 6}>Set password and sign in</button>
              <button type="button" className="link-btn" onClick={() => switchMode('login')}>← Back</button>
            </form>
          )}

          {tab === 'student' && mode === 'register' && (
            <form className="signin-form" onSubmit={signUp}>
              <label className="field"><span className="field-label">Your name</span>
                <input type="text" autoComplete="name" value={form.name} onChange={set('name')} maxLength={40} autoFocus required /></label>
              <label className="field"><span className="field-label">Roll number (you sign in with it)</span>
                <input type="text" autoComplete="username" value={form.roll} onChange={set('roll')} maxLength={20} required /></label>
              <label className="field"><span className="field-label">Password (at least 6 characters)</span>
                <input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} minLength={6} required /></label>
              <label className="field"><span className="field-label">Repeat the password</span>
                <input type="password" autoComplete="new-password" value={form.repeat} onChange={set('repeat')} required /></label>
              <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in on this computer</label>
              <button className="btn btn-primary" type="submit" disabled={disabled || !form.name.trim() || !form.roll.trim() || form.password.length < 6}>Create account</button>
              <button type="button" className="link-btn" onClick={() => switchMode('login')}>← I already have an account</button>
            </form>
          )}

          {tab === 'teacher' && (
            <form className="signin-form" onSubmit={teacher}>
              {options.hasPin ? (
                <label className="field"><span className="field-label">Teacher PIN</span>
                  <input type="password" inputMode="numeric" autoComplete="current-password" value={form.pin} onChange={set('pin')} autoFocus required /></label>
              ) : <Note kind="warn">No teacher PIN is set yet — set one in Class settings right after signing in.</Note>}
              <button className="btn btn-navy" type="submit" disabled={disabled || (options.hasPin && !form.pin)}>Sign in as teacher</button>
              <p className="small muted">The teacher session ends when this browser tab is closed.</p>
            </form>
          )}

          {error && <Note kind="error">{error.message}</Note>}
        </section>
      </main>
    </div>
  )
}
