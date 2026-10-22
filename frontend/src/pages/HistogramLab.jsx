import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import ImagePair from '../components/ImagePair'
import LabPage from '../components/LabPage'
import { Card, Histogram, ImageView, Note, Segmented, Select, Slider, Tabs, UseButton } from '../components/ui'

const METHODS = {
  none: { label: 'Histogram only', fn: ['imhistManual', 'imageStatistics'], formula: 'h(r_k) = n_k      p(r_k) = n_k / MN', text: 'Counts how many pixels have each grey level. Dark images lean left, bright right, low-contrast images occupy a narrow band.', code: 'imhist(I)\n[counts, x] = imhist(I);' },
  histeq: { label: 'Equalisation', fn: ['histogramEqualization', 'histogramEqualizationManual'], formula: 's_k = (L − 1) · Σ_{j=0..k} p(r_j)', text: 'Maps every grey level through the scaled cumulative distribution (CDF). Frequent levels are spread apart, so contrast increases. Colour images are equalised on the V channel.', code: 'J = histeq(I, 256);' },
  histeqManual: { label: 'Equalisation (manual)', fn: ['histogramEqualizationManual'], formula: 'counts → p = counts/N → cdf = cumsum(p) → map = round(255·cdf)', text: 'The same algorithm written step by step with accumarray, cumsum and a look-up table. The orange curve is the transfer function.', code: "counts  = accumarray(double(G(:))+1, 1, [256 1]);\np       = counts / numel(G);\ncdf     = cumsum(p);\nmapping = round(255 * cdf);\nJ       = mapping(double(G) + 1);" },
  stretch: { label: 'Contrast stretch', fn: ['contrastStretch'], formula: 's = (r − r_min) / (r_max − r_min)', text: 'Linearly maps [low, high] to [0, 1]. Automatic limits saturate 1% of the pixels at each end (stretchlim).', code: 'J = imadjust(I, stretchlim(I), []);' },
  gamma: { label: 'Gamma', fn: ['gammaCorrection'], formula: 's = c · r^γ', text: 'γ < 1 brightens dark regions, γ > 1 darkens. Used for display gamma correction.', code: 'J = I .^ gamma;' },
  log: { label: 'Log', fn: ['logTransform'], formula: 's = c · log(1 + k·r)', text: 'Expands dark values and compresses bright ones — for images with a huge dynamic range.', code: 'J = log(1 + k*I) / log(1 + k);' },
  negative: { label: 'Negative', fn: ['negativeTransform'], formula: 's = (L − 1) − r', text: 'Inverts intensities — makes detail in dark regions easier to see.', code: 'J = imcomplement(I);' },
  match: { label: 'Histogram matching', fn: ['histogramMatching', 'targetHistogram'], formula: 's = T(r) = (L−1)·CDF_r(r)      G(z) = (L−1)·CDF_z(z)      z = G⁻¹(T(r))', text: 'Specification: instead of a flat histogram, the image is mapped to a DESIRED histogram shape (green dashed curve) or to the histogram of a reference image. Both histograms are equalised, then the target equalisation is inverted.', code: "J = histeq(I, hgram);          % hgram = desired histogram\nJ = imhistmatch(I, refImage);  % or match another image" },
  piecewise: { label: 'Piecewise linear', fn: ['piecewiseLinear'], formula: '(0,0) → (r₁,s₁) → (r₂,s₂) → (L−1, L−1)', text: 'Contrast stretching with a piecewise-linear transfer function through two control points. r₁ = s₁ and r₂ = s₂ leave the image unchanged; s₁ = 0, s₂ = L−1 stretches [r₁, r₂] to the full range; r₁ = r₂ gives a threshold.', code: "J = interp1([0 r1 r2 1], [0 s1 s2 1], I);" },
  slice: { label: 'Gray-level slicing', fn: ['grayLevelSlicing'], formula: 's = L−1 if A ≤ r ≤ B,   otherwise low (binary) or r (preserve)', text: 'Intensity-level slicing highlights one range of grey levels: everything else is either set to a dark level (binary) or kept as it is (preserve). Used for e.g. water in satellite images or vessels in angiograms.', code: "J = G;\nJ(G >= A & G <= B) = 1;          % preserve the rest\n% J = 0.1 + 0.9 * (G >= A & G <= B);   % binary" },
  bitplane: { label: 'Bit-plane slicing', fn: ['bitPlaneSlicing'], formula: 'r = Σ_k b_k · 2^(k−1),   k = 1 (LSB) … 8 (MSB)', text: 'An 8-bit image is the sum of 8 binary bit planes. The high-order planes carry the visually important data; the low-order planes look like noise. Rebuilding from only the top planes shows how many bits are really needed (the idea behind compression).', code: "G = im2uint8(rgb2gray(I));\nfor k = 1:8\n    B{k} = bitget(G, k);   % plane k\nend\nR = double(B{8})*128 + double(B{7})*64;   % top 2 planes" },
}
const SHAPES = [
  { value: 'gaussian', label: 'Gaussian' }, { value: 'bimodal', label: 'Bimodal' }, { value: 'uniform', label: 'Flat (= equalisation)' },
  { value: 'rampup', label: 'Bright ramp' }, { value: 'rampdown', label: 'Dark ramp' }, { value: 'sample', label: 'Reference image…' },
]

export default function HistogramLab() {
  const { current, call } = useApp()
  const [method, setMethod] = useState('histeq')
  const [gamma, setGamma] = useState(0.5)
  const [k, setK] = useState(10)
  const [auto, setAuto] = useState(true)
  const [low, setLow] = useState(0.2)
  const [high, setHigh] = useState(0.8)
  const [shape, setShape] = useState('gaussian')
  const [tMean, setTMean] = useState(0.5)
  const [tStd, setTStd] = useState(0.15)
  const [refSample, setRefSample] = useState('peppers.png')
  const [samples, setSamples] = useState([])
  const [pts, setPts] = useState({ r1: 0.3, s1: 0.1, r2: 0.7, s2: 0.9 })
  const [range, setRange] = useState({ a: 0.4, b: 0.6 })
  const [sliceMode, setSliceMode] = useState('binary')
  const [keep, setKeep] = useState([5, 6, 7, 8])
  const [bits, setBits] = useState(null)
  const [res, setRes] = useState(null)
  const [tab, setTab] = useState('images')
  const m = METHODS[method]

  useEffect(() => {
    if (method === 'match' && shape === 'sample' && !samples.length) {
      call('samples', {}, { quiet: true }).then((d) => d && setSamples(asArray(d)))
    }
  }, [method, shape, samples.length, call])

  const runBits = async (k = keep) => {
    const d = await call('bitPlanes', { id: current, keep: k }, { label: 'Bit-plane slicing' })
    if (d) setBits({ ...d, input: current, keep: k })
  }
  const toggleBit = (k) => {
    const next = keep.includes(k) ? keep.filter((x) => x !== k) : [...keep, k].sort()
    if (!next.length) return
    setKeep(next)
    if (bits) runBits(next)
  }

  const apply = async () => {
    if (method === 'bitplane') return runBits()
    const params = { id: current, method, gamma, k }
    if (method === 'stretch' && !auto) Object.assign(params, { low, high })
    if (method === 'match') Object.assign(params, { shape, targetMean: tMean, targetStd: tStd, refSample })
    if (method === 'piecewise') Object.assign(params, pts)
    if (method === 'slice') Object.assign(params, range, { sliceMode })
    const d = await call('histogram', params, { label: m.label })
    if (d) setRes({ ...d, method, input: current })
  }

  const stats = (s) => [['Mean', s.mean], ['Variance', s.variance], ['Std deviation', s.std], ['Entropy (bits)', s.entropy], ['Min / Max', `${s.min} / ${s.max}`]]

  const theory = (
    <>
      <p>The histogram shows how the grey levels are distributed. Processing it changes the contrast of the whole image with a single <b>transfer function</b> s = T(r).</p>
      <h4>{m.label}</h4>
      <div className="formula">{m.formula}</div>
      <p>{m.text}</p>
      <p className="small">Statistics: the mean measures brightness, the standard deviation measures contrast and the entropy −Σ p log₂ p measures the information per pixel (max 8 bits).</p>
      <h4>Intensity transformations</h4>
      <p className="small">Negative, log, gamma (power-law), piecewise-linear stretching, gray-level slicing and bit-plane slicing are all <b>point operations</b> s = T(r): each output pixel depends only on the input pixel at the same place. Equalisation and matching are point operations too — their T is computed from the histogram.</p>
    </>
  )

  const controls = (
    <>
      <div className="choice-list">
        {Object.entries(METHODS).map(([key, v]) => (
          <button key={key} className={`choice ${method === key ? 'active' : ''}`} onClick={() => setMethod(key)}>{v.label}</button>
        ))}
      </div>
      {method === 'gamma' && <Slider label="Gamma γ" value={gamma} min={0.1} max={3} step={0.05} onChange={setGamma} />}
      {method === 'log' && <Slider label="k" value={k} min={1} max={100} step={1} onChange={setK} />}
      {method === 'match' && (
        <>
          <Select label="Desired histogram" value={shape} onChange={setShape} options={SHAPES} />
          {(shape === 'gaussian' || shape === 'bimodal') && (
            <>
              <Slider label={shape === 'bimodal' ? 'Peak position' : 'Mean'} value={tMean} min={0.05} max={0.95} step={0.01} onChange={setTMean} format={(v) => Math.round(v * 255)} />
              <Slider label="Spread σ" value={tStd} min={0.02} max={0.4} step={0.01} onChange={setTStd} format={(v) => Math.round(v * 255)} />
            </>
          )}
          {shape === 'sample' && (
            <Select label="Reference image" value={refSample} onChange={setRefSample}
              options={(samples.length ? samples : [{ name: refSample }]).map((x) => ({ value: x.name, label: x.name }))} />
          )}
        </>
      )}
      {method === 'piecewise' && (
        <>
          <Slider label="r₁ (input)" value={pts.r1} min={0} max={1} step={0.01} onChange={(v) => setPts((x) => ({ ...x, r1: Math.min(v, x.r2) }))} format={(v) => Math.round(v * 255)} />
          <Slider label="s₁ (output)" value={pts.s1} min={0} max={1} step={0.01} onChange={(v) => setPts((x) => ({ ...x, s1: v }))} format={(v) => Math.round(v * 255)} />
          <Slider label="r₂ (input)" value={pts.r2} min={0} max={1} step={0.01} onChange={(v) => setPts((x) => ({ ...x, r2: Math.max(v, x.r1) }))} format={(v) => Math.round(v * 255)} />
          <Slider label="s₂ (output)" value={pts.s2} min={0} max={1} step={0.01} onChange={(v) => setPts((x) => ({ ...x, s2: v }))} format={(v) => Math.round(v * 255)} />
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-small" onClick={() => setPts({ r1: 0.3, s1: 0, r2: 0.7, s2: 1 })}>Stretch</button>
            <button className="btn btn-small" onClick={() => setPts({ r1: 0.5, s1: 0, r2: 0.5, s2: 1 })}>Threshold</button>
            <button className="btn btn-small" onClick={() => setPts({ r1: 0.3, s1: 0.3, r2: 0.7, s2: 0.7 })}>Identity</button>
          </div>
        </>
      )}
      {method === 'slice' && (
        <>
          <Slider label="Range from A" value={range.a} min={0} max={1} step={0.01} onChange={(v) => setRange((x) => ({ ...x, a: Math.min(v, x.b) }))} format={(v) => Math.round(v * 255)} />
          <Slider label="Range to B" value={range.b} min={0} max={1} step={0.01} onChange={(v) => setRange((x) => ({ ...x, b: Math.max(v, x.a) }))} format={(v) => Math.round(v * 255)} />
          <Segmented value={sliceMode} onChange={setSliceMode} options={[{ value: 'binary', label: 'Binary' }, { value: 'preserve', label: 'Preserve rest' }]} />
        </>
      )}
      {method === 'bitplane' && (
        <>
          <span className="field-label">Planes used for the reconstruction</span>
          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            {[8, 7, 6, 5, 4, 3, 2, 1].map((b) => (
              <button key={b} className={`btn btn-small ${keep.includes(b) ? 'btn-navy' : ''}`} onClick={() => toggleBit(b)}>{b}</button>
            ))}
          </div>
          <p className="tiny faint">8 = most significant bit (value 128), 1 = least significant (value 1).</p>
        </>
      )}
      {method === 'stretch' && (
        <>
          <Segmented value={auto ? 'auto' : 'manual'} onChange={(v) => setAuto(v === 'auto')} options={[{ value: 'auto', label: 'Auto' }, { value: 'manual', label: 'Manual' }]} />
          {!auto && (
            <>
              <Slider label="Low input" value={low} min={0} max={0.95} step={0.01} onChange={(v) => setLow(Math.min(v, high - 0.01))} />
              <Slider label="High input" value={high} min={0.05} max={1} step={0.01} onChange={(v) => setHigh(Math.max(v, low + 0.01))} />
            </>
          )}
        </>
      )}
      <button className="btn btn-primary btn-block" onClick={apply}>Apply</button>
    </>
  )

  return (
    <LabPage animation="histeq" unit="Unit II · Enhancement" title="Histogram Lab" subtitle="Reshape the grey-level distribution and apply intensity transformations s = T(r)."
      theory={theory} controls={controls} panelTitle="Method"
      code={{ functions: m.fn, snippets: [{ title: 'MATLAB', code: m.code }] }}>
      {method === 'bitplane' ? (
        !bits ? (
          <div className="grid-2">
            <ImageView id={current} title="Original" height={400} />
            <ImageView id={null} title="Bit planes" height={400} emptyText="Press Apply to split the image into 8 bit planes" />
          </div>
        ) : (
          <div className="stack">
            <ImagePair height={360}
              left={{ id: bits.input, title: 'Original (8 bits)' }}
              right={{ id: bits.id, title: `Planes ${asArray(bits.keep).slice().sort((a, b) => b - a).join(', ')}`, badge: bits.psnr == null ? '∞' : `${fmt(bits.psnr, 1)} dB`,
                actions: <UseButton id={bits.id} label={`Bit planes ${asArray(bits.keep).join(',')}`} /> }} />
            <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))' }}>
              {asArray(bits.planes).map((id, i) => ({ id, k: i + 1 })).reverse().map(({ id, k: b }) => (
                <ImageView key={id} id={id} title={`Bit plane ${b}${b === 8 ? ' (MSB)' : b === 1 ? ' (LSB)' : ''}`} caption={`value ${2 ** (b - 1)} · ${fmt(asArray(bits.ones)[b - 1], 1)}% ones`} height={170} pixelated />
              ))}
            </div>
          </div>
        )
      ) : !res ? (
        <div className="stack">
          <div className="grid-2">
            <ImageView id={current} title="Original" height={400} />
            <ImageView id={null} title="Enhanced" height={400} emptyText="Choose a method and press Apply" />
          </div>
          <Note>Tip: the <b>lowcontrast.png</b> sample shows equalisation best.</Note>
        </div>
      ) : (
        <>
          <Tabs tabs={[{ key: 'images', label: 'Images' }, { key: 'hist', label: 'Histograms' }, { key: 'stats', label: 'Statistics' }]} active={tab} onChange={setTab} />
          {tab === 'images' && (
            <ImagePair height={420}
              left={{ id: res.input, title: 'Original' }}
              right={{ id: res.id, title: METHODS[res.method].label,
                actions: res.method !== 'none' && <UseButton id={res.id} label={METHODS[res.method].label} /> }} />
          )}
          {tab === 'hist' && (
            <div className="grid-2">
              <Card title="Original"><Histogram counts={res.histBefore} height={200} /></Card>
              <Card title="Enhanced">
                <Histogram counts={res.histAfter} color="#22a565" height={200} mapping={res.mapping} target={res.target} />
                {res.mapping && <p className="small faint mt-sm">Orange curve: the transfer function s = T(r).{res.target ? ' Green dashed: the desired histogram.' : ''}</p>}
              </Card>
            </div>
          )}
          {tab === 'stats' && (
            <Card>
              <table className="data">
                <thead><tr><th>Measure</th><th>Original</th><th>Enhanced</th></tr></thead>
                <tbody>
                  {stats(res.statsBefore).map(([l, v], i) => (
                    <tr key={l}><td>{l}</td><td>{fmt(v, 2)}</td><td><b>{fmt(stats(res.statsAfter)[i][1], 2)}</b></td></tr>
                  ))}
                </tbody>
              </table>
              <p className="small faint mt-sm">Implementation: {res.implementation}</p>
              {res.statsAfter.std > res.statsBefore.std + 1 && res.method !== 'none' && (
                <Note kind="ok">Contrast increased — the standard deviation rose from {fmt(res.statsBefore.std, 1)} to {fmt(res.statsAfter.std, 1)}.</Note>
              )}
            </Card>
          )}
        </>
      )}
    </LabPage>
  )
}
