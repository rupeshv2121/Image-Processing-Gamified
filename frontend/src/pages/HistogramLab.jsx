import { useState } from 'react'
import { useApp } from '../AppContext'
import { fmt } from '../api'
import LabPage from '../components/LabPage'
import { Card, Histogram, ImageView, Note, Segmented, Slider, Tabs, UseButton } from '../components/ui'

const METHODS = {
  none: { label: 'Histogram only', fn: ['imhistManual', 'imageStatistics'], formula: 'h(r_k) = n_k      p(r_k) = n_k / MN', text: 'Counts how many pixels have each grey level. Dark images lean left, bright right, low-contrast images occupy a narrow band.', code: 'imhist(I)\n[counts, x] = imhist(I);' },
  histeq: { label: 'Equalisation', fn: ['histogramEqualization', 'histogramEqualizationManual'], formula: 's_k = (L − 1) · Σ_{j=0..k} p(r_j)', text: 'Maps every grey level through the scaled cumulative distribution (CDF). Frequent levels are spread apart, so contrast increases. Colour images are equalised on the V channel.', code: 'J = histeq(I, 256);' },
  histeqManual: { label: 'Equalisation (manual)', fn: ['histogramEqualizationManual'], formula: 'counts → p = counts/N → cdf = cumsum(p) → map = round(255·cdf)', text: 'The same algorithm written step by step with accumarray, cumsum and a look-up table. The orange curve is the transfer function.', code: "counts  = accumarray(double(G(:))+1, 1, [256 1]);\np       = counts / numel(G);\ncdf     = cumsum(p);\nmapping = round(255 * cdf);\nJ       = mapping(double(G) + 1);" },
  clahe: { label: 'CLAHE', fn: ['clahe', 'claheManual'], formula: 'equalise tiles · clip at limit · bilinear interpolation', text: 'Contrast-Limited Adaptive Histogram Equalisation: equalises small tiles separately and clips each tile histogram so noise is not over-amplified.', code: "J = adapthisteq(I, 'NumTiles', [8 8], 'ClipLimit', 0.01);" },
  stretch: { label: 'Contrast stretch', fn: ['contrastStretch'], formula: 's = (r − r_min) / (r_max − r_min)', text: 'Linearly maps [low, high] to [0, 1]. Automatic limits saturate 1% of the pixels at each end (stretchlim).', code: 'J = imadjust(I, stretchlim(I), []);' },
  gamma: { label: 'Gamma', fn: ['gammaCorrection'], formula: 's = c · r^γ', text: 'γ < 1 brightens dark regions, γ > 1 darkens. Used for display gamma correction.', code: 'J = I .^ gamma;' },
  log: { label: 'Log', fn: ['logTransform'], formula: 's = c · log(1 + k·r)', text: 'Expands dark values and compresses bright ones — for images with a huge dynamic range.', code: 'J = log(1 + k*I) / log(1 + k);' },
  negative: { label: 'Negative', fn: ['negativeTransform'], formula: 's = (L − 1) − r', text: 'Inverts intensities — makes detail in dark regions easier to see.', code: 'J = imcomplement(I);' },
}

export default function HistogramLab() {
  const { current, call } = useApp()
  const [method, setMethod] = useState('histeq')
  const [gamma, setGamma] = useState(0.5)
  const [k, setK] = useState(10)
  const [tiles, setTiles] = useState(8)
  const [clip, setClip] = useState(0.01)
  const [auto, setAuto] = useState(true)
  const [low, setLow] = useState(0.2)
  const [high, setHigh] = useState(0.8)
  const [res, setRes] = useState(null)
  const [tab, setTab] = useState('images')
  const m = METHODS[method]

  const apply = async () => {
    const params = { id: current, method, gamma, k, tiles, clipLimit: clip }
    if (method === 'stretch' && !auto) Object.assign(params, { low, high })
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
      {method === 'clahe' && (
        <>
          <Slider label="Tiles" value={tiles} min={2} max={16} onChange={setTiles} format={(v) => `${v}×${v}`} />
          <Slider label="Clip limit" value={clip} min={0.001} max={0.1} step={0.001} onChange={setClip} />
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
    <LabPage unit="Unit II · Enhancement" title="Histogram Lab" subtitle="Reshape the grey-level distribution to improve contrast."
      theory={theory} controls={controls} panelTitle="Method"
      code={{ functions: m.fn, snippets: [{ title: 'MATLAB', code: m.code }] }}>
      {!res ? (
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
            <div className="grid-2">
              <ImageView id={res.input} title="Original" height={420} />
              <ImageView id={res.id} title={METHODS[res.method].label} height={420}
                actions={res.method !== 'none' && <UseButton id={res.id} label={METHODS[res.method].label} />} />
            </div>
          )}
          {tab === 'hist' && (
            <div className="grid-2">
              <Card title="Original"><Histogram counts={res.histBefore} height={200} /></Card>
              <Card title="Enhanced">
                <Histogram counts={res.histAfter} color="#22a565" height={200} mapping={res.mapping} />
                {res.mapping && <p className="small faint mt-sm">Orange curve: the transfer function s = T(r).</p>}
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
