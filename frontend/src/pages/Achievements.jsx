import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import Ring from '../components/Ring'
import { Card, Modal, Page, Tabs } from '../components/ui'
import { MEDALS } from '../content/missions'

export default function Achievements() {
  const { progress, refreshProgress, call, matlab, notify } = useApp()
  const [tab, setTab] = useState('badges')
  const [confirm, setConfirm] = useState(false)
  useEffect(() => { if (matlab.ok) refreshProgress() }, [matlab.ok, refreshProgress])

  const p = progress || {}
  const xp = p.xp || 0
  const level = p.level || 1
  const lo = (level - 1) ** 2 * 100
  const hi = level ** 2 * 100
  const badges = asArray(p.badges)
  const earned = badges.filter((b) => b.earned).length
  const cats = asArray(p.categoryStats)
  const history = asArray(p.quizHistory).slice().reverse()

  const reset = async () => {
    const d = await call('progress', { action: 'reset' }, { label: 'Resetting progress' })
    if (d) {
      await refreshProgress()
      notify('Progress reset')
    }
    setConfirm(false)
  }

  return (
    <Page eyebrow="Your progress" title="Achievements" subtitle="XP, levels and badges are stored by MATLAB in data/userProgress.mat."
      actions={<button className="btn btn-ghost btn-danger" onClick={() => setConfirm(true)}>Reset progress…</button>}>
      <div className="grid-3" style={{ marginBottom: 28 }}>
        <Card>
          <div className="row" style={{ gap: 22 }}>
            <Ring value={(xp - lo) / (hi - lo)} size={110} label={level} sub="level" />
            <div>
              <h2>{xp} XP</h2>
              <p className="small muted">{hi - xp} XP to level {level + 1}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="row" style={{ gap: 22 }}>
            <Ring value={badges.length ? earned / badges.length : 0} size={110} color="var(--amber-500)" label={earned} sub={`of ${badges.length}`} />
            <div><h2>Badges</h2><p className="small muted">Earn them by exploring every lab.</p></div>
          </div>
        </Card>
        <Card>
          <div className="row" style={{ gap: 22 }}>
            <Ring value={(p.accuracy || 0) / 100} size={110} color="var(--navy-600)" label={`${Math.round(p.accuracy || 0)}%`} sub="accuracy" />
            <div><h2>{p.questionsAnswered || 0}</h2><p className="small muted">questions answered · best streak {p.bestStreak || 0}</p></div>
          </div>
        </Card>
      </div>

      <Tabs tabs={[{ key: 'badges', label: 'Badges' }, { key: 'topics', label: 'Strengths' }, { key: 'history', label: 'Quiz history' }, { key: 'xp', label: 'How to earn XP' }]} active={tab} onChange={setTab} />

      {tab === 'badges' && (
        <div className="badges">
          {badges.map((b) => (
            <div key={b.id} className={`badge-card ${b.earned ? 'earned' : ''}`}>
              <div className="medal">{MEDALS[b.id] || '🏅'}</div>
              <b>{b.name}</b>
              {b.description}
            </div>
          ))}
        </div>
      )}

      {tab === 'topics' && (
        <Card>
          {cats.length ? (
            <table className="data">
              <thead><tr><th>Category</th><th>Answered</th><th>Accuracy</th><th style={{ width: '40%' }} /></tr></thead>
              <tbody>
                {cats.map((c) => {
                  const acc = c.answered ? (100 * c.correct) / c.answered : 0
                  return (
                    <tr key={c.name}>
                      <td><b>{c.name}</b></td><td>{c.answered}</td><td>{fmt(acc, 0)}%</td>
                      <td><div className={`progressbar ${acc < 60 ? 'danger' : acc < 80 ? 'warn' : ''}`}><div style={{ width: `${acc}%` }} /></div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : <p className="muted">Play a quiz to see your strong and weak topics.</p>}
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          {history.length ? (
            <table className="data">
              <thead><tr><th>Date</th><th>Mode</th><th>Score</th><th>Accuracy</th></tr></thead>
              <tbody>{history.map((h, i) => <tr key={i}><td>{h.date}</td><td>{h.mode}</td><td><b>{h.score}</b></td><td>{fmt(h.accuracy, 0)}%</td></tr>)}</tbody>
            </table>
          ) : <p className="muted">No quizzes yet — <a href="#quiz">open the Arcade</a>.</p>}
        </Card>
      )}

      {tab === 'xp' && (
        <Card>
          <table className="data">
            <tbody>
              <tr><td>Trying something new (a filter, noise model, edge detector…)</td><td><b>+10 XP</b></td></tr>
              <tr><td>Completing a Learn topic</td><td><b>+20 XP</b></td></tr>
              <tr><td>Running an experiment</td><td><b>+50 XP</b></td></tr>
              <tr><td>Finishing a quiz</td><td><b>score ÷ 10</b></td></tr>
              <tr><td>Earning a badge</td><td><b>+100 XP</b></td></tr>
            </tbody>
          </table>
          <p className="small muted mt-sm">Level = ⌊√(XP / 100)⌋ + 1</p>
        </Card>
      )}

      {confirm && (
        <Modal title="Reset all progress?" onClose={() => setConfirm(false)}>
          <p className="alert-text">XP, badges, completed topics and experiments will be cleared. The leaderboard is not affected.</p>
          <div className="row right"><button className="btn" onClick={() => setConfirm(false)}>Cancel</button><button className="btn btn-primary" onClick={reset}>Reset</button></div>
        </Modal>
      )}
    </Page>
  )
}
