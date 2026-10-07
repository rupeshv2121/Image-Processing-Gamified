import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt, toMatrix } from '../api'
import { evalNumber } from '../matrix'
import LabPage from '../components/LabPage'
import { Card, ImageView, KernelGrid, Note, Segmented, Select, UseButton } from '../components/ui'

const PRESETS = [
  { value: 'mean', label: 'Mean' }, { value: 'gaussian', label: 'Gaussian' }, { value: 'weighted', label: 'Weighted mean' },
  { value: 'sobelx', label: 'Sobel X' }, { value: 'sobely', label: 'Sobel Y' }, { value: 'prewittx', label: 'Prewitt X' },
  { value: 'prewitty', label: 'Prewitt Y' }, { value: 'laplacian', label: 'Laplacian' }, { value: 'laplacian8', label: 'Laplacian (8)' },
  { value: 'sharpen', label: 'Sharpening' }, { value: 'emboss', label: 'Emboss' }, { value: 'identity', label: 'Identity' },
]
const identity = (n) => Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (r === (n - 1) / 2 && c === (n - 1) / 2 ? '1' : '0')))

export default function KernelPlayground() {
  const { current, call, notify } = useApp()
  const [size, setSize] = useState(3)
  const [kernel, setKernel] = useState(identity(3))
  const [description, setDescription] = useState('Identity kernel: the output equals the input. Edit any value or load a preset.')
  const [mode, setMode] = useState('correlation')
  const [display, setDisplay] = useState('auto')
  const [live, setLive] = useState(true)
  const [res, setRes] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState([])
  const [saveName, setSaveName] = useState('')
  const [view, setView] = useState('output')
  const debounce = useRef(null)

  const numeric = useCallback(() => kernel.map((r) => r.map(evalNumber)), [kernel])

  const apply = useCallback(async () => {
    let K
    try { K = numeric(); setError(null) } catch (e) { setError(e.message); return }
    const d = await call('applyKernel', { id: current, kernel: K, mode, display }, { label: 'imfilter with your kernel', quiet: live })
    if (d) setRes(d)
  }, [numeric, call, current, mode, display, live])

  useEffect(() => {
    if (!live || !current) return
    clearTimeout(debounce.current)
    debounce.current = setTimeout(apply, 450)
    return () => clearTimeout(debounce.current)
  }, [kernel, mode, display, live, current, apply])

  useEffect(() => { call('listKernels', {}, { quiet: true }).then((l) => l && setSaved(asArray(l))) }, [call])

  const loadPreset = async (name) => {
    const d = await call('kernelPreset', { name, size }, { label: `Preset ${name}` })
    if (d) {
      setKernel(toMatrix(d.kernel).map((r) => r.map((v) => String(Number(v.toFixed(4))))))
      setDescription(d.description)
    }
  }
  const changeSize = (n) => {
    setSize(n)
    setKernel(identity(n))
    setDescription('Identity kernel. Load a preset or type your own values.')
  }
  const normalise = () => {
    try {
      const K = numeric()
      const s = K.flat().reduce((a, b) => a + b, 0)
      if (Math.abs(s) < 1e-12) { setError('This kernel sums to 0 (a derivative kernel) and cannot be normalised.'); return }
      setKernel(K.map((r) => r.map((v) => String(Number((v / s).toFixed(5))))))
    } catch (e) { setError(e.message) }
  }
  const save = async () => {
    try {
      const l = await call('saveKernel', { name: saveName || `kernel ${saved.length + 1}`, kernel: numeric() }, { label: 'Saving kernel' })
      if (l) { setSaved(asArray(l)); notify('Kernel saved to data/kernels.mat'); setSaveName('') }
    } catch (e) { setError(e.message) }
  }

  let sum = null
  try { sum = numeric().flat().reduce((a, b) => a + b, 0) } catch { /* invalid entry */ }
  const kind = sum == null ? 'invalid entry' : Math.abs(sum - 1) < 1e-6 ? 'smoothing-type: brightness preserved' : Math.abs(sum) < 1e-6 ? 'zero-sum: derivative / edge detector' : 'changes the overall brightness'

  const theory = (
    <>
      <p>A spatial filter is defined by its <b>kernel</b>: each output pixel is the sum of the neighbourhood multiplied by the kernel weights.</p>
      <div className="formula">g(x,y) = Σ_s Σ_t w(s,t) · f(x+s, y+t)</div>
      <p className="small"><b>Weights sum to 1</b> → smoothing (brightness preserved). <b>Weights sum to 0</b> → derivative: flat areas become 0 and only edges respond. <b>Centre &gt; sum of the rest</b> → sharpening.</p>
      <p className="small">For asymmetric kernels (Sobel, emboss) correlation and convolution give different results; switch the mode to see it.</p>
    </>
  )

  const controls = (
    <>
      <span className="field-label">Kernel size</span>
      <Segmented value={size} onChange={changeSize} options={[{ value: 3, label: '3×3' }, { value: 5, label: '5×5' }, { value: 7, label: '7×7' }]} />
      <Select label="Preset" value="" options={[{ value: '', label: 'Load a preset…' }, ...PRESETS]} onChange={(v) => v && loadPreset(v)} />
      <span className="field-label">Operation</span>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'correlation', label: 'Correlation' }, { value: 'convolution', label: 'Convolution' }]} />
      <Select label="Display" value={display} onChange={setDisplay} options={[{ value: 'auto', label: 'Auto' }, { value: 'clip', label: 'Clip to [0,1]' }, { value: 'scale', label: 'Rescale min..max' }, { value: 'abs', label: 'Absolute value' }]} />
      <label className="check"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Apply while editing</label>
      <div className="divider" />
      <span className="field-label">My kernels</span>
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <input type="text" placeholder="Name" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
        <button className="btn" onClick={save}>Save</button>
      </div>
      {saved.length > 0 && (
        <Select value="" options={[{ value: '', label: `Load saved (${saved.length})…` }, ...saved.map((s, i) => ({ value: String(i), label: s.name }))]}
          onChange={(i) => {
            if (i === '') return
            const K = toMatrix(saved[Number(i)].kernel)
            setSize(K.length)
            setKernel(K.map((r) => r.map((v) => String(Number(v.toFixed(5))))))
            setDescription(`Saved kernel "${saved[Number(i)].name}".`)
          }} />
      )}
    </>
  )

  return (
    <LabPage unit="Unit II · Enhancement" title="Kernel Playground" subtitle="Design a spatial filter cell by cell — MATLAB applies it to the workspace image as you type."
      theory={theory} controls={controls} panelTitle="Kernel options"
      code={{ functions: ['filter2D', 'kernelPresets', 'manualFilterLoop'], snippets: [{ title: 'MATLAB', code: "K = [0 -1 0; -1 5 -1; 0 -1 0];\nJ  = imfilter(I, K, 'replicate');          % correlation\nJ2 = imfilter(I, K, 'conv', 'replicate');  % convolution" }] }}>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title="Kernel" extra={<span className="badge badge-navy">Σ = {sum == null ? '?' : fmt(sum, 3)}</span>}>
          <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
            <KernelGrid matrix={kernel} editable onChange={setKernel} small={size > 3} />
          </div>
          <p className="small muted mt-sm">{kind}</p>
          <div className="row mt-sm">
            {!live && <button className="btn btn-primary" onClick={apply}>Apply</button>}
            <button className="btn" onClick={normalise}>Normalise</button>
            <button className="btn btn-ghost" onClick={() => changeSize(size)}>Reset</button>
          </div>
          {error && <Note kind="error">{error}</Note>}
          <p className="small mt" style={{ color: 'var(--text-2)' }}>{description}</p>
        </Card>
        <ImageView id={view === 'input' ? current : res?.id || null} title={view === 'input' ? 'Input' : 'Output'} height={460} emptyText="Edit the kernel to see the result"
          caption={res && view === 'output' ? `${fmt(res.timeMs, 1)} ms · display: ${res.display}${res.symmetric ? ' · symmetric kernel' : ''}` : null}
          actions={
            <>
              <Segmented value={view} onChange={setView} options={[{ value: 'output', label: 'Output' }, { value: 'input', label: 'Input' }]} />
              {res && <UseButton id={res.id} label="Custom kernel" />}
            </>
          } />
      </div>
    </LabPage>
  )
}
