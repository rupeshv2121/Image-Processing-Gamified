import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../AppContext'
import { run } from '../api'
import Icon from '../components/Icon'
import { LETTERS, LeaderboardTable, OptionGrid, RulesList, TimerRing, boardLimit, fmtTime, useCountdown } from '../components/LiveParts'
import { Card, Note, Page } from '../components/ui'

// Student side of the live quiz: join with the code on the teacher's screen,
// then follow the teacher's pace. The backend (services/live_quiz.py) is polled
// every second; it measures the answer time and keeps the scores.
const codeFromHash = () => (window.location.hash.match(/[?&]code=(\d{6})/) || [])[1] || ''

export default function LiveQuiz() {
  const { matlab } = useApp()
  const [state, setState] = useState(null)
  const [stamp, setStamp] = useState(0)
  const [code, setCode] = useState(codeFromHash)
  const [error, setError] = useState(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const [pending, setPending] = useState(null)       // tapped answer, before MATLAB confirmed it
  const latest = useRef(null)

  const apply = useCallback((d) => {
    latest.current = d
    setState(d)
    setStamp((s) => s + 1)
    setOffline(false)
  }, [])

  const poll = useCallback(async () => {
    try {
      apply(await run('live', { action: 'state' }))
    } catch (err) {
      if (err.errorId !== 'ImageLab:auth') setOffline(true)
    }
  }, [apply])

  // Every second while in a quiz; every 3 s while waiting for one to open
  useEffect(() => {
    if (!matlab.ok) return undefined
    let stop = false
    let timer
    const loop = async () => {
      await poll()
      const s = latest.current
      if (!stop) timer = setTimeout(loop, !s?.joined ? 3000 : s.phase === 'finished' ? 5000 : 1000)
    }
    loop()
    return () => { stop = true; clearTimeout(timer) }
  }, [matlab.ok, poll])

  const phase = state?.joined ? state.phase : null
  const qIndex = state?.qIndex
  useEffect(() => { setPending(null); setError(null) }, [phase, qIndex])

  const join = async (e) => {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      apply(await run('live', { action: 'join', code: code.replace(/\D/g, '') }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const answer = async (choice) => {
    if (sending || state?.mine?.choice) return
    setPending(choice)
    setSending(true)
    try {
      apply(await run('live', { action: 'answer', qIndex: state.qIndex, choice }))
    } catch (err) {
      setError(err.message)
      setPending(null)
      poll()
    } finally {
      setSending(false)
    }
  }

  const leave = async () => {
    await run('live', { action: 'leave' }).catch(() => {})
    poll()
  }

  // Keyboard: 1-6 or A-F answer the open question
  useEffect(() => {
    if (phase !== 'question') return undefined
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return
      const n = '123456'.indexOf(e.key) + 1 || 'abcdef'.indexOf(e.key.toLowerCase()) + 1
      if (n >= 1 && n <= (state.question?.options?.length || 0)) answer(n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!matlab.ok) {
    return <Page eyebrow="Live quiz" title="Live quiz"><p className="muted"><span className="spinner dark" /> Connecting to Spatia…</p></Page>
  }

  if (!state?.joined) {
    return (
      <Page eyebrow="Live quiz" title="Join the live quiz" subtitle="Enter the 6-digit code shown on your teacher's screen.">
        <div className="live-joinbox">
          <form className="card live-joinform" onSubmit={join}>
            <label className="field">
              <span className="field-label">Quiz code</span>
              <input type="text" inputMode="numeric" autoComplete="off" className="live-codeinput" placeholder="123 456" maxLength={7}
                value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))} aria-label="Quiz code" autoFocus />
            </label>
            {error && <Note kind="error">{error}</Note>}
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={sending || code.replace(/\D/g, '').length !== 6}>
              <Icon name="play" size={16} /> Join
            </button>
            {state?.active && state.canJoin && <Note kind="ok">A live quiz is open: <b>{state.title}</b></Note>}
            {state?.active && !state.canJoin && <Note kind="warn">“{state.title}” is running, but joining is closed.</Note>}
            {state && !state.active && <p className="small muted">No live quiz is open right now — this page checks automatically.</p>}
            {offline && <p className="small faint">Reconnecting…</p>}
          </form>
        </div>
      </Page>
    )
  }

  return (
    <div className="page live-student">
      <div className="live-sbar">
        <div className="grow">
          <div className="eyebrow">Live quiz</div>
          <h2>{state.title}</h2>
        </div>
        {state.qIndex > 0 && <span className="pill">Question <b>{state.qIndex}</b> / {state.qCount}</span>}
        <span className="pill"><Icon name="star" size={14} /> <b>{state.me?.score ?? 0}</b> pts</span>
        {state.phase !== 'lobby' && state.me && <span className="pill">Rank <b>#{state.me.rank}</b> / {state.playerCount}</span>}
      </div>
      {offline && <Note kind="warn">Connection lost — reconnecting…</Note>}
      {state.phase === 'lobby' && <Lobby state={state} onLeave={leave} />}
      {state.phase === 'question' && <QuestionView state={state} stamp={stamp} pending={pending} sending={sending} error={error} onAnswer={answer} />}
      {state.phase === 'reveal' && <RevealView state={state} />}
      {state.phase === 'finished' && <FinalView state={state} />}
    </div>
  )
}

function Lobby({ state, onLeave }) {
  return (
    <div className="grid-2 live-lobby-s" style={{ alignItems: 'start' }}>
      <Card>
        <div className="live-waiting">
          <div className="live-dots" aria-hidden="true"><i /><i /><i /></div>
          <h3>You’re in, {state.name}!</h3>
          <p className="muted">Waiting for your teacher to start… {state.playerCount} student{state.playerCount === 1 ? '' : 's'} joined.</p>
        </div>
        <div className="row center mt-sm"><button className="btn btn-ghost btn-small" onClick={onLeave}>Leave</button></div>
      </Card>
      <Card title="Instructions">
        {state.instructions ? <p className="live-instructions">{state.instructions}</p> : <p className="muted small">Your teacher gave no extra instructions.</p>}
        <h4 className="mt-sm">Rules</h4>
        <RulesList settings={state.settings} qCount={state.qCount} />
      </Card>
    </div>
  )
}

function QuestionView({ state, stamp, pending, sending, error, onAnswer }) {
  const q = state.question
  const left = useCountdown(state.remainingMs, stamp)
  const mine = state.mine || {}
  const answered = mine.choice > 0
  return (
    <div className="live-qcard card">
      <div className="live-qhead">
        <span className="badge badge-navy">{q.category}</span>
        <span className="badge">{q.difficulty}</span>
        <span className="spacer" />
        <TimerRing left={left} total={q.timeLimit} size={76} />
      </div>
      <div className="live-question">{q.question}</div>
      <OptionGrid options={q.options} mode="answer" selected={mine.choice} pending={pending} onPick={onAnswer}
        disabled={answered || sending || left <= 0} />
      {error && <Note kind="error">{error}</Note>}
      {answered ? (
        <Note kind="ok"><b>Answer {LETTERS[mine.choice - 1]} locked in after {fmtTime(mine.time)}.</b> Waiting for the others…</Note>
      ) : left <= 0 ? <Note kind="warn">Time’s up!</Note> : <p className="small faint">Tap an answer (or press 1–{q.options.length}). You cannot change it.</p>}
    </div>
  )
}

function RevealView({ state }) {
  const q = state.question
  const mine = state.mine || {}
  const board = state.leaderboard
  return (
    <div className="stack">
      <div className={`live-result ${mine.correct ? 'ok' : mine.choice ? 'bad' : 'none'}`}>
        <span className="big">{mine.correct ? '✓' : mine.choice ? '✗' : '⏱'}</span>
        <div>
          <b>{mine.correct ? `Correct! +${mine.points} points` : mine.choice ? 'Not this time' : 'No answer'}</b>
          <div>{mine.choice ? `You answered ${LETTERS[mine.choice - 1]} in ${fmtTime(mine.time)}` : 'The time ran out.'} · You are <b>#{state.me?.rank}</b> with {state.me?.score} points</div>
        </div>
      </div>
      <Card>
        <div className="live-question small-q">{q.question}</div>
        <OptionGrid options={q.options} mode="reveal" answer={q.answer} selected={mine.choice} counts={state.distribution} />
        {q.explanation && <Note>{q.explanation}</Note>}
      </Card>
      {board && board.length > 0 && (
        <Card title="Leaderboard" extra={<span className="small faint">Waiting for the next question…</span>}>
          <LeaderboardTable rows={board} me={state.me?.id} limit={boardLimit(state.settings.leaderboard)} compact />
        </Card>
      )}
    </div>
  )
}

function FinalView({ state }) {
  const me = state.me || {}
  const board = state.leaderboard
  return (
    <div className="stack">
      <div className="card live-final">
        <div className="live-final-rank">{me.rank <= 3 ? ['🥇', '🥈', '🥉'][me.rank - 1] : `#${me.rank}`}</div>
        <h2>{me.rank === 1 ? 'You won!' : `You finished #${me.rank} of ${state.playerCount}`}</h2>
        <div className="stat-cards mt">
          <div className="stat"><div className="ic"><Icon name="star" /></div><div><div className="v">{me.score}</div><div className="l">points</div></div></div>
          <div className="stat"><div className="ic navy"><Icon name="check" /></div><div><div className="v">{me.correct}/{state.qIndex}</div><div className="l">correct</div></div></div>
          <div className="stat"><div className="ic amber"><Icon name="clock" /></div><div><div className="v">{fmtTime(me.avgTime)}</div><div className="l">average answer time</div></div></div>
        </div>
        <p className="small muted mt-sm">The quiz is saved in your progress (topic accuracy and XP).</p>
      </div>
      {board && board.length > 0 && (
        <Card title="Final leaderboard">
          <LeaderboardTable rows={board} me={me.id} limit={boardLimit(state.settings.leaderboard)} showLast={false} showMove={false} />
        </Card>
      )}
    </div>
  )
}
