import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import { Card, Modal, Page, Segmented } from '../components/ui'

export default function Leaderboard() {
  const { call, matlab } = useApp()
  const [rows, setRows] = useState([])
  const [mode, setMode] = useState('all')
  const [confirm, setConfirm] = useState(false)

  const load = async () => {
    const d = await call('leaderboard', { action: 'get' }, { label: 'Loading leaderboard.mat' })
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
    <Page eyebrow="Play" title="Leaderboard" subtitle="Top scores, stored by MATLAB in quizzes/leaderboard.mat."
      actions={<><button className="btn" onClick={load}>Refresh</button><button className="btn btn-danger" onClick={() => setConfirm(true)} disabled={!rows.length}>Clear…</button></>}>
      <Card>
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
      </Card>
      {confirm && (
        <Modal title="Clear the leaderboard?" onClose={() => setConfirm(false)}>
          <p>All {rows.length} entries in leaderboard.mat will be deleted. This cannot be undone.</p>
          <div className="row right"><button className="btn" onClick={() => setConfirm(false)}>Cancel</button><button className="btn btn-primary" onClick={clear}>Clear</button></div>
        </Modal>
      )}
    </Page>
  )
}
