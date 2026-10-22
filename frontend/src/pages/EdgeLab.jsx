import { useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import LabPage from '../components/LabPage'
import { BarChart, Card, ImageView, Metrics, Note, Segmented, Select, Slider, Tabs, UseButton } from '../components/ui'

const METHODS = [
  { key: 'roberts', label: 'Roberts', text: '2×2 diagonal differences. Fast and sharp, but very noise-sensitive.' },
  { key: 'prewitt', label: 'Prewitt', text: '3×3 first derivative with equal weights.' },
  { key: 'sobel', label: 'Sobel', text: '3×3 first derivative with 1-2-1 weights (built-in smoothing).' },
  { key: 'log', label: 'LoG', text: 'Laplacian of Gaussian: zero crossings of the smoothed second derivative.' },
  { key: 'canny', label: 'Canny', text: 'Gaussian smoothing → gradient → non-maximum suppression → hysteresis (edge linking).' },
]
const label = (k) => METHODS.find((m) => m.key === k)?.label || k

// Edge linking: the Hough transform (global) or similarity of gradient magnitude and angle (local)
function LinkResults({ link }) {
  if (link.method === 'local') {
    return (
      <div className="stack">
        <Metrics items={[
          { label: 'Candidate edge pixels', value: link.candidates.toLocaleString() },
          { label: 'Added by gap filling', value: link.added.toLocaleString() },
          { label: 'Linked edge pixels', value: link.linked.toLocaleString() },
          { label: 'Time', value: `${fmt(link.timeMs, 0)} ms` },
        ]} />
        <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))' }}>
          <ImageView id={link.magId} title="Gradient magnitude M(x,y)" height={280} />
          <ImageView id={link.candidatesId} title="M > T_M and α ≈ A" height={280} />
          <ImageView id={link.overlayId} title="Linked: white = candidates, green = filled gaps" height={280} actions={<UseButton id={link.id} label="Linked edges" />} />
        </div>
      </div>
    )
  }
  const lines = asArray(link.lines)
  return (
    <div className="stack">
      <Metrics items={[
        { label: 'Edge pixels', value: link.edgePixels.toLocaleString() },
        { label: 'Peaks', value: asArray(link.peaks).length },
        { label: 'Line segments', value: lines.length },
        { label: 'Time', value: `${fmt(link.timeMs, 0)} ms` },
      ]} />
      <div className="grid-2">
        <ImageView id={link.edgeId} title="Edge image (input to Hough)" height={320} />
        <ImageView id={link.id} title="Linked line segments" caption="red = segment, yellow = end points" height={320} actions={<UseButton id={link.id} label="Hough lines" />} />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <ImageView id={link.accumulatorId} title="Accumulator H(ρ, θ) — log scale" caption={`θ −90° … 89° across, ρ ${link.rhoRange[0]} … ${link.rhoRange[1]} down · red = peaks`} height={320} />
        <Card title="Strongest lines">
          {lines.length === 0 ? <p className="small muted">No segment is long enough — lower the minimum length or the peak threshold.</p> : (
            <div className="table-scroll">
              <table className="data compact">
                <thead><tr><th>#</th><th>θ</th><th>ρ</th><th>From (x, y)</th><th>To (x, y)</th><th>Length</th></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}><td>{i + 1}</td><td>{l.theta}°</td><td>{l.rho}</td><td>{l.x1}, {l.y1}</td><td>{l.x2}, {l.y2}</td><td>{fmt(l.length, 1)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export default function EdgeLab() {
  const { current, call } = useApp()
  const [selected, setSelected] = useState(['prewitt', 'sobel', 'canny'])
  const [autoT, setAutoT] = useState(true)
  const [thresh, setThresh] = useState(0.08)
  const [sigma, setSigma] = useState(1.4)
  const [manual, setManual] = useState(true)
  const [res, setRes] = useState(null)
  const [tab, setTab] = useState('maps')
  const [gradOp, setGradOp] = useState('sobel')
  const [mode, setMode] = useState('detect')
  const [linkMethod, setLinkMethod] = useState('hough')
  const [detector, setDetector] = useState('canny')
  const [peaks, setPeaks] = useState(8)
  const [peakT, setPeakT] = useState(0.3)
  const [fillGap, setFillGap] = useState(5)
  const [minLength, setMinLength] = useState(20)
  const [tm, setTm] = useState(0.25)
  const [ta, setTa] = useState(30)
  const [gap, setGap] = useState(6)
  const [link, setLink] = useState(null)

  const runLink = async () => {
    const params = linkMethod === 'hough'
      ? { id: current, method: 'hough', detector, peaks, threshold: peakT, fillGap, minLength, sigma }
      : { id: current, method: 'local', magnitude: tm, angle: ta, gap }
    const d = await call('edgeLink', params, { label: linkMethod === 'hough' ? 'Hough transform' : 'Local edge linking' })
    if (d) setLink(d)
  }

  const toggle = (k) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  const apply = async () => {
    const ordered = METHODS.map((m) => m.key).filter((k) => selected.includes(k))
    const d = await call('edges', { id: current, methods: ordered, thresh: autoT ? null : thresh, sigma, manualGradients: manual }, { label: 'edge()' })
    if (d) {
      setRes({ ...d, input: current })
      setTab('maps')
    }
  }
  const results = asArray(res?.results)

  const theory = (
    <>
      <p>An <b>edge</b> is a place where intensity changes abruptly. First-derivative operators threshold the gradient magnitude; second-derivative operators look for zero crossings.</p>
      <div className="formula">|∇f| = √(gx² + gy²)      edge where |∇f| &gt; T</div>
      {METHODS.map((m) => <p key={m.key} className="small"><b>{m.label}</b> — {m.text}</p>)}
      <h4>Edge linking and boundary detection</h4>
      <p className="small">Edge detectors return broken edges (noise, uneven light). <b>Linking</b> assembles them into meaningful boundaries.</p>
      <p className="small"><b>Local processing</b>: two neighbouring edge pixels are linked when their gradient magnitudes and directions are similar. The simplified algorithm keeps pixels with M(x,y) &gt; T_M and α(x,y) within ±T_A of a direction A, then fills gaps of at most K pixels along the rows (A = 90°, horizontal edges) and the columns (A = 0°, vertical edges).</p>
      <p className="small"><b>Global processing — the Hough transform</b>: every line is written as ρ = x·cos θ + y·sin θ. Each edge pixel votes for all (ρ, θ) of the lines through it — one sinusoid in parameter space. Collinear pixels vote for the same cell, so the peaks of the accumulator are the lines. Pixels on a peak line are then linked, bridging gaps up to a set length.</p>
      <div className="formula">ρ = x cos θ + y sin θ,     −90° ≤ θ &lt; 90°,   −D ≤ ρ ≤ D</div>
    </>
  )

  const linkControls = (
    <>
      <Segmented value={linkMethod} onChange={setLinkMethod} options={[{ value: 'hough', label: 'Hough transform' }, { value: 'local', label: 'Local linking' }]} />
      {linkMethod === 'hough' ? (
        <>
          <Select label="Edge detector" value={detector} onChange={setDetector} options={METHODS.map((m) => ({ value: m.key, label: m.label }))} />
          <Slider label="Number of peaks" value={peaks} min={1} max={20} step={1} onChange={setPeaks} />
          <Slider label="Peak threshold (× max votes)" value={peakT} min={0.05} max={0.9} step={0.05} onChange={setPeakT} />
          <Slider label="Fill gaps up to" value={fillGap} min={1} max={40} step={1} onChange={setFillGap} format={(v) => `${v} px`} />
          <Slider label="Minimum segment length" value={minLength} min={5} max={200} step={5} onChange={setMinLength} format={(v) => `${v} px`} />
        </>
      ) : (
        <>
          <Slider label="Magnitude threshold T_M (× max)" value={tm} min={0.05} max={0.8} step={0.05} onChange={setTm} />
          <Slider label="Angle tolerance T_A" value={ta} min={5} max={45} step={5} onChange={setTa} format={(v) => `±${v}°`} />
          <Slider label="Longest gap filled K" value={gap} min={1} max={25} step={1} onChange={setGap} format={(v) => `${v} px`} />
        </>
      )}
      <button className="btn btn-primary btn-block" onClick={runLink}>Link edges</button>
      <p className="tiny faint">Tip: shapes.png or lines.png have clear straight lines.</p>
    </>
  )

  const controls = mode === 'link' ? linkControls : (
    <>
      <div className="choice-list">
        {METHODS.map((m) => (
          <button key={m.key} className={`choice ${selected.includes(m.key) ? 'active' : ''}`} onClick={() => toggle(m.key)}>
            {selected.includes(m.key) ? '☑' : '☐'} {m.label}
          </button>
        ))}
      </div>
      <label className="check"><input type="checkbox" checked={autoT} onChange={(e) => setAutoT(e.target.checked)} /> Automatic threshold</label>
      {!autoT && <Slider label="Threshold" value={thresh} min={0.01} max={0.5} step={0.005} onChange={setThresh} />}
      {(selected.includes('canny') || selected.includes('log')) && <Slider label="σ (Canny / LoG)" value={sigma} min={0.5} max={4} step={0.1} onChange={setSigma} />}
      <label className="check"><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Manual gradient images</label>
      <button className="btn btn-primary btn-block" onClick={apply} disabled={!selected.length}>Detect edges</button>
    </>
  )

  return (
    <LabPage unit="Unit IV · Segmentation" title="Edge Detection" subtitle="Find intensity discontinuities, compare the classic detectors and link edges into boundaries."
      theory={theory} controls={<><Segmented value={mode} onChange={setMode} options={[{ value: 'detect', label: 'Detect' }, { value: 'link', label: 'Link edges' }]} />{controls}</>}
      panelTitle={mode === 'link' ? 'Edge linking' : 'Detectors'}
      code={mode === 'link'
        ? { functions: ['houghTransform', 'houghPeaks', 'houghLines', 'localEdgeLinking'], snippets: [{ title: 'Toolbox call', code: "BW = edge(rgb2gray(I), 'canny');\n[H, theta, rho] = hough(BW);\nP = houghpeaks(H, 8, 'Threshold', 0.3 * max(H(:)));\nlines = houghlines(BW, theta, rho, P, 'FillGap', 5, 'MinLength', 20);" }] }
        : { functions: ['edgeDetect', 'sobelManual', 'prewittManual', 'robertsManual', 'cannyManual', 'logEdgeManual'], snippets: [{ title: 'Toolbox call', code: "G = rgb2gray(I);\nE1 = edge(G, 'sobel');\nE2 = edge(G, 'prewitt');\nE3 = edge(G, 'roberts');\nE4 = edge(G, 'log');\nE5 = edge(G, 'canny');" }] }}>
      {mode === 'link' ? (
        link ? <LinkResults link={link} /> : (
          <div className="stack">
            <div className="grid-2">
              <ImageView id={current} title="Original" height={420} />
              <ImageView id={null} title="Linked edges" height={420} emptyText="Choose a method and press Link edges" />
            </div>
            <Note>The Hough transform finds <b>straight lines</b> even when the edge pixels on them are far apart; local linking only bridges short gaps between pixels with similar gradients.</Note>
          </div>
        )
      ) : !res ? (
        <div className="grid-2">
          <ImageView id={current} title="Original" height={420} />
          <ImageView id={null} title="Edges" height={420} emptyText="Select detectors and press Detect edges" />
        </div>
      ) : (
        <>
          <Tabs tabs={[{ key: 'maps', label: 'Edge maps' }, { key: 'compare', label: 'Comparison' }, ...(res.manual ? [{ key: 'grad', label: 'Manual gradients' }] : [])]} active={tab} onChange={setTab} />
          {tab === 'maps' && (
            <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))' }}>
              <ImageView id={res.input} title="Original" height={300} />
              {results.map((r) => (
                <ImageView key={r.method} id={r.id} title={label(r.method)} height={300} badge={`${fmt(r.density, 1)}%`} />
              ))}
            </div>
          )}
          {tab === 'compare' && (
            <div className="stack">
              <Card>
                <table className="data">
                  <thead><tr><th>Detector</th><th>Edge pixels</th><th>Density</th><th>Threshold</th><th>Time</th></tr></thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.method}>
                        <td><b>{label(r.method)}</b></td><td>{r.edgePixels.toLocaleString()}</td><td>{fmt(r.density, 2)} %</td>
                        <td>{Array.isArray(r.threshold) ? r.threshold.map((t) => fmt(t, 3)).join(' / ') : fmt(r.threshold, 4)}</td>
                        <td>{fmt(r.timeMs, 1)} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="small faint mt-sm">Implementation: {results[0]?.implementation}</p>
              </Card>
              <div className="grid-2">
                <Card><BarChart title="Edge density (%)" values={results.map((r) => r.density)} labels={results.map((r) => label(r.method))} higherIsBetter={false} /></Card>
                <Card><BarChart title="Processing time (ms)" values={results.map((r) => r.timeMs)} labels={results.map((r) => label(r.method))} higherIsBetter={false} /></Card>
              </div>
            </div>
          )}
          {tab === 'grad' && res.manual && (
            <div className="stack">
              <div className="row between">
                <Segmented value={gradOp} onChange={setGradOp} options={[{ value: 'sobel', label: 'Sobel' }, { value: 'prewitt', label: 'Prewitt' }]} />
                <span className="small muted">Computed with explicit loops in {fmt(res.manual[gradOp].timeMs, 0)} ms</span>
              </div>
              <div className="grid-3">
                <ImageView id={res.manual[gradOp].gx} title="gx — vertical edges" height={260} />
                <ImageView id={res.manual[gradOp].gy} title="gy — horizontal edges" height={260} />
                <ImageView id={res.manual[gradOp].mag} title="|∇f| magnitude" height={260} />
              </div>
            </div>
          )}
        </>
      )}
    </LabPage>
  )
}
