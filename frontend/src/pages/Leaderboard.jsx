import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import { initials, StudentsModal } from '../components/Profiles'
import { Card, Modal, Page, Segmented, Tabs } from '../components/ui'

export default function Leaderboard() {
  const { call, matlab, profiles, profileId, refreshProfiles, role } = useApp()
  const teacher = role === 'teacher'
  const [rows, setRows] = useState([])
  const [mode, setMode] = useState('all')
  const [confirm, setConfirm] = useState(false)
  const [tab, setTab] = useState('scores')
  const [manage, setManage] = useState(false)
  useEffect(() => { if (matlab.ok && tab === 'class') refreshProfiles() }, [matlab.ok, tab, refreshProfiles])
  const klass = profiles.slice().sort((a, b) => b.xp - a.xp || b.bestScore - a.bestScore)

  const load = async () => {
    const d = await call('leaderboard', { action: 'get' }, { label: 'Loading leaderboard' })
    if (d) setRows(asArray(d))
  }
  useEffect(() => { if (matlab.ok) load() }, [matlab.ok]) // eslint-disable-line react-hooks/exhaustive-deps

  const clear = async () => {
    const d = await call('leaderboard', { action: 'clear' }, { label: 'Clearing leaderboard' })
    if (d) setRows(asArray(d))
    setConfirm(false)
  }
  const modes = ['all', ...new Set(rows.map((r) => r.Mode))]
  const shown = rows.filter((r) => mode === 'all' || r.Mode === mode)

  return (
    <Page eyebrow="Play" title="Leaderboard" subtitle="Top quiz scores and the class ranking of every student profile on this computer."
      actions={tab === 'scores'
        ? <><button className="btn" onClick={load}>Refresh</button>{teacher && <button className="btn btn-danger" onClick={() => setConfirm(true)} disabled={!rows.length}>Clear…</button>}</>
        : <><button className="btn" onClick={refreshProfiles}>Refresh</button>{teacher && <button className="btn btn-navy" onClick={() => setManage(true)}>Manage students…</button>}</>}>
      <Tabs tabs={[{ key: 'scores', label: 'Quiz scores' }, { key: 'class', label: `Class (${profiles.length})` }]} active={tab} onChange={setTab} />
      {tab === 'class' && (
        <Card>
          <table className="data">
            <thead><tr><th>Rank</th><th>Student</th><th>Roll no.</th><th>Level</th><th>XP</th><th>Badges</th><th>Quizzes</th><th>Accuracy</th><th>Best score</th><th>Daily streak</th></tr></thead>
            <tbody>
              {klass.map((s, i) => (
                <tr key={s.id} className={s.id === profileId ? 'best' : ''}>
                  <td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                  <td><span className="avatar sm">{initials(s.name)}</span> <b>{s.name}</b>{s.id === profileId && <span className="badge" style={{ marginLeft: 8 }}>you</span>}</td>
                  <td>{s.roll || <span className="faint">—</span>}</td>
                  <td>{s.level}</td><td><b>{s.xp}</b></td><td>{s.badges}</td><td>{s.quizzes}</td>
                  <td>{s.quizzes ? `${fmt(s.accuracy, 0)}%` : '—'}</td><td>{s.bestScore}</td><td>{s.dailyStreak ? `${s.dailyStreak} 🔥` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {profiles.length < 2 && <p className="small muted mt-sm">Only one student so far. Add classmates with <b>Manage students…</b> — each gets their own XP, badges and streak, and they all appear here.</p>}
        </Card>
      )}
      {tab === 'scores' && <Card>
        {modes.length > 2 && <div style={{ marginBottom: 12 }}><Segmented value={mode} onChange={setMode} options={modes.map((m) => ({ value: m, label: m === 'all' ? 'All modes' : m }))} /></div>}
        {shown.length ? (
          <table className="data">
            <thead><tr><th>Rank</th><th>Name</th><th>Roll no.</th><th>Score</th><th>Accuracy</th><th>Best streak</th><th>Mode</th><th>Date</th></tr></thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} className={i === 0 ? 'best' : ''}>
                  <td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                  <td>{r.Name}</td><td>{r.Roll}</td><td><b>{r.Score}</b></td><td>{fmt(r.Accuracy, 1)}%</td>
                  <td>{r.BestStreak}</td><td>{r.Mode}</td><td className="small muted">{r.Date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No scores yet. Play the <a href="#quiz">Rapid Fire Quiz</a> and enter your name to appear here.</p>
        )}
      </Card>}
      {manage && <StudentsModal onClose={() => setManage(false)} />}
      {confirm && (
        <Modal title="Clear the leaderboard?" onClose={() => setConfirm(false)}>
          <p>All {rows.length} leaderboard entries will be deleted. This cannot be undone.</p>
          <div className="row right"><button className="btn" onClick={() => setConfirm(false)}>Cancel</button><button className="btn btn-primary" onClick={clear}>Clear</button></div>
        </Modal>
      )}
    </Page>
  )
}
