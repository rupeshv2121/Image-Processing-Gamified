import { useState } from 'react'
import { useApp } from '../AppContext'
import { fmt, toMatrix } from '../api'
import LabPage from '../components/LabPage'
import { Card, ImageView, KernelGrid, Metrics, Segmented, Slider, UseButton } from '../components/ui'

const METHODS = {
  laplacian: { label: 'Laplacian', detail: 'Laplacian ∇²f', fn: ['laplacianSharpen', 'laplacianKernel'], formula: '∇²f ≈ f(x±1,y) + f(x,y±1) − 4f(x,y)\ng = f − c·∇²f', text: 'The second derivative is zero in flat areas and large at edges. Subtracting it (the kernel centre is negative) steepens every transition.', code: "h = fspecial('laplacian', alpha);\nL = imfilter(I, h, 'replicate');\nS = I - L;" },
  sobel: { label: 'Sobel', detail: 'Gradient |∇f|', fn: ['gradientSharpen', 'sobelManual'], formula: '|∇f| = √(gx² + gy²)\ng = f + w·|∇f|', text: 'First-derivative sharpening: the gradient is large on edges, so adding it brightens them.', code: "gx = imfilter(I, fspecial('sobel')');\ngy = imfilter(I, fspecial('sobel'));\nS = I + w * hypot(gx, gy);" },
  prewitt: { label: 'Prewitt', detail: 'Gradient |∇f|', fn: ['gradientSharpen', 'prewittManual'], formula: '|∇f| = √(gx² + gy²)\ng = f + w·|∇f|', text: 'Gradient sharpening with the equal-weight Prewitt kernels.', code: "gx = imfilter(I, fspecial('prewitt')');\ngy = imfilter(I, fspecial('prewitt'));\nS = I + w * hypot(gx, gy);" },
  unsharp: { label: 'Unsharp mask', detail: 'Mask f − blur(f)', fn: ['unsharpMask', 'gaussianFilter'], formula: 'mask = f − f_blur\ng = f + k·mask', text: 'Blur, subtract to get the detail mask, add it back — a classic darkroom technique.', code: "B = imfilter(I, fspecial('gaussian', 7, sigma));\nS = I + amount * (I - B);" },
  highboost: { label: 'High-boost', detail: 'Mask f − mean(f)', fn: ['highBoostFilter', 'meanFilter'], formula: 'g = f + k·(f − f_mean),   k > 1', text: 'Unsharp masking with k > 1: detail is amplified more strongly while the original is kept.', code: "B = imfilter(I, fspecial('average', 3));\nS = I + k * (I - B);" },
}

export default function SharpeningLab() {
  const { current, call } = useApp()
  const [method, setMethod] = useState('laplacian')
  const [alpha, setAlpha] = useState(0.2)
  const [strength, setStrength] = useState(1)
  const [eight, setEight] = useState(false)
  const [weight, setWeight] = useState(0.5)
  const [sigma, setSigma] = useState(1.5)
  const [amount, setAmount] = useState(1)
  const [boost, setBoost] = useState(2)
  const [view, setView] = useState('sharp')
  const [res, setRes] = useState(null)
  const m = METHODS[method]

  const apply = async () => {
    const d = await call('sharpen', { id: current, method, alpha, strength, eight, weight, sigma, amount, boost, k: 3 }, { label: m.label })
    if (d) setRes({ ...d, method, input: current })
  }

  const theory = (
    <>
      <p>Smoothing averages (integrates); <b>sharpening differentiates</b>. Derivatives are zero in flat regions and large at edges, so adding them back makes detail crisper.</p>
      <h4>{m.label}</h4>
      <div className="formula">{m.formula}</div>
      <p>{m.text}</p>
      <p className="small">Sharpening also amplifies noise — smooth first if the image is noisy.</p>
    </>
  )

  const controls = (
    <>
      <div className="choice-list">
        {Object.entries(METHODS).map(([key, v]) => (
          <button key={key} className={`choice ${method === key ? 'active' : ''}`} onClick={() => setMethod(key)}>{v.label}</button>
        ))}
      </div>
      {method === 'laplacian' && (
        <>
          <label className="check"><input type="checkbox" checked={eight} onChange={(e) => setEight(e.target.checked)} /> 8-neighbour kernel</label>
          {!eight && <Slider label="Shape α" value={alpha} min={0} max={1} step={0.05} onChange={setAlpha} />}
          <Slider label="Strength c" value={strength} min={0.1} max={3} step={0.1} onChange={setStrength} />
        </>
      )}
      {(method === 'sobel' || method === 'prewitt') && <Slider label="Weight w" value={weight} min={0.1} max={2} step={0.05} onChange={setWeight} />}
      {method === 'unsharp' && (
        <>
          <Slider label="Blur σ" value={sigma} min={0.5} max={5} step={0.1} onChange={setSigma} />
          <Slider label="Amount k" value={amount} min={0.2} max={4} step={0.1} onChange={setAmount} />
        </>
      )}
      {method === 'highboost' && <Slider label="Boost k" value={boost} min={1} max={5} step={0.1} onChange={setBoost} />}
      <button className="btn btn-primary btn-block" onClick={apply}>Sharpen</button>
    </>
  )

  return (
    <LabPage unit="Unit II · Enhancement" title="Sharpening Lab" subtitle="Enhance edges and fine detail with first- and second-derivative filters."
      theory={theory} controls={controls} panelTitle="Method"
      code={{ functions: m.fn, snippets: [{ title: 'MATLAB', code: m.code }] }}>
      <div className="stack">
        <div className="grid-2">
          <ImageView id={res?.input || current} title="Original" height={420} />
          <ImageView id={res ? (view === 'sharp' ? res.id : res.detailId) : null} title={res ? (view === 'sharp' ? 'Sharpened' : METHODS[res.method].detail) : 'Sharpened'}
            height={420} emptyText="Choose a method and press Sharpen"
            actions={res && (
              <>
                <Segmented value={view} onChange={setView} options={[{ value: 'sharp', label: 'Result' }, { value: 'detail', label: 'Detail' }]} />
                <UseButton id={res.id} label={`${METHODS[res.method].label} sharpening`} />
              </>
            )} />
        </div>
        {res && (
          <div className="grid-2">
            <Metrics items={[
              { label: 'Mean gradient before', value: res.sharpnessBefore },
              { label: 'Mean gradient after', value: res.sharpnessAfter },
              { label: 'Sharpness gain', value: `${fmt((res.sharpnessAfter / res.sharpnessBefore - 1) * 100, 1)} %` },
            ]} />
            {res.kernel && <Card title="Kernel used"><KernelGrid matrix={toMatrix(res.kernel)} /></Card>}
          </div>
        )}
      </div>
    </LabPage>
  )
}
