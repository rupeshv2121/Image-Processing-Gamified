import { useCallback, useEffect, useState } from 'react'
import { asArray, fmt, run } from '../../api'
import Icon from '../../components/Icon'
import { initials } from '../../components/Profiles'
import { Card, Metrics, Note, Page } from '../../components/ui'
import { MEDALS } from '../../content/missions'
import SubmissionModal from './SubmissionModal'
import { timeAgo, todayStr } from './TeacherData'

const idFromHash = () => decodeURIComponent((window.location.hash.match(/[?&]id=([^&]+)/) || [])[1] || '')
const REFRESH_MS = 15000

export default function StudentDetail() {
  const [id, setId] = useState(idFromHash)
  const [s, setS] = useState(null)
  const [error, setError] = useState(null)
  const [loadedAt, setLoadedAt] = useState(null)
  const [open, setOpen] = useState(null)        // task id whose code is shown

  useEffect(() => {
    const onHash = () => setId(idFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // Live while open: reloaded every 15 s and when the window gets the focus back,
  // so new Code Lab runs, quizzes and XP show up without leaving the page
  const load = useCallback((quiet) => run('classroom', { action: 'student', id })
    .then((d) => { setS(d); setError(null); setLoadedAt(new Date()) })
    .catch((e) => { if (!quiet) setError(e.message) }), [id])
  useEffect(() => {
    if (!id) return undefined
    setS(null); setError(null)
    load(false)
    const t = setInterval(() => document.visibilityState === 'visible' && load(true), REFRESH_MS)
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [id, load])

  const back = { href: '#students', label: 'All students' }
  if (error) return <Page back={back} eyebrow="Teacher" title="Student"><Note kind="error">{error}</Note></Page>
  if (!s) return <Page back={back} eyebrow="Teacher" title="Student"><p className="muted">{id ? 'Loading…' : 'No student selected.'}</p></Page>

  const sum = s.summary
  const code = asArray(s.code)
  const exps = asArray(s.experiments)
  const today = todayStr()
  const badges = asArray(sum.badges).filter((b) => b.earned)
  return (
    <Page back={back} eyebrow="Teacher · Student"
      title={<span className="row" style={{ gap: 14 }}><span className="avatar lg">{initials(s.name)}</span>{s.name}</span>}
      subtitle={`${s.roll ? `Roll no. ${s.roll} · ` : ''}${s.created ? `joined ${s.created} · ` : ''}last active ${timeAgo(s.lastActive)}`}
      actions={<>
        {loadedAt && <span className="small faint">Updated {loadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
        <button className="btn" onClick={() => load(false)}><Icon name="reset" size={16} /> Refresh</button>
      </>}>
      <div className="stack">
        <Metrics items={[
          { label: 'Level', value: sum.level },
          { label: 'XP', value: sum.xp },
          { label: 'Badges', value: badges.length },
          { label: 'Quizzes', value: sum.quizzesTaken ? `${sum.quizzesTaken} · ${fmt(sum.accuracy, 0)}%` : '0' },
          { label: 'Code tasks solved', value: `${code.filter((c) => c.passed).length} / ${code.length}` },
          { label: 'Experiments', value: `${asArray(sum.experimentsCompleted).length} / ${exps.length}` },
        ]} />

        <Card title="Code Lab" extra={<a className="btn btn-small" href="#assign">Manage tasks</a>}>
          {code.length === 0 ? <p className="muted small">No Code Lab tasks are published yet. Write one under <a href="#assign">Assignments → Code Lab tasks</a>.</p> : (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Task</th><th>Level</th><th>Status</th><th>Result</th><th>Runs</th><th>Best match</th><th>Last run</th><th /></tr></thead>
              <tbody>
                {code.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.title}</b></td>
                    <td className="small">{c.level}</td>
                    <td>{c.status === 'assigned' ? <span className={`badge ${c.due && c.due < today && !c.passed ? 'badge-locked' : 'badge-warn'}`}>assigned{c.due ? ` · ${c.due}` : ''}</span>
                      : c.status === 'locked' ? <span className="badge badge-navy">locked</span> : <span className="faint small">open</span>}</td>
                    <td>{c.passed ? <span className="badge">✓ solved</span> : c.attempts ? <span className="badge badge-warn">not yet</span> : <span className="faint small">not tried</span>}</td>
                    <td>{c.attempts || '—'}</td>
                    <td>{c.attempts ? `${fmt(c.bestMatch, 1)}%` : '—'}</td>
                    <td className="small muted">{c.lastRun ? timeAgo(c.lastRun) : '—'}</td>
                    <td>{c.attempts > 0 && <button className="btn btn-small" onClick={() => setOpen(c.id)}>View code</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>)}
        </Card>

        <div className="grid-2" style={{ alignItems: 'start' }}>
          <Card title="Quiz topics">
            <div className="stack-sm">
              {asArray(s.topics).map((t) => (
                <div key={t.category}>
                  <div className="row between small"><span>{t.category}</span><span className="muted">{t.answered ? `${fmt(t.accuracy, 0)}% · ${t.correct}/${t.answered}` : 'not tried'}</span></div>
                  <div className={`progressbar ${t.answered && t.accuracy < 60 ? 'danger' : t.answered && t.accuracy < 80 ? 'warn' : ''}`} style={{ marginTop: 5 }}>
                    <div style={{ width: `${t.answered ? t.accuracy : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Activity">
            {asArray(s.events).length === 0 ? <p className="muted small">No activity recorded yet.</p> : (
              <ul className="feed">
                {asArray(s.events).map((e, i) => (
                  <li key={i}><span className="grow">{e.text}</span><span className="tiny faint" title={e.time}>{timeAgo(e.time)}</span></li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid-2" style={{ alignItems: 'start' }}>
          <Card title="Experiments">
            <ul className="exp-checklist">
              {exps.map((e) => (
                <li key={e.number} className={e.done ? 'done' : ''}>
                  <span className="tick">{e.done ? '✓' : e.number}</span>
                  <span className="grow small">{e.title}</span>
                  {e.status === 'assigned' && !e.done && <span className={`badge ${e.due && e.due < today ? 'badge-locked' : 'badge-warn'}`}>{e.due && e.due < today ? 'overdue' : 'assigned'}</span>}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Quizzes and badges">
            {asArray(s.quizHistory).length === 0 ? <p className="muted small">No quizzes yet.</p> : (
              <table className="data">
                <thead><tr><th>Date</th><th>Mode</th><th>Score</th><th>Accuracy</th></tr></thead>
                <tbody>{asArray(s.quizHistory).slice(0, 8).map((q, i) => (
                  <tr key={i}><td className="small">{q.date}</td><td className="small">{q.mode}</td><td>{q.score}</td><td>{fmt(q.accuracy, 0)}%</td></tr>
                ))}</tbody>
              </table>
            )}
            <div className="row mt-sm" style={{ gap: 6 }}>
              {badges.length === 0 ? <span className="small muted">No badges yet.</span>
                : badges.map((b) => <span key={b.id} className="badge badge-navy" title={b.description}>{MEDALS[b.id] || '🏅'} {b.name}</span>)}
            </div>
          </Card>
        </div>
      </div>
      {open && <SubmissionModal studentId={s.id} taskId={open} onClose={() => setOpen(null)} />}
    </Page>
  )
}
