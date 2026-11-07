import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import { Card, LineChart, Page, Segmented } from '../components/ui'
import { MODES, modeOf, withProfileIds } from '../leaderboard'

// Every score posted to the leaderboard, one row per attempt (the Leaderboard
// page shows each student's best only). Students start with their own attempts.
export default function QuizHistory() {
  const { call, matlab, profileId, role } = useApp()
  const [rows, setRows] = useState(null)
  const [mode, setMode] = useState('all')
  const [whose, setWhose] = useState(role === 'student' ? 'mine' : 'class')

  const load = async () => {
    const d = await call('leaderboard', { action: 'get' }, { label: 'Loading quiz history' })
    if (d) setRows(withProfileIds(asArray(d)).map((r) => ({ ...r, Mode: modeOf(r) })))
  }
  useEffect(() => { if (matlab.server) load() }, [matlab.server]) // eslint-disable-line react-hooks/exhaustive-deps

  const all = (rows || []).filter((r) => whose === 'class' || (profileId && r.ProfileId === profileId))
  const counts = all.reduce((c, r) => ({ ...c, [r.Mode]: (c[r.Mode] || 0) + 1 }), {})
  const modes = [...MODES.map((m) => m.mode), ...Object.keys(counts).filter((m) => !MODES.some((x) => x.mode === m))]
  const list = all.filter((r) => mode === 'all' || r.Mode === mode).sort((a, b) => String(b.Date).localeCompare(String(a.Date)))
  const scores = list.map((r) => r.Score)
  const game = MODES.find((m) => m.mode === mode)?.game

  return (
    <Page eyebrow="Play" title="Quiz history" subtitle="Every score posted from the Arcade, one row per attempt, by game."
      actions={<><a className="btn" href="#leaderboard">Leaderboard</a><button className="btn" onClick={load}>Refresh</button></>}>
      {role === 'student' && (
        <div style={{ marginBottom: 16 }}>
          <Segmented value={whose} onChange={setWhose} options={[{ value: 'mine', label: 'My attempts' }, { value: 'class', label: 'Whole class' }]} />
        </div>
      )}
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Segmented value={mode} onChange={setMode}
            options={[{ value: 'all', label: `All games (${all.length})` }, ...modes.map((m) => ({ value: m, label: `${m} (${counts[m] || 0})` }))]} />
        </div>

        {list.length > 0 && (
          <div className="history-stats">
            <div><b>{list.length}</b><span>attempts</span></div>
            <div><b>{Math.max(...scores)}</b><span>best score</span></div>
            <div><b>{fmt(scores.reduce((a, b) => a + b, 0) / scores.length, 0)}</b><span>average score</span></div>
            <div><b>{fmt(list.reduce((a, r) => a + r.Accuracy, 0) / list.length, 0)}%</b><span>average accuracy</span></div>
            <div><b>{list[0].Score}</b><span>latest score</span></div>
          </div>
        )}
        {mode !== 'all' && list.length > 1 && (
          <div className="mt-sm">
            <LineChart height={130} x={['oldest', 'latest']} title={`${mode} score per attempt`} yMin={0}
              series={[{ values: list.map((r) => r.Score).reverse(), color: 'var(--accent)' }]} />
          </div>
        )}

        {list.length ? (
          <div className="table-scroll mt-sm">
            <table className="data">
              <thead><tr><th>#</th><th>Date</th>{whose === 'class' && <th>Student</th>}{mode === 'all' && <th>Game</th>}<th>Score</th><th>Accuracy</th><th>Best streak</th></tr></thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={`${r.Date}|${r.ProfileId}|${r.Name}|${r.Score}|${i}`} className={r.Score === Math.max(...scores) ? 'best' : ''}>
                    <td className="faint">{list.length - i}</td>
                    <td className="small">{r.Date}</td>
                    {whose === 'class' && <td>{r.Name}{r.Roll ? <span className="faint"> · {r.Roll}</span> : null}{r.ProfileId && r.ProfileId === profileId && <span className="badge" style={{ marginLeft: 8 }}>you</span>}</td>}
                    {mode === 'all' && <td>{r.Mode}</td>}
                    <td><b>{r.Score}</b></td>
                    <td>{fmt(r.Accuracy, 1)}%</td>
                    <td>{r.BestStreak || <span className="faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : rows && (
          <p className="muted">
            No {mode === 'all' ? '' : `${mode} `}attempts {whose === 'mine' ? 'of yours ' : ''}yet.{' '}
            {game ? <>Play <a href={`#quiz?game=${game}`}>{mode}</a></> : <>Play a game in the <a href="#quiz">Arcade</a></>} with
            “Post my score to the leaderboard” ticked and every attempt appears here.
          </p>
        )}
      </Card>
    </Page>
  )
}
