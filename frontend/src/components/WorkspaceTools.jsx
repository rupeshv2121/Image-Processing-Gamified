import { useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import Icon from './Icon'
import { Card, ImageView, Note, Select, Slider, Tabs } from './ui'

// Image operations on the workspace image, all run by MATLAB (api/handlers/workspaceOps.m):
//   Single operation - preview one operation, then apply it (undo / redo as usual)
//   Pipeline         - several operations in a row, with every intermediate image
//   Compare          - several operations side by side on the same image; keep the best
const odd = { min: 3, max: 15, step: 2 }
const NOISE = [{ value: 'gaussian', label: 'Gaussian' }, { value: 'saltpepper', label: 'Salt & pepper' },
  { value: 'rayleigh', label: 'Rayleigh' }, { value: 'erlang', label: 'Erlang (gamma)' },
  { value: 'exponential', label: 'Exponential' }, { value: 'uniform', label: 'Uniform' }]

export const OPERATIONS = [
  { group: 'Intensity', op: 'negative', label: 'Negative', fn: 'negativeTransform', params: [] },
  { group: 'Intensity', op: 'log', label: 'Log transform', fn: 'logTransform', params: [{ name: 'c', label: 'k (strength)', min: 1, max: 100, step: 1, value: 10 }] },
  { group: 'Intensity', op: 'gamma', label: 'Gamma (power law)', fn: 'gammaCorrection', params: [{ name: 'gamma', label: 'γ', min: 0.1, max: 3, step: 0.05, value: 0.5 }] },
  { group: 'Intensity', op: 'stretch', label: 'Contrast stretch', fn: 'contrastStretch', params: [] },
  { group: 'Intensity', op: 'piecewise', label: 'Piecewise linear', fn: 'piecewiseLinear', params: [
    { name: 'r1', label: 'r1', min: 0, max: 1, step: 0.05, value: 0.3 }, { name: 's1', label: 's1', min: 0, max: 1, step: 0.05, value: 0.1 },
    { name: 'r2', label: 'r2', min: 0, max: 1, step: 0.05, value: 0.7 }, { name: 's2', label: 's2', min: 0, max: 1, step: 0.05, value: 0.9 }] },
  { group: 'Intensity', op: 'slice', label: 'Grey-level slicing', fn: 'grayLevelSlicing', params: [
    { name: 'a', label: 'From', min: 0, max: 1, step: 0.05, value: 0.4 }, { name: 'b', label: 'To', min: 0, max: 1, step: 0.05, value: 0.7 },
    { name: 'mode', label: 'Other levels', options: [{ value: 'preserve', label: 'Keep' }, { value: 'binary', label: 'Darken' }], value: 'preserve' }] },
  { group: 'Intensity', op: 'quantize', label: 'Quantise', fn: 'quantizeImage', params: [{ name: 'bits', label: 'Bits per pixel', min: 1, max: 8, step: 1, value: 3 }] },
  { group: 'Intensity', op: 'grayscale', label: 'Grayscale', fn: 'toGray', params: [] },
  { group: 'Histogram', op: 'histeq', label: 'Histogram equalisation', fn: 'histogramEqualization', params: [] },
  { group: 'Smoothing', op: 'mean', label: 'Mean (box)', fn: 'meanFilter', params: [{ name: 'k', label: 'Kernel size', ...odd, value: 3 }] },
  { group: 'Smoothing', op: 'weighted', label: 'Weighted mean', fn: 'weightedMeanFilter', params: [{ name: 'k', label: 'Kernel size', ...odd, value: 3 }] },
  { group: 'Smoothing', op: 'gaussian', label: 'Gaussian', fn: 'gaussianFilter', params: [{ name: 'k', label: 'Kernel size', ...odd, value: 5 }, { name: 'sigma', label: 'σ', min: 0.3, max: 5, step: 0.1, value: 1 }] },
  { group: 'Smoothing', op: 'median', label: 'Median', fn: 'medianFilter', params: [{ name: 'k', label: 'Kernel size', ...odd, value: 3 }] },
  { group: 'Smoothing', op: 'min', label: 'Min', fn: 'minFilter', params: [{ name: 'k', label: 'Kernel size', ...odd, value: 3 }] },
  { group: 'Smoothing', op: 'max', label: 'Max', fn: 'maxFilter', params: [{ name: 'k', label: 'Kernel size', ...odd, value: 3 }] },
  { group: 'Smoothing', op: 'midpoint', label: 'Midpoint', fn: 'midpointFilter', params: [{ name: 'k', label: 'Kernel size', ...odd, value: 3 }] },
  { group: 'Restoration', op: 'geometric', label: 'Geometric mean', fn: 'geometricMeanFilter', params: [{ name: 'k', label: 'Kernel size', ...odd, value: 3 }] },
  { group: 'Restoration', op: 'harmonic', label: 'Harmonic mean', fn: 'harmonicMeanFilter', params: [{ name: 'k', label: 'Kernel size', ...odd, value: 3 }] },
  { group: 'Restoration', op: 'contraharmonic', label: 'Contraharmonic', fn: 'contraharmonicMeanFilter', params: [{ name: 'k', label: 'Kernel size', ...odd, value: 3 }, { name: 'q', label: 'Order Q', min: -3, max: 3, step: 0.5, value: 1.5 }] },
  { group: 'Restoration', op: 'alphatrimmed', label: 'Alpha-trimmed mean', fn: 'alphaTrimmedMeanFilter', params: [{ name: 'k', label: 'Kernel size', ...odd, value: 3 }, { name: 'd', label: 'Trimmed (d)', min: 0, max: 8, step: 2, value: 2 }] },
  { group: 'Restoration', op: 'adaptivemedian', label: 'Adaptive median', fn: 'adaptiveMedianFilter', params: [{ name: 'smax', label: 'Largest window', ...odd, value: 7 }] },
  { group: 'Restoration', op: 'adaptivelocal', label: 'Adaptive local', fn: 'adaptiveLocalFilter', params: [{ name: 'k', label: 'Kernel size', ...odd, value: 5 }] },
  { group: 'Sharpening', op: 'laplacian', label: 'Laplacian', fn: 'laplacianSharpen', params: [{ name: 'amount', label: 'Strength', min: 0.1, max: 2, step: 0.1, value: 0.7 }] },
  { group: 'Sharpening', op: 'unsharp', label: 'Unsharp mask', fn: 'unsharpMask', params: [{ name: 'sigma', label: 'Blur σ', min: 0.5, max: 4, step: 0.1, value: 1.5 }, { name: 'amount', label: 'Amount', min: 0.2, max: 3, step: 0.1, value: 1 }] },
  { group: 'Sharpening', op: 'highboost', label: 'High-boost', fn: 'highBoostFilter', params: [{ name: 'boost', label: 'Boost A', min: 1, max: 4, step: 0.1, value: 2 }, { name: 'k', label: 'Kernel size', ...odd, value: 3 }] },
  { group: 'Sharpening', op: 'gradient', label: 'Gradient', fn: 'gradientSharpen', params: [
    { name: 'operator', label: 'Operator', options: [{ value: 'sobel', label: 'Sobel' }, { value: 'prewitt', label: 'Prewitt' }], value: 'sobel' },
    { name: 'weight', label: 'Weight', min: 0.1, max: 2, step: 0.1, value: 0.5 }] },
  { group: 'Noise', op: 'noise', label: 'Add noise', fn: 'addNoise', params: [
    { name: 'type', label: 'Model', options: NOISE, value: 'gaussian' },
    { name: 'variance', label: 'Variance (Gaussian)', min: 0.001, max: 0.1, step: 0.001, value: 0.01 },
    { name: 'density', label: 'Density (salt & pepper)', min: 0.01, max: 0.5, step: 0.01, value: 0.05 }] },
  { group: 'Edges & segmentation', op: 'edges', label: 'Edge detection', fn: 'edgeDetect', params: [
    { name: 'method', label: 'Detector', options: ['roberts', 'prewitt', 'sobel', 'canny', 'log'].map((m) => ({ value: m, label: m === 'log' ? 'LoG' : m[0].toUpperCase() + m.slice(1) })), value: 'sobel' }] },
  { group: 'Edges & segmentation', op: 'threshold', label: 'Global threshold', fn: 'globalThreshold', params: [{ name: 't', label: 'Threshold T', min: 0, max: 1, step: 0.01, value: 0.5 }] },
  { group: 'Edges & segmentation', op: 'otsu', label: 'Otsu threshold', fn: 'otsuThreshold', params: [] },
  { group: 'Edges & segmentation', op: 'adaptive', label: 'Adaptive threshold', fn: 'adaptiveThreshold', params: [
    { name: 'window', label: 'Window', min: 3, max: 15, step: 2, value: 15 }, { name: 'offset', label: 'Offset', min: 0, max: 0.2, step: 0.01, value: 0.02 }] },
  { group: 'Colour', op: 'pseudocolor', label: 'Pseudocolour', fn: 'intensitySlicing', params: [
    { name: 'slices', label: 'Slices', min: 2, max: 16, step: 1, value: 8 },
    { name: 'map', label: 'Colour map', options: ['jet', 'hot', 'parula', 'hsv', 'cool'].map((m) => ({ value: m, label: m })), value: 'jet' }] },
]
const GROUPS = [...new Set(OPERATIONS.map((o) => o.group))]
const byOp = Object.fromEntries(OPERATIONS.map((o) => [o.op, o]))

const newStep = (op) => ({ op, ...Object.fromEntries(byOp[op].params.map((p) => [p.name, p.value])) })
// "Median k=5", "Add noise (salt & pepper)" - for the history and the comparison cards
export function stepLabel(s) {
  const o = byOp[s.op]
  if (!o) return s.op
  const shown = o.params.filter((p) => !(s.op === 'noise' && ((p.name === 'variance' && s.type !== 'gaussian') || (p.name === 'density' && s.type !== 'saltpepper'))))
  const parts = shown.map((p) => (p.options ? p.options.find((x) => x.value === s[p.name])?.label : `${p.name}=${fmt(s[p.name], 3)}`))
  return parts.length ? `${o.label} (${parts.join(', ')})` : o.label
}

// Picks an operation (grouped) and edits its parameters
function StepEditor({ step, onChange }) {
  const o = byOp[step.op]
  const visible = o.params.filter((p) => !(step.op === 'noise' && ((p.name === 'variance' && step.type !== 'gaussian') || (p.name === 'density' && step.type !== 'saltpepper'))))
  return (
    <div className="ws-step-editor">
      <Select label="Operation" value={step.op} onChange={(op) => onChange(newStep(op))}
        options={GROUPS.flatMap((g) => OPERATIONS.filter((x) => x.group === g).map((x) => ({ value: x.op, label: `${g} · ${x.label}` })))} />
      {visible.map((p) => (p.options
        ? <Select key={p.name} label={p.label} value={step[p.name]} options={p.options} onChange={(v) => onChange({ ...step, [p.name]: v })} />
        : <Slider key={p.name} label={p.label} value={step[p.name]} min={p.min} max={p.max} step={p.step} onChange={(v) => onChange({ ...step, [p.name]: v })} />))}
      {!visible.length && <p className="small muted">No parameters.</p>}
      <p className="tiny faint">MATLAB: <code>{o.fn}</code></p>
    </div>
  )
}

// MATLAB sends [] when the output's size or channels differ from the input (no
// PSNR), and null for an infinite PSNR (identical images)
const comparable = (r) => typeof r.mse === 'number'
const psnrOf = (r) => (r.psnr == null ? Infinity : r.psnr)

function Quality({ r }) {
  return (
    <span className="small muted">
      {comparable(r) ? <>PSNR {psnrOf(r) === Infinity ? '∞ (unchanged)' : `${fmt(r.psnr, 1)} dB`} · MSE {fmt(r.mse, 4)} · </> : 'Channels changed (no PSNR) · '}
      {fmt(r.timeMs, 0)} ms
    </span>
  )
}

// ----------------------------------------------------------------- single
function SingleOp({ current, push }) {
  const { call } = useApp()
  const [group, setGroup] = useState('Smoothing')
  const [step, setStep] = useState(() => newStep('median'))
  const [preview, setPreview] = useState(null)              // {key, result}
  const key = JSON.stringify([current, step])

  const run = async () => {
    const d = await call('wsApply', { id: current, steps: [step] }, { label: byOp[step.op].label })
    if (d) setPreview({ key, result: d })
    return d
  }
  const apply = async () => {
    const d = preview?.key === key ? preview.result : await run()
    if (d) { push(d.id, stepLabel(step)); setPreview(null) }
  }
  return (
    <div className="ws-single">
      <div>
        <div className="ws-groups">
          {GROUPS.map((g) => <button key={g} className={`ws-chip ${group === g ? 'on' : ''}`} onClick={() => setGroup(g)}>{g}</button>)}
        </div>
        <div className="ws-ops">
          {OPERATIONS.filter((o) => o.group === group).map((o) => (
            <button key={o.op} className={`ws-op ${step.op === o.op ? 'on' : ''}`} onClick={() => setStep(newStep(o.op))}>{o.label}</button>
          ))}
        </div>
        <StepEditor step={step} onChange={setStep} />
        <div className="row mt-sm">
          <button className="btn" onClick={run}><Icon name="play" size={15} /> Preview</button>
          <button className="btn btn-primary" onClick={apply}><Icon name="check" size={15} /> Apply to workspace</button>
        </div>
      </div>
      <div>
        {preview ? (
          <>
            <ImageView id={preview.result.id} title={stepLabel(step)} height={300} badge={preview.key === key ? 'preview' : 'outdated'} />
            <Quality r={preview.result} />
          </>
        ) : <div className="ws-placeholder"><Icon name="image" size={26} /><span>Preview the operation to see the result here before applying it.</span></div>}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------- pipeline
const PRESETS = {
  'Remove salt & pepper, then sharpen': [newStep('median'), newStep('unsharp')],
  'Low contrast → enhanced': [newStep('stretch'), newStep('histeq')],
  'Clean edges': [{ ...newStep('gaussian'), k: 5, sigma: 1.2 }, { ...newStep('edges'), method: 'canny' }],
  'Segment objects': [newStep('grayscale'), newStep('median'), newStep('otsu')],
}

function Pipeline({ current, push }) {
  const { call } = useApp()
  const [steps, setSteps] = useState(() => [newStep('median'), newStep('histeq')])
  const [res, setRes] = useState(null)
  const edit = (i, s) => { setSteps((st) => st.map((x, j) => (j === i ? s : x))); setRes(null) }
  const move = (i, d) => { setSteps((st) => { const n = [...st]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n }); setRes(null) }
  const remove = (i) => { setSteps((st) => st.filter((_, j) => j !== i)); setRes(null) }
  const run = async () => {
    const d = await call('wsApply', { id: current, steps, intermediate: true }, { label: `Pipeline of ${steps.length}` })
    if (d) setRes(d)
  }
  return (
    <div className="stack-sm">
      <div className="row">
        <span className="small muted">Start from:</span>
        {Object.entries(PRESETS).map(([name, st]) => (
          <button key={name} className="ws-chip" onClick={() => { setSteps(st.map((s) => ({ ...s }))); setRes(null) }}>{name}</button>
        ))}
      </div>
      <div className="ws-pipeline">
        {steps.map((s, i) => (
          <div key={i} className="ws-pipe-step">
            <div className="ws-pipe-head">
              <b>{i + 1}.</b>
              <span className="spacer" />
              <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up"><Icon name="chevron" size={15} className="rot-up" /></button>
              <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Move down" title="Move down"><Icon name="chevron" size={15} className="rot-down" /></button>
              <button className="icon-btn" onClick={() => remove(i)} disabled={steps.length === 1} aria-label="Remove step" title="Remove"><Icon name="close" size={15} /></button>
            </div>
            <StepEditor step={s} onChange={(x) => edit(i, x)} />
          </div>
        ))}
        {steps.length < 12 && (
          <button className="ws-pipe-add" onClick={() => { setSteps((st) => [...st, newStep('gaussian')]); setRes(null) }}>
            <Icon name="sparkles" size={18} /> Add step
          </button>
        )}
      </div>
      <div className="row">
        <button className="btn" onClick={run}><Icon name="play" size={15} /> Run pipeline</button>
        <button className="btn btn-primary" disabled={!res} onClick={() => { push(res.id, `Pipeline: ${steps.map((s) => byOp[s.op].label).join(' → ')}`); setRes(null) }}>
          <Icon name="check" size={15} /> Apply result to workspace
        </button>
        {res && <Quality r={res} />}
      </div>
      {res && (
        <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))' }}>
          <ImageView id={current} title="Input" height={180} inspectable={false} />
          {asArray(res.steps).map((s, i) => (
            <ImageView key={s.id} id={s.id} title={`${i + 1}. ${stepLabel(steps[i])}`} height={180} inspectable={false} />
          ))}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------- compare
const COMPARE_SETS = {
  'Smoothing filters': ['mean', 'gaussian', 'median', 'midpoint'].map(newStep),
  'Noise-removal filters': ['median', 'adaptivemedian', 'alphatrimmed', 'contraharmonic'].map(newStep),
  'Sharpening': ['laplacian', 'unsharp', 'highboost', 'gradient'].map(newStep),
  'Edge detectors': ['roberts', 'prewitt', 'sobel', 'canny', 'log'].map((m) => ({ ...newStep('edges'), method: m })),
  'Thresholds': [newStep('threshold'), newStep('otsu'), newStep('adaptive')],
  'Contrast': ['stretch', 'histeq', 'gamma', 'log'].map(newStep),
  'Kernel sizes (median)': [3, 5, 7, 9].map((k) => ({ ...newStep('median'), k })),
}

function Compare({ current, push }) {
  const { call } = useApp()
  const [variants, setVariants] = useState(() => COMPARE_SETS['Smoothing filters'].map((s) => ({ ...s })))
  const [draft, setDraft] = useState(() => newStep('gaussian'))
  const [results, setResults] = useState(null)
  const set = (v) => { setVariants(v); setResults(null) }
  const run = async () => {
    const d = await call('wsCompare', { id: current, variants: variants.map((s) => ({ label: stepLabel(s), steps: [s] })) },
      { label: `Comparing ${variants.length} operations` })
    if (d) setResults(asArray(d))
  }
  const best = results ? results.reduce((b, r, i) => (comparable(r) && (b < 0 || psnrOf(r) > psnrOf(results[b])) ? i : b), -1) : -1
  return (
    <div className="stack-sm">
      <div className="row">
        <span className="small muted">Compare:</span>
        {Object.entries(COMPARE_SETS).map(([name, st]) => (
          <button key={name} className="ws-chip" onClick={() => set(st.map((s) => ({ ...s })))}>{name}</button>
        ))}
      </div>
      <div className="row">
        {variants.map((v, i) => (
          <span key={i} className="ws-variant">{stepLabel(v)}
            <button className="icon-btn" onClick={() => set(variants.filter((_, j) => j !== i))} aria-label={`Remove ${stepLabel(v)}`}><Icon name="close" size={13} /></button>
          </span>
        ))}
      </div>
      <details className="ws-add-variant">
        <summary>Add your own operation to the comparison</summary>
        <StepEditor step={draft} onChange={setDraft} />
        <button className="btn btn-small mt-sm" disabled={variants.length >= 8} onClick={() => set([...variants, { ...draft }])}>Add to comparison</button>
      </details>
      <div className="row">
        <button className="btn btn-primary" onClick={run} disabled={!variants.length}><Icon name="compare" size={15} /> Compare {variants.length} operations</button>
        <span className="tiny faint">Up to 8. PSNR / MSE are measured against the current image (higher PSNR = closer to it).</span>
      </div>
      {results && (
        <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))' }}>
          {results.map((r, i) => (
            <div key={r.id} className={`ws-compare-card ${i === best ? 'best' : ''}`}>
              <ImageView id={r.id} title={r.label} height={200} badge={i === best ? 'closest' : null} inspectable={false} />
              <Quality r={r} />
              <button className="btn btn-small mt-sm" onClick={() => push(r.id, r.label)}><Icon name="check" size={14} /> Keep this</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function WorkspaceTools() {
  const { current, push, matlab } = useApp()
  const [mode, setMode] = useState('single')
  return (
    <Card title="Process the image" extra={<span className="small faint">Every result can be undone (Ctrl+Z)</span>}>
      <Tabs tabs={[{ key: 'single', label: 'Single operation' }, { key: 'pipeline', label: 'Pipeline (several in a row)' }, { key: 'compare', label: 'Compare side by side' }]}
        active={mode} onChange={setMode} />
      {!matlab.ok ? <Note kind="warn">Waiting for MATLAB…</Note> : (
        <div className="mt-sm">
          {mode === 'single' && <SingleOp current={current} push={push} />}
          {mode === 'pipeline' && <Pipeline current={current} push={push} />}
          {mode === 'compare' && <Compare current={current} push={push} />}
        </div>
      )}
    </Card>
  )
}

