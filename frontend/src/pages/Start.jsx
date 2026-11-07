import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { run } from '../api'
import { Logo, SITE_NAME, SITE_TAGLINE } from '../components/Brand'
import Icon from '../components/Icon'
import ThemeToggle from '../components/ThemeToggle'
import RecoveryCode from '../components/RecoveryCode'
import { Note } from '../components/ui'

// Decorative: one small 6x6 colour image split into its R, G and B channels.
// Each channel is a bright blob in a different place; opacity = intensity.
const CHANNELS = [['r', 'R', 1.5, 1.5], ['g', 'G', 2.5, 3.5], ['b', 'B', 4, 2]].map(([ch, label, cy, cx]) => ({
  ch,
  label,
  cells: Array.from({ length: 36 }, (_, i) => {
    const d = Math.hypot(Math.floor(i / 6) - cy, (i % 6) - cx)
    return 0.12 + 0.88 * Math.max(0, 1 - d / 4)
  }),
}))

function Channels() {
  return (
    <div className="auth-channels" aria-hidden="true">
      {CHANNELS.map(({ ch, label, cells }) => (
        <figure key={ch} className={`ch-${ch}`}>
          <div className="auth-channel">{cells.map((v, i) => <i key={i} style={{ opacity: v }} />)}</div>
          <figcaption>{label}</figcaption>
        </figure>
      ))}
    </div>
  )
}

// Sign-in page. Students sign in with their roll number (or name) and
// password; the teacher with the PIN. The backend checks the credentials
// (services/auth.py) and returns a session token.
export default function Start({ next }) {
  const { matlab, login, register, teacherLogin, teacherSession, sessionMessage } = useApp()
  const [tab, setTab] = useState('student')
  const [mode, setMode] = useState('login')        // login | claim | register
  const [options, setOptions] = useState({ selfRegister: false, hasPin: true })
  const [form, setForm] = useState({ identifier: '', password: '', repeat: '', name: '', roll: '', pin: '', code: '' })
  const [teacherMode, setTeacherMode] = useState('login')      // login | recover
  const [newSession, setNewSession] = useState(null)        // PIN created / recovered: show the recovery code first
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  // Signing in is answered by the server itself - it never waits for MATLAB to start
  const loadOptions = () => run('auth', { action: 'options' }).then(setOptions).catch(() => {})
  useEffect(() => {
    if (matlab.server) loadOptions()
  }, [matlab.server])

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
    try {
      await teacherLogin(form.pin)
    } catch (err) {
      if (err.errorId === 'ImageLab:noTeacherPin') loadOptions()      // the PIN was reset meanwhile
      throw err
    }
    go(next?.teacher || 'class')
  })
  const createPin = submit(async () => {
    if (form.pin !== form.repeat) throw new Error('The two PINs do not match.')
    setNewSession(await run('auth', { action: 'teacherSetup', pin: form.pin }))
  })
  const recover = submit(async () => {
    if (form.pin !== form.repeat) throw new Error('The two PINs do not match.')
    setNewSession(await run('auth', { action: 'teacherRecover', code: form.code, pin: form.pin }))
  })
  const enterTeacher = () => {
    teacherSession(newSession)
    go(next?.teacher || 'class')
  }
  const pinFields = (label) => (
    <div className="auth-row">
      <label className="field"><span className="field-label">{label}</span>
        <input type="password" autoComplete="new-password" value={form.pin} onChange={set('pin')} minLength={6} maxLength={32} placeholder="6+ characters" required /></label>
      <label className="field"><span className="field-label">Repeat the PIN</span>
        <input type="password" autoComplete="new-password" value={form.repeat} onChange={set('repeat')} required /></label>
    </div>
  )

  const switchMode = (m) => { setMode(m); setError(null); setInfo(null); setForm((f) => ({ ...f, password: '', repeat: '' })) }
  const disabled = !matlab.server || busy

  const heading = tab === 'teacher'
    ? newSession ? ['Your recovery code', 'Keep it somewhere safe, away from students.']
      : !options.hasPin ? ['Create the teacher PIN', 'The teacher side is locked until a PIN is set. You will need it every time you sign in as the teacher.']
        : teacherMode === 'recover' ? ['Forgot the PIN?', 'Enter the recovery code you saved when the PIN was created, then choose a new PIN.']
          : ['Teacher sign in', 'Manage your class, assignments and the live quiz.']
    : mode === 'register' ? ['Create your account', 'Join the class with your name and roll number.']
      : mode === 'claim' ? ['Choose a password', 'This is your first sign-in — pick a password for your account.']
        : ['Welcome back', 'Sign in to continue your labs, experiments and quizzes.']

  return (
    <div className="auth">
      <aside className="auth-side">
        <a className="brand" href="#home">
          <Logo />
          <span><b>{SITE_NAME}</b><small>{SITE_TAGLINE}</small></span>
        </a>
        <div className="auth-pitch">
          <Channels />
          <h2>Learn image processing by doing it in MATLAB.</h2>
          <ul>
            <li className="ch-r"><span className="auth-ic"><Icon name="flask" size={16} /></span>Hands-on labs for all four syllabus units</li>
            <li className="ch-g"><span className="auth-ic"><Icon name="chart" size={16} /></span>Your progress, XP and reports in one place</li>
            <li className="ch-b"><span className="auth-ic"><Icon name="gamepad" size={16} /></span>Live class quizzes and the Arcade</li>
          </ul>
        </div>
        <a className="auth-back" href="#home"><Icon name="arrow" size={14} className="flip" /> Back to home</a>
      </aside>

      <main className="auth-main">
        <div className="auth-top">
          <a className="brand auth-brand-mobile" href="#home"><Logo /><b>{SITE_NAME}</b></a>
          <ThemeToggle />
        </div>
        <div className="auth-form-wrap">
          <h1>{heading[0]}</h1>
          <p className="auth-sub">{heading[1]}</p>

          {matlab.remote ? <Note>Sign in with your student account. Teacher mode and the Code Lab work on the Spatia computer only.</Note> : (
            <div className="segmented auth-role" role="tablist" aria-label="Sign in as">
              {[['student', 'Student'], ['teacher', 'Teacher']].map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''}
                  onClick={() => { setTab(k); setError(null) }} disabled={!!newSession}>{label}</button>
              ))}
            </div>
          )}

          {!matlab.server ? <Note kind="warn">Connecting to the Spatia server…</Note>
            : !matlab.ok && !matlab.remote && <Note>{matlab.ready ? 'MATLAB is not available — you can sign in, but the labs need MATLAB.' : 'MATLAB is starting (up to a minute the first time) — you can already sign in.'}</Note>}
          {sessionMessage && <Note kind="warn">{sessionMessage}</Note>}

          {tab === 'student' && mode === 'login' && (
            <form className="signin-form" onSubmit={studentLogin}>
              <label className="field"><span className="field-label">Roll number or name</span>
                <input type="text" autoComplete="username" value={form.identifier} onChange={set('identifier')} autoFocus required /></label>
              <label className="field"><span className="field-label">Password</span>
                <input type="password" autoComplete="current-password" value={form.password} onChange={set('password')} required /></label>
              <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in on this {matlab.remote ? 'device' : 'computer'}</label>
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={disabled || !form.identifier || !form.password}>{busy ? 'Signing in…' : 'Sign in'}</button>
              <p className="auth-hint">First time? Type your roll number and the password you want — {SITE_NAME} will ask you to confirm it.
                Forgot your password? Ask your teacher to reset it.</p>
              {options.selfRegister && (
                <p className="auth-switch">New to the class? <button type="button" className="link-btn" onClick={() => switchMode('register')}>Create an account</button></p>
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
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={disabled || form.password.length < 6}>Set password and sign in</button>
              <p className="auth-switch"><button type="button" className="link-btn" onClick={() => switchMode('login')}>← Back</button></p>
            </form>
          )}

          {tab === 'student' && mode === 'register' && (
            <form className="signin-form" onSubmit={signUp}>
              <label className="field"><span className="field-label">Your name</span>
                <input type="text" autoComplete="name" value={form.name} onChange={set('name')} maxLength={40} autoFocus required /></label>
              <label className="field"><span className="field-label">Roll number (you sign in with it)</span>
                <input type="text" autoComplete="username" value={form.roll} onChange={set('roll')} maxLength={20} required /></label>
              <div className="auth-row">
                <label className="field"><span className="field-label">Password</span>
                  <input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} minLength={6} placeholder="6+ characters" required /></label>
                <label className="field"><span className="field-label">Repeat password</span>
                  <input type="password" autoComplete="new-password" value={form.repeat} onChange={set('repeat')} required /></label>
              </div>
              <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in on this computer</label>
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={disabled || !form.name.trim() || !form.roll.trim() || form.password.length < 6}>Create account</button>
              <p className="auth-switch">Already have an account? <button type="button" className="link-btn" onClick={() => switchMode('login')}>Sign in</button></p>
            </form>
          )}

          {tab === 'teacher' && newSession && <RecoveryCode code={newSession.recoveryCode} onDone={enterTeacher} doneLabel="Continue to the teacher dashboard" />}

          {tab === 'teacher' && !newSession && !options.hasPin && (
            <form className="signin-form" onSubmit={createPin}>
              {pinFields('New teacher PIN')}
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={disabled || form.pin.length < 6 || !form.repeat}>Create PIN</button>
              <p className="auth-hint">6 to 32 characters (letters and numbers). Next you get a one-time recovery code for the day you forget the PIN.</p>
            </form>
          )}

          {tab === 'teacher' && !newSession && options.hasPin && teacherMode === 'login' && (
            <form className="signin-form" onSubmit={teacher}>
              <label className="field"><span className="field-label">Teacher PIN</span>
                <input type="password" autoComplete="current-password" value={form.pin} onChange={set('pin')} autoFocus required /></label>
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={disabled || !form.pin}>Sign in as teacher</button>
              <p className="auth-hint">The teacher session ends when this browser tab is closed.</p>
              <p className="auth-switch"><button type="button" className="link-btn" onClick={() => { setTeacherMode('recover'); setError(null); setForm((f) => ({ ...f, pin: '', repeat: '' })) }}>Forgot PIN?</button></p>
            </form>
          )}

          {tab === 'teacher' && !newSession && options.hasPin && teacherMode === 'recover' && (
            <form className="signin-form" onSubmit={recover}>
              <label className="field"><span className="field-label">Recovery code</span>
                <input type="text" autoComplete="off" spellCheck={false} className="recovery-input" placeholder="XXXX-XXXX-XXXX" value={form.code} onChange={set('code')} autoFocus required /></label>
              {pinFields('New teacher PIN')}
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={disabled || !form.code.trim() || form.pin.length < 6 || !form.repeat}>Set new PIN</button>
              <p className="auth-hint">Lost the recovery code too? On the {SITE_NAME} computer, run <code>reset_teacher_pin.bat</code> in the ImageLab folder, then create a new PIN here. Students and scores are kept.</p>
              <p className="auth-switch"><button type="button" className="link-btn" onClick={() => { setTeacherMode('login'); setError(null) }}>← Back to sign in</button></p>
            </form>
          )}

          {error && <div className="mt-sm"><Note kind="error">{error.message}</Note></div>}
        </div>
      </main>
    </div>
  )
}
