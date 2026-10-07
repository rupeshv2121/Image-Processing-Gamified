import { useEffect, useRef, useState } from 'react'
import { useApp } from '../AppContext'
import { fmt, toMatrix } from '../api'
import { parseMatrix } from '../matrix'
import LabPage from '../components/LabPage'
import Icon from '../components/Icon'
import { Card, KernelGrid, Note, Segmented, Select, Tabs } from '../components/ui'

const EXAMPLES = {
  'Edge kernel on 3×3': { matrix: '1 2 3\n4 5 6\n7 8 9', kernel: '1 0 -1\n1 0 -1\n1 0 -1' },
  'Impulse response': { matrix: '0 0 0 0 0\n0 0 0 0 0\n0 0 1 0 0\n0 0 0 0 0\n0 0 0 0 0', kernel: '1 2 3\n4 5 6\n7 8 9' },
  'Mean on 5×5': { matrix: '10 10 10 10 10\n10 10 10 10 10\n10 10 90 10 10\n10 10 10 10 10\n10 10 10 10 10', kernel: '1/9 1/9 1/9\n1/9 1/9 1/9\n1/9 1/9 1/9' },
  'Sobel X on a step': { matrix: '0 0 0 9 9 9\n0 0 0 9 9 9\n0 0 0 9 9 9\n0 0 0 9 9 9', kernel: '-1 0 1\n-2 0 2\n-1 0 1' },
}

export default function CorrelationLab() {
  const { call } = useApp()
  const [mode, setMode] = useState('correlation')
  const [matrixText, setMatrixText] = useState(EXAMPLES['Edge kernel on 3×3'].matrix)
  const [kernelText, setKernelText] = useState(EXAMPLES['Edge kernel on 3×3'].kernel)
  const [shape, setShape] = useState('same')
  const [padMode, setPadMode] = useState('zero')
  const [res, setRes] = useState(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(900)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('steps')
  const timer = useRef(null)

  const compute = async (m = mode) => {
    setError(null)
    let matrix, kernel
    try {
      matrix = parseMatrix(matrixText)
      kernel = parseMatrix(kernelText)
    } catch (e) {
      setError(e.message)
      return
    }
    const d = await call('correlation', { matrix, kernel, mode: m, shape, padMode }, { label: m })
    if (d) {
      setRes({ ...d, mode: m })
      setStep(0)
      setPlaying(false)
      setTab(m === 'convolution' ? 'flip' : 'steps')
    }
  }
  useEffect(() => { compute() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const steps = res?.steps || []
  useEffect(() => {
    if (!playing) return
    timer.current = setTimeout(() => {
      if (step < steps.length - 1) setStep((s) => s + 1)
      else setPlaying(false)
    }, speed)
    return () => clearTimeout(timer.current)
  }, [playing, step, steps.length, speed])

  const switchMode = (m) => { setMode(m); compute(m) }

  const s = steps[step]
  const padded = res ? toMatrix(res.padded) : null
  const used = res ? toMatrix(res.kernelUsed) : null
  const kernel = res ? toMatrix(res.kernel) : null
  const output = res ? toMatrix(res.output) : null
  const kh = used?.length || 0
  const kw = used?.[0]?.length || 0
  const outCols = output?.[0]?.length || 1

  const winHl = (r, c) => {
    if (!s) return null
    const r0 = s.row - 1
    const c0 = s.col - 1
    if (r >= r0 && r < r0 + kh && c >= c0 && c < c0 + kw) {
      return r === r0 + Math.floor(kh / 2) && c === c0 + Math.floor(kw / 2) ? 'center' : 'window'
    }
    return null
  }
  const outHl = (r, c) => {
    const n = r * outCols + c
    return n === step ? 'current' : n < step ? 'done' : null
  }
  const shownOutput = output?.map((row, r) => row.map((v, c) => (r * outCols + c <= step ? v : '')))
  const windowM = s ? toMatrix(s.window) : null
  const products = s ? toMatrix(s.products) : null
  const calc = windowM && used ? windowM.flatMap((row, r) => row.map((v, c) => `(${fmt(used[r][c], 3)}×${fmt(v, 3)})`)).join(' + ') : ''

  const theory = (
    <>
      <p><b>Correlation</b> slides the kernel over the image and, at each position, multiplies the overlapping values and adds them up. The kernel is used as it is.</p>
      <div className="formula">(w ☆ f)(x,y) = Σ_s Σ_t w(s,t) · f(x+s, y+t)</div>
      <p><b>Convolution</b> is identical except that the kernel is first <b>rotated by 180°</b> (flipped horizontally and vertically).</p>
      <div className="formula">(w ★ f)(x,y) = Σ_s Σ_t w(s,t) · f(x−s, y−t)</div>
      <p className="small">For symmetric kernels (mean, Gaussian, Laplacian) both give the same result. Correlating with a unit impulse gives the rotated kernel; convolving gives the kernel itself. In MATLAB: <code>filter2</code>/<code>imfilter</code> correlate, <code>conv2</code> convolves. (<code>corr2</code> is different — it returns one correlation coefficient.)</p>
    </>
  )

  const controls = (
    <>
      <Segmented value={mode} onChange={switchMode} options={[{ value: 'correlation', label: 'Correlation' }, { value: 'convolution', label: 'Convolution' }]} />
      <Select label="Example" value="" options={[{ value: '', label: 'Load an example…' }, ...Object.keys(EXAMPLES)]}
        onChange={(k) => { if (EXAMPLES[k]) { setMatrixText(EXAMPLES[k].matrix); setKernelText(EXAMPLES[k].kernel) } }} />
      <label className="field"><span className="field-label">Image matrix f</span>
        <textarea rows={4} value={matrixText} onChange={(e) => setMatrixText(e.target.value)} />
      </label>
      <label className="field"><span className="field-label">Kernel w (odd size, 1/9 allowed)</span>
        <textarea rows={3} value={kernelText} onChange={(e) => setKernelText(e.target.value)} />
      </label>
      <div className="grid-2" style={{ gap: 10 }}>
        <Select label="Output" value={shape} onChange={setShape} options={['same', 'valid', 'full']} />
        <Select label="Padding" value={padMode} onChange={setPadMode} options={['zero', 'replicate']} />
      </div>
      <button className="btn btn-primary btn-block" onClick={() => compute()}>Compute</button>
      {error && <Note kind="error">{error}</Note>}
    </>
  )

  return (
    <LabPage unit="Unit II · Enhancement" title="Correlation & Convolution" subtitle="Watch the kernel slide over a small matrix — every product and sum is computed by MATLAB."
      theory={theory} controls={controls} panelTitle="Input" needImage={false}
      code={{ functions: ['manualCorrelation', 'manualConvolution'], snippets: [{ title: 'Built-in MATLAB', code: "I = [1 2 3; 4 5 6; 7 8 9];\nK = [1 0 -1; 1 0 -1; 1 0 -1];\nG1 = filter2(K, I, 'same')    % correlation\nG2 = conv2(I, K, 'same')      % convolution\nKf = rot90(K, 2)              % flipped kernel" }] }}>
      {res && (
        <>
          <Tabs tabs={[...(res.mode === 'convolution' ? [{ key: 'flip', label: '1 · Flip the kernel' }] : []), { key: 'steps', label: res.mode === 'convolution' ? '2 · Slide the kernel' : 'Slide the kernel' }, { key: 'results', label: 'Compare results' }]} active={tab} onChange={setTab} />

          {tab === 'flip' && (
            <Card>
              <div className="row center" style={{ gap: 40, padding: '20px 0' }}>
                <KernelGrid matrix={kernel} title="Original kernel w" />
                <div className="center faint"><Icon name="reset" size={32} /><div className="small mono">rot90(w, 2)</div></div>
                <KernelGrid matrix={used} title="Flipped kernel (used)" />
              </div>
              <Note kind={res.symmetric ? 'ok' : 'info'}>
                {res.symmetric
                  ? 'This kernel is symmetric — flipping changes nothing, so convolution equals correlation.'
                  : 'Rows and columns are reversed. Now the flipped kernel slides over the image exactly as in correlation.'}
              </Note>
              <div className="row right mt-sm"><button className="btn btn-navy" onClick={() => setTab('steps')}>Next: slide it →</button></div>
            </Card>
          )}

          {tab === 'steps' && (
            <Card>
              <div className="row between" style={{ marginBottom: 22 }}>
                <h3>Position {step + 1} of {steps.length}</h3>
                <div className="row" style={{ gap: 8 }}>
                  <div className="btn-group">
                    <button className="btn btn-small" onClick={() => { setStep(0); setPlaying(false) }} title="Reset">⏮</button>
                    <button className="btn btn-small" onClick={() => setStep((x) => Math.max(0, x - 1))} title="Previous">◀</button>
                    <button className="btn btn-small" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸ Pause' : '▶ Play'}</button>
                    <button className="btn btn-small" onClick={() => setStep((x) => Math.min(steps.length - 1, x + 1))} title="Next">▶</button>
                    <button className="btn btn-small" onClick={() => setStep(steps.length - 1)} title="End">⏭</button>
                  </div>
                  <Segmented value={speed} onChange={setSpeed} options={[{ value: 1500, label: 'Slow' }, { value: 900, label: 'Normal' }, { value: 350, label: 'Fast' }]} />
                </div>
              </div>
              <div className="progressbar" style={{ marginBottom: 26 }}><div style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
              <div className="grid-2" style={{ alignItems: 'start' }}>
                <KernelGrid matrix={padded} title={`Padded image (${padMode}) — window highlighted`} highlight={winHl} small={padded[0].length > 7} />
                <KernelGrid matrix={shownOutput} title="Output g — fills in as the kernel moves" highlight={outHl} small={outCols > 7} />
              </div>
              <div className="grid-2 mt" style={{ alignItems: 'start' }}>
                <KernelGrid matrix={used} title={res.mode === 'convolution' ? 'Flipped kernel' : 'Kernel'} small />
                <KernelGrid matrix={products} title="Element-wise products" small />
              </div>
              {s && (
                <div className="step-box mt">
                  <b>Output at ({s.row}, {s.col})</b>
                  <div className="calc">{calc}</div>
                  <div className="calc">= <b>{fmt(s.sum, 4)}</b></div>
                </div>
              )}
            </Card>
          )}

          {tab === 'results' && (
            <div className="stack">
              <div className="grid-2">
                <Card title="Correlation"><div className="row" style={{ gap: 26 }}><KernelGrid matrix={toMatrix(res.correlation)} title="manual" small /><KernelGrid matrix={toMatrix(res.builtinCorrelation)} title="filter2(w, f)" small /></div></Card>
                <Card title="Convolution"><div className="row" style={{ gap: 26 }}><KernelGrid matrix={toMatrix(res.convolution)} title="manual" small /><KernelGrid matrix={toMatrix(res.builtinConvolution)} title="conv2(f, w)" small /></div></Card>
              </div>
              {res.maxDiffBuiltin != null && (
                <Note kind={res.maxDiffBuiltin < 1e-9 ? 'ok' : 'warn'}>The manual results match MATLAB's built-in filter2 and conv2 (max difference {fmt(res.maxDiffBuiltin)}).</Note>
              )}
            </div>
          )}
        </>
      )}
    </LabPage>
  )
}
