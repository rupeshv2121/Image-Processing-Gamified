import { useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt, fmtPsnr, toMatrix } from '../api'
import ImagePair from '../components/ImagePair'
import LabPage from '../components/LabPage'
import { BarChart, Card, ImageView, KernelGrid, LineChart, Metrics, Note, Select, Slider, UseButton } from '../components/ui'

const PSFS = [
  { value: 'motion', label: 'Motion blur', text: 'Camera or object moving in a straight line during the exposure: a line of length L at angle θ.' },
  { value: 'gaussian', label: 'Atmospheric turbulence', text: 'Long-exposure turbulence H(u,v) = exp(−k(u² + v²)^(5/6)) is close to a Gaussian PSF.' },
  { value: 'disk', label: 'Out of focus', text: 'A defocused lens spreads a point into a uniform disc (the circle of confusion).' },
  { value: 'box', label: 'Uniform (box)', text: 'Every point spread evenly over a k×k square — the mean filter as a degradation.' },
]
const METHODS = [
  { value: 'inverse', label: 'Inverse filter', param: null, text: 'Minimises ‖h∗f − g‖². Its fixed point is F = G / H: where H is tiny the noise is divided by almost zero, so more iterations sharpen first and then blow the noise up.' },
  { value: 'wiener', label: 'Wiener (parametric)', param: 'K', text: 'Minimises ‖h∗f − g‖² + K‖f‖². Converges to F = H*G / (|H|² + K). K is the noise-to-signal power ratio: larger K = more smoothing, less ringing.' },
  { value: 'cls', label: 'Constrained least squares', param: 'γ', text: 'Minimises ‖h∗f − g‖² + γ‖p∗f‖² with p the Laplacian: F = H*G / (|H|² + γ|P|²). Penalises roughness instead of energy, so edges survive better.' },
  { value: 'lucy', label: 'Richardson–Lucy', param: null, text: 'f ← f · (h′ ∗ (g / (h∗f))). Maximum-likelihood restoration for Poisson (photon) noise; stays non-negative. The number of iterations is the regularisation.' },
]

export default function RestorationLab() {
  const { current, call } = useApp()
  const [psf, setPsf] = useState('motion')
  const [length, setLength] = useState(15)
  const [angle, setAngle] = useState(30)
  const [sigma, setSigma] = useState(2)
  const [radius, setRadius] = useState(4)
  const [size, setSize] = useState(7)
  const [noiseVar, setNoiseVar] = useState(0.0001)
  const [deg, setDeg] = useState(null)
  const [method, setMethod] = useState('wiener')
  const [lambda, setLambda] = useState(0.01)
  const [iterations, setIterations] = useState(10)
  const [runs, setRuns] = useState({})
  const [shown, setShown] = useState(null)
  const meth = METHODS.find((m) => m.value === method)

  const psfParams = () => ({ psf, length, angle, sigma, radius, size })
  const degrade = async () => {
    const p = psfParams()
    const d = await call('lpiDegrade', { id: current, ...p, noiseVar, seed: 11 }, { label: `Degrade: ${PSFS.find((x) => x.value === psf).label}` })
    if (d) {
      setDeg({ ...d, psfParams: p, noiseVar })
      setRuns({})
      setShown(null)
    }
  }
  const restore = async (m = method) => {
    const def = METHODS.find((x) => x.value === m)
    const params = { id: deg.id, refId: deg.cleanId, ...deg.psfParams, method: m, lambda, iterations }
    const d = await call('deconvolve', params, { label: `${def.label}, ${iterations} iterations` })
    if (d) {
      const desc = `${def.label}${def.param ? ` ${def.param} = ${lambda}` : ''} · ${iterations} it.`
      setRuns((r) => ({ ...r, [m]: { ...d, desc } }))
      setShown(m)
    }
  }
  const restoreAll = async () => { for (const m of METHODS) await restore(m.value) }
  const done = METHODS.filter((m) => runs[m.value])
  const pick = shown && runs[shown]
  const history = pick ? asArray(pick.history) : []
  const bestIt = history.length ? history.indexOf(Math.max(...history)) + 1 : 0

  const theory = (
    <>
      <p>The degradation model of a <b>linear, position-invariant</b> (LPI) system is</p>
      <div className="formula">g(x,y) = h(x,y) ∗ f(x,y) + η(x,y)        G(u,v) = H(u,v)·F(u,v) + N(u,v)</div>
      <p className="small"><b>Linear</b>: H[a·f₁ + b·f₂] = a·H[f₁] + b·H[f₂]. <b>Position-invariant</b>: shifting the input only shifts the output, so one point-spread function (PSF) h — the image of a single bright point — describes the blur everywhere, and the degradation is a convolution.</p>
      {PSFS.map((p) => <p key={p.value} className="small"><b>{p.label}</b> — {p.text}</p>)}
      <h4>Restoration</h4>
      {METHODS.map((m) => <p key={m.value} className="small"><b>{m.label}</b> — {m.text}</p>)}
      <h4>Spatial domain only</h4>
      <p className="small">Textbooks compute these filters with the Fourier transform. ImageLab solves the same least-squares problems <b>(H′H + λR′R) f = H′g</b> iteratively with the conjugate-gradient method, where every step is a convolution with h or its 180° rotation. When the iterations converge the result equals the frequency-domain filter; stopping early is itself a form of regularisation (watch the PSNR-per-iteration curve).</p>
    </>
  )

  const controls = (
    <>
      <span className="field-label">1 · Degradation h</span>
      <div className="choice-list">
        {PSFS.map((p) => <button key={p.value} className={`choice ${psf === p.value ? 'active' : ''}`} onClick={() => setPsf(p.value)}>{p.label}</button>)}
      </div>
      {psf === 'motion' && (
        <>
          <Slider label="Length L" value={length} min={3} max={31} step={1} onChange={setLength} format={(v) => `${v} px`} />
          <Slider label="Angle θ" value={angle} min={0} max={180} step={5} onChange={setAngle} format={(v) => `${v}°`} />
        </>
      )}
      {psf === 'gaussian' && <Slider label="Spread σ" value={sigma} min={0.5} max={5} step={0.1} onChange={setSigma} />}
      {psf === 'disk' && <Slider label="Radius" value={radius} min={1} max={12} step={0.5} onChange={setRadius} format={(v) => `${v} px`} />}
      {psf === 'box' && <Slider label="Size k" value={size} min={3} max={21} step={2} onChange={setSize} format={(v) => `${v}×${v}`} />}
      <Slider label="Noise variance σ²η" value={noiseVar} min={0} max={0.005} step={0.0001} onChange={setNoiseVar} format={(v) => (v ? v.toFixed(4) : 'none')} />
      <button className="btn btn-primary btn-block" onClick={degrade}>Degrade image</button>
      <div className="divider" />
      <span className="field-label">2 · Restoration</span>
      <Select label="Method" value={method} onChange={setMethod} options={METHODS} />
      {meth.param && <Slider label={`${meth.param} (regularisation)`} value={lambda} min={0.0005} max={0.1} step={0.0005} onChange={setLambda} />}
      <Slider label="Iterations" value={iterations} min={1} max={60} step={1} onChange={setIterations} />
      <button className="btn btn-navy btn-block" onClick={() => restore()} disabled={!deg}>Restore</button>
      <button className="btn btn-small btn-block" onClick={restoreAll} disabled={!deg}>Run all four</button>
      <p className="tiny faint">The image is reduced to at most 400 px so the iterations stay fast.</p>
    </>
  )

  return (
    <LabPage unit="Unit III · Restoration" title="Restoration Lab" subtitle="Blur an image with a known point-spread function plus noise, then undo the linear, position-invariant degradation."
      theory={theory} controls={controls} panelTitle="Degrade & restore"
      code={{
        functions: ['blurPSF', 'degradeLPI', 'blurImage', 'deconvolveImage'],
        snippets: [{ title: 'Toolbox calls', code: "h = fspecial('motion', 15, 30);\ng = imfilter(f, h, 'conv', 'symmetric');\ng = imnoise(g, 'gaussian', 0, 1e-4);\nf1 = deconvwnr(g, h, 0.01);        % Wiener\nf2 = deconvreg(g, h);              % constrained least squares\nf3 = deconvlucy(g, h, 20);         % Richardson-Lucy" }],
      }}>
      {!deg ? (
        <div className="stack">
          <div className="grid-2">
            <ImageView id={current} title="Original f" height={400} />
            <ImageView id={null} title="Degraded g = h ∗ f + η" height={400} emptyText="Choose a blur and press Degrade image" />
          </div>
          <Note>Start with motion blur and very little noise, then raise the noise: the inverse filter breaks down first, Wiener and constrained least squares stay stable.</Note>
        </div>
      ) : (
        <div className="stack">
          <Metrics items={[
            { label: 'Degraded PSNR', value: fmtPsnr(deg.psnr) },
            { label: 'Degraded MSE', value: deg.mse },
            { label: 'PSF size', value: `${deg.psfSize}×${deg.psfSize}` },
            { label: 'Noise σ²η', value: deg.noiseVar ? deg.noiseVar.toFixed(4) : 'none' },
          ]} />
          <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))' }}>
            <ImageView id={deg.cleanId} title="Original f" height={260} />
            <ImageView id={deg.psfId} title="Point-spread function h" caption="the image of a single bright point" height={260} pixelated inspectable={false} />
            <ImageView id={deg.id} title="Degraded g = h ∗ f + η" height={260} actions={<UseButton id={deg.id} label="Blurred + noise" />} />
          </div>
          {deg.psf?.rows > 0 && (
            <Card title="PSF values (sum = 1)"><KernelGrid matrix={toMatrix(deg.psf).map((row) => row.map((v) => Number(v.toFixed(3))))} small /></Card>
          )}
          {done.length > 0 && (
            <Card title="Restorations">
              <div className="choice-list" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {done.map((m) => (
                  <button key={m.value} className={`choice ${shown === m.value ? 'active' : ''}`} onClick={() => setShown(m.value)}>
                    {m.label}<small>{fmtPsnr(runs[m.value].psnr)}</small>
                  </button>
                ))}
              </div>
              {done.length > 1 && <BarChart title="PSNR against the original (dB)" values={done.map((m) => runs[m.value].psnr)} labels={done.map((m) => m.label)} height={160} />}
            </Card>
          )}
          {pick && (
            <>
              <ImagePair height={380}
                left={{ id: deg.id, title: 'Degraded' }}
                right={{ id: pick.id, title: pick.desc, badge: fmtPsnr(pick.psnr), actions: <UseButton id={pick.id} label={pick.desc} /> }} />
              <Card title="PSNR after each iteration">
                <LineChart height={160} x={['1', String(history.length)]} series={[{ values: history, color: '#22a565', label: 'restored' }, { values: history.map(() => deg.psnr), color: '#999', label: 'degraded', dashed: true }]} />
                <p className="small muted mt-sm">
                  Best after iteration {bestIt} ({fmt(Math.max(...history), 2)} dB); final {fmtPsnr(pick.psnr)}, MSE {fmt(pick.mse, 5)}, {fmt(pick.timeMs, 0)} ms.
                  {bestIt < history.length && ' After the peak the noise is amplified faster than detail is recovered — stop earlier or regularise more.'}
                </p>
              </Card>
            </>
          )}
        </div>
      )}
    </LabPage>
  )
}
