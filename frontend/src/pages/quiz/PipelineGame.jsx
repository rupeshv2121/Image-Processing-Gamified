import { useEffect, useState } from 'react'
import { useApp } from '../../AppContext'
import { asArray, fmtPsnr } from '../../api'
import { Card, ImageView, NeedImage, Note } from '../../components/ui'
import { PlayerFields } from '../QuizHub'

export const BLOCKS = [
  { key: 'mean', label: 'Mean' }, { key: 'median', label: 'Median' }, { key: 'gaussian', label: 'Gaussian' },
  { key: 'min', label: 'Min' }, { key: 'max', label: 'Max' }, { key: 'laplacian', label: 'Laplacian sharpen' },
  { key: 'unsharp', label: 'Unsharp mask' }, { key: 'histeq', label: 'Histogram eq.' },
  { key: 'gamma', label: 'Gamma 0.6' }, { key: 'stretch', label: 'Contrast stretch' },
]
const label = (k) => BLOCKS.find((b) => b.key === k)?.label || k

// A session's score counts each problem once, with its best run (100 right, 40 partly right)
export default function PipelineGame() {
  const { current, call, profile, role, notify } = useApp()
  const [name, setName] = useState(() => profile?.name || '')
  const [best, setBest] = useState({})                // problem id -> {points, correct}
  const [problems, setProblems] = useState([])
  const [problem, setProblem] = useState(null)
  const [start, setStart] = useState(null)
  const [steps, setSteps] = useState([])
  const [res, setRes] = useState(null)

  useEffect(() => {
    call('pipelineProblems', {}, { quiet: true }).then((p) => p && setProblems(asArray(p)))
  }, [call])

  const choose = async (p) => {
    const d = await call('pipelineStart', { id: current, problemId: p.id, seed: 11 }, { label: 'Degrading the image' })
    if (d) {
      setProblem(p)
      setStart(d)
      setSteps([])
      setRes(null)
    }
  }
  const runIt = async () => {
    const d = await call('pipelineRun', { problemId: problem.id, cleanId: start.cleanId, degradedId: start.degradedId, steps }, { label: 'Running your pipeline' })
    if (d) {
      setRes(d)
      setBest((b) => ({ ...b, [problem.id]: { points: Math.max(b[problem.id]?.points || 0, d.points), correct: b[problem.id]?.correct || d.verdict === 'correct' } }))
    }
  }
  const resSteps = asArray(res?.steps)
  const tried = Object.values(best)
  const points = tried.reduce((t, b) => t + b.points, 0)
  const finish = async () => {
    if (name.trim() && role === 'student') {
      const solved = tried.filter((b) => b.correct).length
      const d = await call('leaderboard', { action: 'add', entry: { score: points, accuracy: (100 * solved) / tried.length, bestStreak: 0, mode: 'Build the Pipeline' } }, { label: 'Saving score' })
      if (d) notify('Score saved to the leaderboard')
    }
    setBest({})
    setProblem(null)
    setRes(null)
  }

  return (
    <NeedImage>
      <div className="lab">
        <Card title={`Problems · ${points} points`}>
          <PlayerFields name={name} setName={setName} />
          {tried.length > 0 && (
            <button className="btn btn-primary btn-block mt-sm" onClick={finish}>
              Finish · {tried.filter((b) => b.correct).length}/{tried.length} solved{name.trim() && role === 'student' ? ' · post score' : ''}
            </button>
          )}
          <div className="topic-list mt-sm">
            {problems.map((p) => (
              <button key={p.id} className={`topic-item ${problem?.id === p.id ? 'active' : ''}`} onClick={() => choose(p)}>{p.title}</button>
            ))}
          </div>
        </Card>
        {!problem ? (
          <Note>Pick a problem. MATLAB degrades the workspace image; you build the processing pipeline that repairs it.</Note>
        ) : (
          <div className="stack">
            <Card title={problem.title}>
              <p>{problem.description}</p>
              <p className="field-label" style={{ marginTop: 10 }}>Available blocks (click to add)</p>
              <div className="row">
                {BLOCKS.map((b) => <button key={b.key} className="block palette" onClick={() => { setSteps((s) => [...s, b.key]); setRes(null) }}>{b.label}</button>)}
              </div>
              <p className="field-label" style={{ marginTop: 12 }}>Your pipeline (click a block to remove it)</p>
              <div className="pipeline">
                <span className="muted small">Input</span>
                {steps.map((s, i) => (
                  <span key={i} className="row" style={{ gap: 8 }}>
                    <span className="arrow">→</span>
                    <button className="block" onClick={() => { setSteps((st) => st.filter((_, j) => j !== i)); setRes(null) }}>{label(s)} ✕</button>
                  </span>
                ))}
                <span className="arrow">→</span><span className="muted small">Output</span>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn btn-primary" disabled={!steps.length} onClick={runIt}>▶ Run pipeline in MATLAB</button>
                <button className="btn" onClick={() => { setSteps([]); setRes(null) }}>Clear</button>
              </div>
            </Card>
            <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))' }}>
              <ImageView id={start.degradedId} title="Degraded input" height={200} caption={`PSNR ${fmtPsnr(start.psnr)}`} />
              {resSteps.map((s, i) => (
                <ImageView key={s.id} id={s.id} title={`${i + 1}. ${label(s.block)}`} height={200} caption={`PSNR ${fmtPsnr(s.psnr)}`} />
              ))}
              {res && <ImageView id={start.cleanId} title="Target (clean original)" height={200} />}
            </div>
            {res && (
              <Note kind={res.verdict === 'correct' ? 'ok' : res.verdict === 'partial' ? 'warn' : 'error'}>
                <b>{res.feedback}</b> (+{res.points} points) — PSNR {fmtPsnr(res.before.psnr)} → {fmtPsnr(res.after.psnr)}.
                <div style={{ marginTop: 6 }}>Expected: <b>{asArray(res.expected).map(label).join(' → ')}</b>. {res.explanation}</div>
              </Note>
            )}
          </div>
        )}
      </div>
    </NeedImage>
  )
}
