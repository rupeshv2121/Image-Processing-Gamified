import { useEffect, useRef, useState } from 'react'
import { asArray } from '../api'

// Shared pieces of the live quiz (student page and the teacher's projector
// screen). MATLAB (liveQuizManager.m) keeps the clock and scores; the browser
// only counts down between two polls and shows what MATLAB sent.

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
export const fmtTime = (t) => (t == null || Number.isNaN(t) ? '—' : `${Number(t).toFixed(2)} s`)
export const fmtCode = (c) => (c ? `${c.slice(0, 3)} ${c.slice(3)}` : '')
export const BOARD_SIZES = [{ value: 'top5', label: 'Top 5' }, { value: 'top10', label: 'Top 10' }, { value: 'all', label: 'All' }]
export const boardLimit = (size) => (size === 'top5' ? 5 : size === 'top10' ? 10 : Infinity)

// Seconds left on the open question. MATLAB sends remainingMs with every poll
// (stamp changes each time) and the countdown is re-based on it, so a wrong
// clock on the student's device never matters.
export function useCountdown(remainingMs, stamp) {
  const deadline = useRef(0)
  const [left, setLeft] = useState((remainingMs || 0) / 1000)
  useEffect(() => {
    deadline.current = performance.now() + (remainingMs || 0)
    setLeft((remainingMs || 0) / 1000)
    if (!remainingMs) return undefined
    const t = setInterval(() => {
      const l = Math.max(0, (deadline.current - performance.now()) / 1000)
      setLeft(l)
      if (l <= 0) clearInterval(t)
    }, 100)
    return () => clearInterval(t)
  }, [remainingMs, stamp])
  return left
}

export function TimerRing({ left, total, size = 96 }) {
  const r = 42
  const c = 2 * Math.PI * r
  const frac = total ? Math.max(0, Math.min(1, left / total)) : 0
  const low = left <= Math.min(5, total * 0.25)
  return (
    <div className={`live-timer ${low && left > 0 ? 'low' : ''}`} style={{ width: size, height: size, fontSize: size * 0.34 }} role="timer" aria-label={`${Math.ceil(left)} seconds left`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="track" />
        <circle cx="50" cy="50" r={r} className="bar" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <span>{Math.ceil(left)}</span>
    </div>
  )
}

// The answer tiles. mode: 'answer' (clickable), 'show' (projector, no answer),
// 'reveal' (correct answer marked, optional answer counts as bars)
export function OptionGrid({ options, mode = 'show', answer, selected, pending, counts, onPick, disabled, big }) {
  const opts = asArray(options)
  const cnt = asArray(counts)
  const total = cnt.reduce((a, b) => a + b, 0)
  return (
    <div className={`live-options ${big ? 'big' : ''} n${opts.length}`}>
      {opts.map((o, i) => {
        const n = i + 1
        const isAnswer = mode === 'reveal' && n === answer
        const dim = mode === 'reveal' && n !== answer
        const mine = selected === n || pending === n
        const cls = ['live-opt', `c${i}`, isAnswer && 'correct', dim && 'dim', mine && 'mine', mode === 'answer' && 'pickable'].filter(Boolean).join(' ')
        const body = (
          <>
            <span className="letter">{LETTERS[i]}</span>
            <span className="text">{o}</span>
            {isAnswer && <span className="tick" aria-label="correct answer">✓</span>}
            {mode === 'reveal' && cnt.length > 0 && (
              <span className="count">{cnt[i] ?? 0}<i style={{ width: `${total ? ((cnt[i] ?? 0) / total) * 100 : 0}%` }} /></span>
            )}
          </>
        )
        return mode === 'answer' ? (
          <button key={i} className={cls} disabled={disabled} onClick={() => onPick(n)} aria-pressed={mine}>{body}</button>
        ) : <div key={i} className={cls}>{body}</div>
      })}
    </div>
  )
}

function Move({ move }) {
  if (!move) return <span className="move same" aria-label="no change">–</span>
  return move > 0
    ? <span className="move up" aria-label={`up ${move}`}>▲{move}</span>
    : <span className="move down" aria-label={`down ${-move}`}>▼{-move}</span>
}

// Ranked class: points, correct answers and answer times
export function LeaderboardTable({ rows, limit = Infinity, me, showLast = true, showMove = true, compact }) {
  const list = asArray(rows)
  const shown = list.slice(0, limit)
  const mine = me && !shown.some((r) => r.id === me) ? list.find((r) => r.id === me) : null
  const row = (r) => {
    const last = r.last || {}
    return (
      <tr key={r.id} className={r.id === me ? 'me' : ''}>
        <td className="rank">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</td>
        <td><b>{r.name}</b>{r.roll ? <span className="tiny faint"> · {r.roll}</span> : null}</td>
        <td className="num"><b>{r.score}</b></td>
        <td className="num">{r.correct}/{r.answered}</td>
        <td className="num">{fmtTime(r.avgTime)}</td>
        {showLast && <td className="num">{last.choice ? <>{last.correct ? <span className="ok-text">+{last.points}</span> : <span className="faint">0</span>} <span className="tiny faint">{fmtTime(last.time)}</span></> : <span className="faint">—</span>}</td>}
        {showMove && <td className="num"><Move move={r.move} /></td>}
      </tr>
    )
  }
  if (!list.length) return <p className="muted small">Nobody has joined yet.</p>
  return (
    <div className="table-scroll">
      <table className={`data live-board ${compact ? 'compact' : ''}`}>
        <thead><tr><th>#</th><th>Student</th><th className="num">Points</th><th className="num">Correct</th><th className="num">Avg time</th>{showLast && <th className="num">Last question</th>}{showMove && <th className="num">Move</th>}</tr></thead>
        <tbody>
          {shown.map(row)}
          {mine && <><tr className="gap"><td colSpan={7}>⋯</td></tr>{row(mine)}</>}
        </tbody>
      </table>
    </div>
  )
}

// Every answer to one question, fastest first
export function AnswerTimes({ rows, limit = Infinity }) {
  const list = asArray(rows)
  if (!list.length) return <p className="muted small">Nobody answered this question.</p>
  return (
    <div className="table-scroll">
      <table className="data compact live-times">
        <thead><tr><th>#</th><th>Student</th><th>Answer</th><th className="num">Time</th><th className="num">Points</th></tr></thead>
        <tbody>
          {list.slice(0, limit).map((r, i) => (
            <tr key={r.id}>
              <td>{i + 1}</td>
              <td><b>{r.name}</b>{r.roll ? <span className="tiny faint"> · {r.roll}</span> : null}</td>
              <td><span className={`badge ${r.correct ? '' : 'badge-locked'}`}>{LETTERS[r.choice - 1]} {r.correct ? '✓' : '✗'}</span></td>
              <td className="num">{fmtTime(r.time)}</td>
              <td className="num">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length > limit && <p className="tiny faint mt-sm">+ {list.length - limit} more answers</p>}
    </div>
  )
}

// The rules the teacher chose, in words
export function RulesList({ settings: s = {}, qCount }) {
  return (
    <ul className="live-rules">
      <li><b>{qCount}</b> question{qCount === 1 ? '' : 's'}, about <b>{s.timeLimit} s</b> each (the timer is on screen)</li>
      <li>One answer per question — it cannot be changed</li>
      <li>{s.speedPoints ? <>Correct answers earn <b>500–1000 points</b>: the faster, the more</> : <>Every correct answer earns <b>1000 points</b></>}</li>
      <li>Ties are decided by the total answer time</li>
      {s.showLeaderboard && <li>The leaderboard is shown after every question</li>}
    </ul>
  )
}

export function Podium({ rows }) {
  const top = asArray(rows).slice(0, 3)
  if (!top.length) return null
  const slot = (r, cls) => r && (
    <div className={cls}>
      <div className="medal" aria-hidden="true">{{ p1: '🥇', p2: '🥈', p3: '🥉' }[cls]}</div>
      <b>{r.name}</b>
      <span>{r.score} pts · {r.correct}/{r.answered} · {fmtTime(r.avgTime)}</span>
    </div>
  )
  return (
    <div className="podium live-podium">
      {slot(top[1], 'p2') || <i />}
      {slot(top[0], 'p1')}
      {slot(top[2], 'p3') || <i />}
    </div>
  )
}
