import { useEffect, useState } from 'react'
import { useApp } from '../../AppContext'
import { asArray, fmt, fmtPsnr } from '../../api'
import ImagePair from '../../components/ImagePair'
import { Card, ImageView, Note } from '../../components/ui'
import { BLOCKS } from './PipelineGame'

const label = (k) => BLOCKS.find((b) => b.key === k)?.label || k
const pad = (n) => String(n).padStart(2, '0')
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// The last 14 days as dots: solved / tried / missed
function StreakStrip({ history }) {
  const byDate = Object.fromEntries(asArray(history).map((h) => [h.date, h]))
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return localDate(d)
  })
  return (
    <div className="streak-strip" aria-label="Last 14 days">
      {days.map((d) => {
        const h = byDate[d]
        const state = h?.solved ? 'solved' : h ? 'tried' : 'missed'
        return <span key={d} className={`day ${state}`} title={`${d}: ${state}${h ? ` · ${h.points} pts` : ''}`}>{Number(d.slice(8))}</span>
      })}
    </div>
  )
}

// One "match the target image" puzzle per day: the same date always gives
// the same image, degradation and noise (MATLAB seeds rng with the date).
export default function DailyChallenge() {
  const { call, refreshProgress, matlab } = useApp()
  const [day, setDay] = useState(null)
  const [steps, setSteps] = useState([])
  const [res, setRes] = useState(null)
  const date = localDate()

  useEffect(() => {
    if (!matlab.ok) return
    call('dailyStart', { date }, { label: "Preparing today's puzzle" }).then((d) => d && setDay(d))
  }, [call, date, matlab.ok])

  const runIt = async () => {
    const d = await call('pipelineRun', { problemId: day.problemId, cleanId: day.cleanId, degradedId: day.degradedId, steps, daily: date }, { label: 'Running your pipeline' })
    if (d) {
      setRes(d)
      const p = d.progress
      setDay((x) => ({ ...x, solved: x.solved || d.verdict === 'correct', bestPoints: Math.max(x.bestPoints, d.points), attempts: x.attempts + 1, streak: p?.dailyStreak ?? x.streak, history: p?.dailyHistory ?? x.history }))
      refreshProgress()
    }
  }

  if (!day) return <Card><p className="muted">MATLAB is preparing today’s puzzle…</p></Card>
  const out = asArray(res?.steps).at(-1)
  return (
    <div className="stack">
      <Card>
        <div className="daily-head">
          <div>
            <div className="eyebrow"><span>Daily challenge · {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
            <h2>{day.title}</h2>
            <p className="muted" style={{ marginTop: 6 }}>{day.description} Rebuild the <b>target</b> from the degraded <b>{day.sample}</b>.</p>
          </div>
          <div className="daily-stats">
            <div><b>{day.streak}</b><span>day streak 🔥</span></div>
            <div><b>{day.bestPoints}</b><span>best today</span></div>
            <div><b>{day.solved ? '✓' : '—'}</b><span>{day.solved ? 'solved' : 'not solved'}</span></div>
          </div>
        </div>
        <StreakStrip history={day.history} />
      </Card>

      <div className="grid-2">
        <ImageView id={day.degradedId} title="Degraded (your input)" height={300} caption={`PSNR ${fmtPsnr(day.psnr)} · SSIM ${fmt(day.ssim, 3)} vs target`} />
        <ImageView id={day.cleanId} title="Target" height={300} caption="Match this image as closely as you can" />
      </div>

      <Card title="Build your pipeline">
        <p className="field-label">Blocks (click to add)</p>
        <div className="row">
          {BLOCKS.map((b) => <button key={b.key} className="block palette" onClick={() => { setSteps((s) => [...s, b.key]); setRes(null) }}>{b.label}</button>)}
        </div>
        <p className="field-label" style={{ marginTop: 12 }}>Your pipeline (click a block to remove it)</p>
        <div className="pipeline">
          <span className="muted small">Input</span>
          {steps.map((s, i) => (
            <span key={i} className="row" style={{ gap: 8 }}>
              <span className="arrow">→</span>
              <button className="block" onClick={() => { setSteps((st) => st.filter((_, j) => j !== i)); setRes(null) }} aria-label={`Remove ${label(s)}`}>{label(s)} ✕</button>
            </span>
          ))}
          <span className="arrow">→</span><span className="muted small">Output</span>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" disabled={!steps.length} onClick={runIt}>▶ Run in MATLAB</button>
          <button className="btn" onClick={() => { setSteps([]); setRes(null) }}>Clear</button>
          <span className="small faint">Score: 100 for the right pipeline (40 if partly right) + 10 per dB of PSNR gained. +50 XP the first time you solve it today.</span>
        </div>
      </Card>

      {res && out && (
        <>
          <Note kind={res.verdict === 'correct' ? 'ok' : res.verdict === 'partial' ? 'warn' : 'error'}>
            <b>{res.feedback}</b> {res.points} points{res.psnrBonus && res.verdict !== 'wrong' ? ` (incl. +${res.psnrBonus} PSNR bonus)` : ''} — PSNR {fmtPsnr(res.before.psnr)} → {fmtPsnr(res.after.psnr)}, SSIM {fmt(res.before.ssim, 3)} → {fmt(res.after.ssim, 3)}.
            {res.verdict !== 'correct' && <div style={{ marginTop: 6 }}>Hint: think about which degradation you see first. {day.attempts >= 2 && <>The ideal pipeline is <b>{asArray(res.expected).map(label).join(' → ')}</b>. {res.explanation}</>}</div>}
            {res.verdict === 'correct' && <div style={{ marginTop: 6 }}>{res.explanation} Come back tomorrow to keep your streak!</div>}
          </Note>
          <ImagePair height={380} left={{ id: day.cleanId, title: 'Target' }} right={{ id: out.id, title: 'Your result', badge: fmtPsnr(out.psnr) }} />
        </>
      )}
    </div>
  )
}
