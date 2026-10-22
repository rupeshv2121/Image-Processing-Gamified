import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../AppContext'
import { asArray, run } from '../../api'
import Icon from '../../components/Icon'
import { AnswerTimes, BOARD_SIZES, LeaderboardTable, OptionGrid, Podium, RulesList, TimerRing, boardLimit, fmtCode, useCountdown } from '../../components/LiveParts'
import { Card, Modal, Note, Page, Segmented, Tabs } from '../../components/ui'
import LiveBuilder, { SavedSets, toDraft, toQuiz, useDraft } from './LiveBuilder'
import LiveResults, { ExportButtons, QuestionStats } from './LiveResults'

// Teacher: build a live quiz, open it with a join code and run it from the
// projector. All state, timing and scoring is in the backend (services/live_quiz.py);
// this page polls it every second while a quiz is open.

export default function LiveHost() {
  const { matlab, setAlertMsg } = useApp()
  const [host, setHost] = useState(null)
  const [stamp, setStamp] = useState(0)
  const [tab, setTab] = useState('build')
  const [draft, setDraft] = useDraft()
  const [opening, setOpening] = useState(false)
  const latest = useRef(null)

  const apply = useCallback((d) => { latest.current = d; setHost(d); setStamp((s) => s + 1) }, [])
  const poll = useCallback(() => run('live', { action: 'host' }).then(apply).catch(() => {}), [apply])

  useEffect(() => {
    if (!matlab.ok) return undefined
    let stop = false
    let timer
    const loop = async () => {
      await poll()
      const h = latest.current
      // Fast while a quiz runs; nothing changes in a finished one
      if (!stop && h?.active && h.phase !== 'finished') timer = setTimeout(loop, 1000)
    }
    loop()
    return () => { stop = true; clearTimeout(timer) }
  }, [matlab.ok, poll, host?.active, host?.phase === 'finished']) // eslint-disable-line react-hooks/exhaustive-deps

  // Teacher actions. qIndex tells MATLAB which question this screen showed, so a
  // double click (or two open tabs) never skips a question.
  const act = useCallback(async (action, extra = {}) => {
    try {
      apply(await run('live', { action, qIndex: latest.current?.qIndex, ...extra }))
    } catch (err) {
      setAlertMsg({ title: 'MATLAB says', text: err.message })
    }
  }, [apply, setAlertMsg])

  const open = async (quiz) => {
    setOpening(true)
    try {
      apply(await run('live', { action: 'create', quiz }))
    } catch (err) {
      setAlertMsg({ title: 'Cannot open the quiz', text: err.message })
    } finally {
      setOpening(false)
    }
  }

  if (!host) return <Page eyebrow="Teacher" title="Live quiz"><p className="muted"><span className="spinner dark" /> Loading…</p></Page>
  if (host.active) return <HostScreen host={host} stamp={stamp} act={act} lan={asArray(matlab.lan)} />

  return (
    <Page eyebrow="Teacher" title="Live quiz"
      subtitle="Students join with a code on their own devices, every question has a timer, and MATLAB measures each answer time for the live leaderboard.">
      {!asArray(matlab.lan).length && (
        <Note kind="warn">
          <b>Students’ devices cannot reach Spatia yet.</b> It is running for this computer only. To let phones and laptops on the same
          Wi-Fi join, close the ImageLab server window and start <code>start_imagelab_lan.bat</code> (or type <code>ImageLab('lan')</code> in MATLAB).
          Other devices can then only sign in and play the live quiz.
        </Note>
      )}
      <Tabs tabs={[{ key: 'build', label: 'New quiz' }, { key: 'saved', label: 'Saved quizzes' }, { key: 'results', label: 'Past results' }]} active={tab} onChange={setTab} />
      <div className="mt-sm">
        {tab === 'build' && <LiveBuilder draft={draft} setDraft={setDraft} opening={opening} onOpen={() => open(toQuiz(draft))} />}
        {tab === 'saved' && <SavedSets onLoad={(s) => { setDraft(toDraft(s)); setTab('build') }} onStart={(s) => open(toQuiz(toDraft(s)))} />}
        {tab === 'results' && <LiveResults />}
      </div>
    </Page>
  )
}

const PHASES = { lobby: 'Waiting for students', question: 'Question open', reveal: 'Answer', finished: 'Final results' }

function HostScreen({ host, stamp, act, lan }) {
  const stage = useRef(null)
  const [full, setFull] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [board, setBoard] = useState(host.settings.leaderboard)
  const [times, setTimes] = useState(host.settings.leaderboard)
  const players = asArray(host.players)
  const last = host.qIndex >= host.qCount

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === stage.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else stage.current?.requestFullscreen?.().catch(() => {})
  }

  // Space / Enter = the main button (start, reveal, next)
  const primary = { lobby: () => act('start'), question: () => act('reveal'), reveal: () => act('next') }[host.phase]
  useEffect(() => {
    const onKey = (e) => {
      if (confirm || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) return
      if ((e.key === ' ' || e.key === 'Enter') && primary) { e.preventDefault(); primary() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={`live-host ${full ? 'is-full' : ''}`} ref={stage}>
      <div className="live-hbar">
        <div className="grow">
          <div className="eyebrow">Live quiz · {PHASES[host.phase]}</div>
          <h2>{host.title}</h2>
        </div>
        <span className="pill live-codepill" title="Join code">Code <b>{fmtCode(host.code)}</b></span>
        <span className="pill"><Icon name="users" size={14} /> <b>{host.online}</b> online · {players.length} joined</span>
        {host.qIndex > 0 && <span className="pill">Question <b>{host.qIndex}</b> / {host.qCount}</span>}
        {host.phase === 'lobby' && <button className="btn btn-primary btn-lg" onClick={() => act('start')} disabled={!host.qCount}><Icon name="play" size={16} /> Start quiz</button>}
        {host.phase === 'question' && <button className="btn btn-navy" onClick={() => act('reveal')}>Reveal answer now</button>}
        {host.phase === 'reveal' && <button className="btn btn-primary btn-lg" onClick={() => act('next')}>{last ? 'Show final results' : 'Next question'} <Icon name="arrow" size={16} /></button>}
        {host.phase !== 'finished' && <button className="btn btn-ghost" onClick={() => setConfirm('finish')}>End quiz</button>}
        {host.phase === 'finished' && <button className="btn" onClick={() => act('close')}>Close & build another</button>}
        <button className="icon-btn" onClick={toggleFull} aria-label={full ? 'Leave full screen' : 'Full screen for the projector'} title="Full screen (projector)"><Icon name={full ? 'close' : 'fit'} /></button>
      </div>

      {host.phase === 'lobby' && <HostLobby host={host} players={players} lan={lan} onKick={(p) => setConfirm({ kick: p })} />}
      {host.phase === 'question' && <HostQuestion host={host} stamp={stamp} players={players} />}
      {host.phase === 'reveal' && (
        <div className="stack">
          <HostReveal host={host} />
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <Card title="Answer times" extra={<Segmented value={times} onChange={setTimes} options={BOARD_SIZES} />}>
              <AnswerTimes rows={host.answerTimes} limit={boardLimit(times)} />
            </Card>
            <Card title="Leaderboard" extra={<Segmented value={board} onChange={setBoard} options={BOARD_SIZES} />}>
              <LeaderboardTable rows={host.leaderboard} limit={boardLimit(board)} compact />
            </Card>
          </div>
        </div>
      )}
      {host.phase === 'finished' && (
        <div className="stack">
          <Podium rows={host.leaderboard} />
          <Card title="Final leaderboard" extra={<Segmented value={board} onChange={setBoard} options={BOARD_SIZES} />}>
            <LeaderboardTable rows={host.leaderboard} limit={boardLimit(board)} showLast={false} showMove={false} />
          </Card>
          <Card title="Questions" extra={<span className="small faint">Saved in Past results · recorded in every student’s progress</span>}>
            <QuestionStats rows={host.questionStats} />
            <div className="mt"><ExportButtons /></div>
          </Card>
        </div>
      )}

      {confirm === 'finish' && (
        <Modal title="End the quiz now?" onClose={() => setConfirm(null)}>
          <p>The questions answered so far are scored and saved; the rest are skipped.</p>
          <div className="row right mt">
            <button className="btn" onClick={() => setConfirm(null)}>Keep going</button>
            <button className="btn btn-primary" onClick={() => { setConfirm(null); act('finish') }}>End & show results</button>
          </div>
        </Modal>
      )}
      {confirm?.kick && (
        <Modal title={`Remove ${confirm.kick.name}?`} onClose={() => setConfirm(null)}>
          <p>{confirm.kick.name} leaves the quiz and cannot join this session again.</p>
          <div className="row right mt">
            <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => { act('kick', { id: confirm.kick.id }); setConfirm(null) }}>Remove</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function HostLobby({ host, players, lan, onKick }) {
  const addr = lan[0] ? lan[0].replace(/^https?:\/\//, '') : null
  return (
    <div className="stack">
      <div className="live-joinpanel">
        <div>
          <div className="live-joinlabel">Join on your phone or laptop</div>
          {addr ? <div className="live-url">{addr}<span>/#live</span></div> : <div className="live-url muted">Spatia → Live quiz</div>}
          <div className="live-joinlabel mt-sm">and enter the code</div>
          <div className="live-code" aria-label={`Code ${host.code.split('').join(' ')}`}>{fmtCode(host.code)}</div>
          {lan.length > 1 && <div className="tiny faint">Also reachable at {lan.slice(1).map((u) => u.replace(/^https?:\/\//, '')).join(', ')}</div>}
          {!addr && <Note kind="warn">This server only accepts this computer. Restart it with <code>start_imagelab_lan.bat</code> so students’ devices can join.</Note>}
        </div>
        <div className="live-lobbyinfo">
          <h3>Instructions</h3>
          {host.instructions ? <p className="live-instructions">{host.instructions}</p> : <p className="muted small">No extra instructions.</p>}
          <RulesList settings={host.settings} qCount={host.qCount} />
        </div>
      </div>
      <Card title={`Students (${players.length})`} extra={<span className="small faint">Press Space or Start when everybody is in</span>}>
        {players.length === 0 ? <p className="muted">Waiting for the first student to join…</p> : (
          <div className="live-players">
            {players.map((p) => (
              <span key={p.id} className={`live-player ${p.online ? '' : 'off'}`}>
                {p.name}
                <button className="icon-btn" onClick={() => onKick(p)} aria-label={`Remove ${p.name}`}><Icon name="close" size={12} /></button>
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function HostQuestion({ host, stamp, players }) {
  const q = host.question
  const left = useCountdown(host.remainingMs, stamp)
  const expected = Math.max(host.online, host.answered, 1)
  return (
    <div className="stack">
      <div className="card live-stage">
        <div className="live-qhead">
          <span className="badge badge-navy">{q.category}</span>
          <span className="badge">{q.difficulty}</span>
          <span className="spacer" />
          <TimerRing left={left} total={q.timeLimit} size={120} />
        </div>
        <div className="live-question big">{q.question}</div>
        <OptionGrid options={q.options} mode="show" big />
        <div className="live-answered">
          <div className="progressbar"><div style={{ width: `${Math.min(100, (host.answered / expected) * 100)}%` }} /></div>
          <span><b>{host.answered}</b> / {expected} answered</span>
        </div>
      </div>
      <div className="live-players">
        {players.map((p) => <span key={p.id} className={`live-player ${p.answered ? 'done' : ''} ${p.online ? '' : 'off'}`}>{p.answered ? '✓ ' : ''}{p.name}</span>)}
      </div>
    </div>
  )
}

function HostReveal({ host }) {
  const q = host.question
  const counts = asArray(host.distribution)
  const right = counts[q.answer - 1] || 0
  const total = counts.reduce((a, b) => a + b, 0)
  return (
    <div className="card live-stage">
      <div className="live-qhead">
        <span className="badge badge-navy">{q.category}</span>
        <span className="spacer" />
        <span className="pill"><b>{right}</b> of {total} correct{total ? ` (${Math.round((right / total) * 100)}%)` : ''}</span>
      </div>
      <div className="live-question">{q.question}</div>
      <OptionGrid options={q.options} mode="reveal" answer={q.answer} counts={counts} big />
      {q.explanation && <Note>{q.explanation}</Note>}
    </div>
  )
}
