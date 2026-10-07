import { useState } from 'react'
import { useApp } from '../AppContext'
import { fmtPsnr } from '../api'
import LabPage from '../components/LabPage'
import { ImageView, Metrics, Note, Segmented, Slider, UseButton } from '../components/ui'

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

export default function NoiseLab() {
  const { current, original, call } = useApp()
  const [type, setType] = useState('saltpepper')
  const [mean, setMean] = useState(0)
  const [variance, setVariance] = useState(0.01)
  const [density, setDensity] = useState(0.05)
  const [speckleVar, setSpeckleVar] = useState(0.04)
  const [view, setView] = useState('noisy')
  const [res, setRes] = useState(null)

  const apply = async () => {
    const params = { id: current, type, mean, variance: type === 'speckle' ? speckleVar : variance, density }
    const d = await call('noise', params, { label: `imnoise ${type}` })
    if (d) setRes({ ...d, type })
  }

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
        <div className="grid-2">
          <ImageView id={original} title="Original" height={380} />
          <ImageView
            id={res ? (view === 'noisy' ? res.id : res.diffId) : null}
            title={res ? (view === 'noisy' ? 'Noisy' : '|Noisy − Original| × 3') : 'Noisy'}
            emptyText="Choose a noise model and press Add noise"
            height={380}
            actions={res && (
              <>
                <Segmented value={view} onChange={setView} options={[{ value: 'noisy', label: 'Noisy' }, { value: 'diff', label: 'Difference' }]} />
                <UseButton id={res.id} label={`Added ${res.type} noise`} />
              </>
            )}
          />
        </div>
        {res && <Note>Next: send the noisy image to the <b>Workspace</b>, then remove the noise in <a href="#filters">Spatial Filters</a> or rank all filters in <a href="#compare">Filter Comparison</a>.</Note>}
      </div>
    </LabPage>
  )
}
