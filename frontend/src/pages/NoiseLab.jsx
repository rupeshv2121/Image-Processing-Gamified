import { useState } from 'react'
import { useApp } from '../AppContext'
import { fmt, fmtPsnr } from '../api'
import ImagePair from '../components/ImagePair'
import LabPage from '../components/LabPage'
import { BarChart, Card, Metrics, Note, Slider, UseButton } from '../components/ui'

const TYPES = [
  { value: 'gaussian', label: 'Gaussian', hint: 'sensor noise' },
  { value: 'saltpepper', label: 'Salt & Pepper', hint: 'impulses' },
  { value: 'speckle', label: 'Speckle', hint: 'multiplicative' },
  { value: 'poisson', label: 'Poisson', hint: 'photon count' },
]

const INFO = {
  gaussian: { model: 'g(x,y) = f(x,y) + η(x,y),   η ~ N(μ, σ²)', text: 'Additive noise from electronic circuits and sensor heat. Every pixel is shifted by a small random amount. Best removed by averaging (mean / Gaussian filters).', code: "J = imnoise(I, 'gaussian', mean, variance);" },
  saltpepper: { model: 'g = 0 with prob. d/2,   1 with prob. d/2,   f otherwise', text: 'Impulse noise from faulty sensor cells or transmission errors: isolated black and white dots. Best removed by the median filter.', code: "J = imnoise(I, 'salt & pepper', density);" },
  speckle: { model: 'g = f + n·f,   n uniform, mean 0, variance v', text: 'Multiplicative noise — brighter areas get more noise. Typical of ultrasound, radar (SAR) and laser imaging.', code: "J = imnoise(I, 'speckle', variance);" },
  poisson: { model: 'g ~ Poisson(λ = f),   variance = mean', text: 'Shot (photon) noise: light arrives as discrete photons, so the count fluctuates. Signal-dependent; dominant in low-light images.', code: "J = imnoise(I, 'poisson');" },
}

// Restoration filters run on the noisy image and are scored against the clean input
const RESTORE = [
  { name: 'adaptivemedian', label: 'Adaptive median', text: 'Grows the window up to Smax and only replaces pixels that look like impulses — best for (dense) salt & pepper.' },
  { name: 'adaptivelocal', label: 'Adaptive local (Wiener)', text: 'f̂ = g − (σ²η/σ²L)(g − mL): smooths flat areas, keeps edges where the local variance is high — best for Gaussian noise.' },
  { name: 'median', label: 'Median', text: 'Fixed-size median, for comparison.' },
  { name: 'mean', label: 'Mean', text: 'Fixed-size average, for comparison.' },
]

export default function NoiseLab() {
  const { current, call } = useApp()
  const [type, setType] = useState('saltpepper')
  const [mean, setMean] = useState(0)
  const [variance, setVariance] = useState(0.01)
  const [density, setDensity] = useState(0.05)
  const [speckleVar, setSpeckleVar] = useState(0.04)
  const [res, setRes] = useState(null)
  const [smax, setSmax] = useState(7)
  const [rk, setRk] = useState(5)
  const [noiseVar, setNoiseVar] = useState(0)
  const [restored, setRestored] = useState({})
  const [shown, setShown] = useState(null)

  const apply = async () => {
    const params = { id: current, type, mean, variance: type === 'speckle' ? speckleVar : variance, density }
    const d = await call('noise', params, { label: `imnoise ${type}` })
    if (d) {
      setRes({ ...d, type, clean: current })
      setRestored({})
      setShown(null)
    }
  }

  const restore = async (f) => {
    const k = f.name === 'adaptivemedian' ? smax : rk
    const params = { id: res.id, name: f.name, k, refId: res.clean }
    if (f.name === 'adaptivelocal' && noiseVar > 0) params.noiseVar = noiseVar
    const d = await call('filter', params, { label: `${f.label} ${k}×${k}` })
    if (d) {
      const r = Array.isArray(d.runs) ? d.runs[0] : d.runs
      setRestored((x) => ({ ...x, [f.name]: { ...r, k, label: f.label } }))
      setShown(f.name)
    }
  }
  const restoreAll = async () => { for (const f of RESTORE) await restore(f) }
  const done = RESTORE.filter((f) => restored[f.name])
  const best = done.length ? done.reduce((a, b) => ((restored[b.name].psnr ?? Infinity) > (restored[a.name].psnr ?? Infinity) ? b : a)) : null
  const pick = shown && restored[shown]

  const theory = (
    <>
      <p>Image degradation is modelled as <b>g = h ★ f + η</b>. In this lab h is the identity, so only the noise η is added.</p>
      {TYPES.map((t) => (
        <div key={t.value}>
          <h4>{t.label}</h4>
          <div className="formula" style={{ margin: '8px 0' }}>{INFO[t.value].model}</div>
          <p className="small">{INFO[t.value].text}</p>
        </div>
      ))}
      <p className="small">Quality is measured against the original: MSE (lower is better), PSNR = 10·log₁₀(1/MSE) and SSIM (1 = identical structure).</p>
      <h4>Adaptive restoration filters</h4>
      <div className="formula" style={{ margin: '8px 0' }}>{'Adaptive median\nstage A: if zmin < zmed < zmax go to stage B, else grow the window (up to Smax)\nstage B: if zmin < zxy < zmax keep zxy, else output zmed'}</div>
      <p className="small">Only pixels that look like impulses are replaced, so detail survives — and the growing window copes with dense noise.</p>
      <div className="formula" style={{ margin: '8px 0' }}>Adaptive local noise reduction:  f̂ = g − (σ²η / σ²L)·(g − mL)</div>
      <p className="small">Where the local variance σ²L is close to the noise variance σ²η (a flat area) the output is the local mean; where σ²L is much larger (an edge) the pixel is kept. The toolbox equivalent is wiener2.</p>
    </>
  )

  const controls = (
    <>
      <div className="choice-list">
        {TYPES.map((t) => (
          <button key={t.value} className={`choice ${type === t.value ? 'active' : ''}`} onClick={() => setType(t.value)}>
            {t.label}<small>{t.hint}</small>
          </button>
        ))}
      </div>
      {type === 'gaussian' && (
        <>
          <Slider label="Mean μ" value={mean} min={-0.2} max={0.2} step={0.01} onChange={setMean} />
          <Slider label="Variance σ²" value={variance} min={0.001} max={0.1} step={0.001} onChange={setVariance} />
        </>
      )}
      {type === 'saltpepper' && <Slider label="Density d" value={density} min={0.01} max={0.5} step={0.01} onChange={setDensity} />}
      {type === 'speckle' && <Slider label="Variance v" value={speckleVar} min={0.005} max={0.3} step={0.005} onChange={setSpeckleVar} />}
      {type === 'poisson' && <p className="small muted">No parameter — the noise depends on each pixel's brightness.</p>}
      <button className="btn btn-primary btn-block" onClick={apply}>Add noise</button>
    </>
  )

  return (
    <LabPage unit="Unit III · Restoration" title="Noise Lab" subtitle="Degrade the workspace image with a noise model and measure how much quality is lost."
      theory={theory} controls={controls} panelTitle="Noise model"
      code={{ functions: ['addGaussianNoise', 'addSaltPepperNoise', 'addSpeckleNoise', 'addPoissonNoise', 'calculatePSNR', 'calculateSSIM'], snippets: [{ title: 'Toolbox call', code: `I = im2double(imread('peppers.png'));\n${INFO[type].code}\nmse = immse(J, I)\np   = psnr(J, I)\ns   = ssim(J, I)` }] }}>
      <div className="stack">
        {res && (
          <Metrics items={[
            { label: 'MSE', value: res.mse },
            { label: 'PSNR', value: fmtPsnr(res.psnr) },
            { label: 'SSIM', value: res.ssim },
          ]} />
        )}
        <ImagePair height={380}
          left={{ id: res ? res.clean : current, title: 'Original' }}
          right={{ id: res?.id || null, title: 'Noisy', emptyText: 'Choose a noise model and press Add noise',
            actions: res && <UseButton id={res.id} label={`Added ${res.type} noise`} /> }} />
        {res && (
          <Card title="Restore the noisy image" extra={<button className="btn btn-small btn-navy" onClick={restoreAll}>Run all four</button>}>
            <div className="restore-grid">
              <div className="controls">
                <Slider label="Adaptive median: max window Smax" value={smax} min={3} max={15} step={2} onChange={setSmax} format={(v) => `${v}×${v}`} />
                <Slider label="Window k (Wiener, median, mean)" value={rk} min={3} max={11} step={2} onChange={setRk} format={(v) => `${v}×${v}`} />
                <Slider label="Noise variance σ²η" value={noiseVar} min={0} max={0.05} step={0.001} onChange={setNoiseVar} format={(v) => (v ? v.toFixed(3) : 'estimate')} />
                <div className="choice-list">
                  {RESTORE.map((f) => (
                    <button key={f.name} className={`choice ${shown === f.name ? 'active' : ''}`} onClick={() => restore(f)} title={f.text}>
                      {f.label}<small>{restored[f.name] ? fmtPsnr(restored[f.name].psnr) : 'run'}</small>
                    </button>
                  ))}
                </div>
                <p className="tiny faint">{RESTORE.find((f) => f.name === (shown || 'adaptivemedian')).text}</p>
              </div>
              <div className="stack-sm">
                {done.length > 1 && (
                  <BarChart title="PSNR against the clean original (dB)" values={done.map((f) => restored[f.name].psnr)} labels={done.map((f) => f.label)} height={170} />
                )}
                {best && done.length > 1 && <Note kind="ok"><b>{best.label}</b> restores this {res.type} noise best (PSNR {fmtPsnr(restored[best.name].psnr)}, SSIM {fmt(restored[best.name].ssim, 3)}).</Note>}
                {!done.length && <p className="muted small">Pick a filter: MATLAB filters the noisy image and scores it against the clean original.</p>}
              </div>
            </div>
          </Card>
        )}
        {pick && (
          <ImagePair height={380}
            left={{ id: res.id, title: 'Noisy' }}
            right={{ id: pick.id, title: `${pick.label} ${pick.k}×${pick.k}`, badge: fmtPsnr(pick.psnr), actions: <UseButton id={pick.id} label={`${pick.label} restoration`} /> }} />
        )}
        {res && <Note>Tip: add <b>dense</b> salt & pepper noise (d ≥ 0.25) — the plain median fails while the adaptive median still recovers the image. For Gaussian noise the adaptive local filter keeps edges that the mean filter blurs.</Note>}
      </div>
    </LabPage>
  )
}
