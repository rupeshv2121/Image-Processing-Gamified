import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, run } from '../api'
import Icon from '../components/Icon'
import { initials } from '../components/Profiles'
import ThemeToggle from '../components/ThemeToggle'
import { Note } from '../components/ui'

// Entry screen: every visit starts as a student (pick your profile) or as the
// teacher (PIN). The two modes have separate dashboards and navigation.
export default function Start({ next }) {
  const { matlab, profiles, refreshProfiles, enterStudent, enterTeacher } = useApp()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [roll, setRoll] = useState('')
  const [pin, setPin] = useState('')
  const [hasPin, setHasPin] = useState(true)
  const [error, setError] = useState(null)
  const [teacherError, setTeacherError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!matlab.ok) return
    refreshProfiles()
    run('classroom', { action: 'get' }).then((s) => setHasPin(!!s.hasPin)).catch(() => {})
  }, [matlab.ok, refreshProfiles])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? profiles.filter((p) => p.name.toLowerCase().includes(q) || (p.roll || '').toLowerCase().includes(q)) : profiles
  }, [profiles, query])

  const go = (hash) => { window.location.hash = hash }

  const pickStudent = async (id) => {
    await enterStudent(id)
    go(next?.student || 'dashboard')
  }

  const addMe = async (e) => {
    e.preventDefault()
    setError(null); setBusy(true)
    try {
      const list = asArray(await run('profiles', { action: 'add', name, roll }))
      await refreshProfiles()
      const me = list.find((p) => p.name.toLowerCase() === name.trim().toLowerCase()) || list[list.length - 1]
      await pickStudent(me.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const teacher = async (e) => {
    e.preventDefault()
    setTeacherError(null); setBusy(true)
    try {
      await enterTeacher(pin)
      go(next?.teacher || 'class')
    } catch (err) {
      setTeacherError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="start">
      <header className="start-head">
        <a className="brand" href="#home">
          <span className="logo" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><b>ImageLab</b><small>Image Processing Laboratory</small></span>
        </a>
        <ThemeToggle />
      </header>
      <main className="start-main">
        <h1>Who is using ImageLab?</h1>
        <p className="subtitle">Students learn and practise; the teacher follows the class and sets the work.</p>
        {!matlab.ok && <Note kind="warn">{matlab.ready ? 'MATLAB is not available.' : 'Starting MATLAB… this takes up to a minute the first time.'}</Note>}

        <div className="start-grid">
          <section className="card start-card" aria-labelledby="start-student">
            <div className="start-ic"><Icon name="user" size={26} /></div>
            <h2 id="start-student">I am a student</h2>
            <p className="small muted">Choose your name. Your XP, badges, quizzes and Code Lab work are saved under it.</p>
            {profiles.length > 8 && (
              <input type="search" className="mt-sm" placeholder="Search name or roll no." value={query}
                onChange={(e) => setQuery(e.target.value)} aria-label="Search students" />
            )}
            <div className="start-students" role="list">
              {shown.map((p) => (
                <button key={p.id} role="listitem" className="start-student" onClick={() => pickStudent(p.id)} disabled={!matlab.ok}>
                  <span className="avatar">{initials(p.name)}</span>
                  <span className="grow">{p.name}<small>{p.roll ? `${p.roll} · ` : ''}Level {p.level}</small></span>
                  <Icon name="chevron" size={16} />
                </button>
              ))}
              {matlab.ok && shown.length === 0 && <p className="small muted">No student matches “{query}”.</p>}
            </div>
            {adding ? (
              <form className="start-add" onSubmit={addMe}>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} aria-label="Your name" autoFocus />
                <input type="text" value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="Roll no. (optional)" maxLength={20} aria-label="Roll number" />
                <button className="btn btn-primary" type="submit" disabled={!name.trim() || busy}>Start</button>
                <button className="btn btn-ghost" type="button" onClick={() => setAdding(false)}>Cancel</button>
              </form>
            ) : (
              <button className="btn btn-ghost mt-sm" onClick={() => setAdding(true)} disabled={!matlab.ok}><Icon name="user" size={16} /> I am new — add me</button>
            )}
            {error && <Note kind="error">{error}</Note>}
          </section>

          <section className="card start-card teacher" aria-labelledby="start-teacher">
            <div className="start-ic navy"><Icon name="lock" size={26} /></div>
            <h2 id="start-teacher">I am the teacher</h2>
            <p className="small muted">Class dashboard, every student's progress and code, assignments and exports.</p>
            <form className="start-pin" onSubmit={teacher}>
              {hasPin && (
                <input type="password" inputMode="numeric" autoComplete="current-password" value={pin}
                  onChange={(e) => setPin(e.target.value)} placeholder="Teacher PIN" aria-label="Teacher PIN" />
              )}
              <button className="btn btn-navy" type="submit" disabled={!matlab.ok || busy || (hasPin && !pin)}>Enter as teacher</button>
            </form>
            {!hasPin && matlab.ok && <p className="small muted mt-sm">No teacher PIN is set yet — set one in <b>Class settings</b> so students cannot open the teacher side.</p>}
            {teacherError && <Note kind="error">{teacherError}</Note>}
          </section>
        </div>
      </main>
    </div>
  )
}
