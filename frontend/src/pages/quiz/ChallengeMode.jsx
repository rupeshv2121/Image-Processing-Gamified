import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../AppContext'
import { fmt, fmtPsnr } from '../../api'
import { Card, ImageView, Metrics, NeedImage, Note, Segmented } from '../../components/ui'
import { PlayerFields } from '../QuizHub'
import { BLOCKS } from './PipelineGame'

const label = (k) => BLOCKS.find((b) => b.key === k)?.label || k

export default function ChallengeMode() {
  const { current, call, notify } = useApp()
  const [level, setLevel] = useState('medium')
  const [ch, setCh] = useState(null)
  const [steps, setSteps] = useState([])
  const [block, setBlock] = useState('median')
  const [k, setK] = useState(3)
  const [left, setLeft] = useState(0)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [name, setName] = useState('')
  const [roll, setRoll] = useState('')
  const startTime = useRef(0)

  useEffect(() => {
    if (!ch || result) return
    const t = setInterval(() => {
      const l = Math.max(0, ch.timeLimit - (Date.now() - startTime.current) / 1000)
      setLeft(l)
      if (l <= 0) clearInterval(t)
    }, 200)
    return () => clearInterval(t)
  }, [ch, result])

  useEffect(() => {
    if (ch && !result && left <= 0 && startTime.current) submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  const begin = async () => {
    const d = await call('challengeStart', { id: current, level }, { label: 'Preparing the challenge' })
    if (d) {
      setCh(d)
      setSteps([])
      setPreview(null)
      setResult(null)
      startTime.current = Date.now()
      setLeft(d.timeLimit)
    }
  }
  const stepParams = () => steps.map((s) => ({ block: s.block, k: s.k, sigma: 1, amount: 1, gamma: 0.6 }))
  const tryIt = async () => {
    const d = await call('challengeScore', { cleanId: ch.cleanId, degradedId: ch.degradedId, steps: stepParams(), timeUsed: 0, timeLimit: ch.timeLimit }, { label: 'Preview' })
    if (d) setPreview(d.id)
  }
  const submit = async () => {
    if (!ch || result) return
    const used = Math.min(ch.timeLimit, (Date.now() - startTime.current) / 1000)
    const d = await call('challengeScore', { cleanId: ch.cleanId, degradedId: ch.degradedId, steps: stepParams(), timeUsed: used, timeLimit: ch.timeLimit }, { label: 'Scoring' })
    if (d) {
      setResult({ ...d, used })
      if (name.trim()) {
        await call('leaderboard', { action: 'add', entry: { name, roll, score: d.score, accuracy: Math.max(0, Math.min(100, d.after.ssim * 100)), bestStreak: 0, mode: `Challenge (${level})` } }, { label: 'Saving score' })
        notify('Score saved to the leaderboard')
      }
    }
  }

  return (
    <NeedImage>
      {!ch || result ? (
        <Card title="Timed image restoration challenge">
          <PlayerFields name={name} roll={roll} setName={setName} setRoll={setRoll} />
          <div className="row" style={{ marginTop: 12 }}>
            <Segmented value={level} onChange={setLevel} options={[{ value: 'easy', label: 'Easy (90 s)' }, { value: 'medium', label: 'Medium (60 s)' }, { value: 'hard', label: 'Hard (60 s)' }]} />
            <button className="btn btn-primary" onClick={begin}>{result ? 'Play again' : 'Start challenge'}</button>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>Score = 40 × PSNR gain (dB) + 600 × SSIM gain + time bonus (up to 200, only if the image improved).</p>
          {result && (
            <div style={{ marginTop: 14 }}>
              <div className="big-score">{result.score}</div>
              <Metrics items={[
                { label: 'PSNR before → after', value: `${fmt(result.before.psnr, 2)} → ${fmt(result.after.psnr, 2)}` },
                { label: 'SSIM before → after', value: `${fmt(result.before.ssim, 3)} → ${fmt(result.after.ssim, 3)}` },
                { label: 'Time used', value: `${fmt(result.used, 1)} s` },
                { label: 'Time bonus', value: result.timeBonus },
                { label: 'MATLAB processing', value: `${fmt(result.processingMs, 0)} ms` },
              ]} />
              <div className="grid-3" style={{ marginTop: 12 }}>
                <ImageView id={ch.degradedId} title="Degraded" height={220} />
                <ImageView id={result.id} title="Your result" height={220} />
                <ImageView id={ch.cleanId} title="Original" height={220} />
              </div>
            </div>
          )}
        </Card>
      ) : (
        <div className="lab">
          <Card title={`⏱ ${Math.ceil(left)} s left`}>
            <div className={`progressbar ${left / ch.timeLimit < 0.25 ? 'danger' : left / ch.timeLimit < 0.5 ? 'warn' : ''}`} style={{ marginBottom: 12 }}>
              <div style={{ width: `${(left / ch.timeLimit) * 100}%`, transition: 'none' }} />
            </div>
            <div className="controls">
              <p className="small">{ch.description}</p>
              <label className="field"><span className="field-label">Block</span>
                <select value={block} onChange={(e) => setBlock(e.target.value)}>{BLOCKS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}</select>
              </label>
              <label className="field"><span className="field-label">Kernel size</span>
                <select value={k} onChange={(e) => setK(Number(e.target.value))}>{[3, 5, 7].map((v) => <option key={v} value={v}>{v}×{v}</option>)}</select>
              </label>
              <button className="btn" onClick={() => setSteps((s) => [...s, { block, k }])}>+ Add step</button>
              <div className="pipeline">
                {steps.length ? steps.map((s, i) => (
                  <button key={i} className="block" onClick={() => setSteps((st) => st.filter((_, j) => j !== i))}>{label(s.block)} {s.k}×{s.k} ✕</button>
                )) : <span className="muted small">No steps yet</span>}
              </div>
              <div className="row">
                <button className="btn" onClick={tryIt} disabled={!steps.length}>Preview</button>
                <button className="btn btn-primary" onClick={submit} disabled={!steps.length}>Submit</button>
              </div>
            </div>
          </Card>
          <div className="stack">
            <div className="grid-2">
              <ImageView id={ch.degradedId} title={`Degraded — PSNR ${fmtPsnr(ch.psnr)}`} height={360} />
              <ImageView id={preview} title="Preview of your pipeline" height={360} />
            </div>
            <Note>Hint: impulses → median; grainy noise → Gaussian; dull → CLAHE / stretch; blur → unsharp mask (but only after denoising!).</Note>
          </div>
        </div>
      )}
    </NeedImage>
  )
}
