import { useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import LabPage from '../components/LabPage'
import { BarChart, Card, ImageView, Segmented, Slider, Tabs } from '../components/ui'

const METHODS = [
  { key: 'roberts', label: 'Roberts', text: '2×2 diagonal differences. Fast and sharp, but very noise-sensitive.' },
  { key: 'prewitt', label: 'Prewitt', text: '3×3 first derivative with equal weights.' },
  { key: 'sobel', label: 'Sobel', text: '3×3 first derivative with 1-2-1 weights (built-in smoothing).' },
  { key: 'log', label: 'LoG', text: 'Laplacian of Gaussian: zero crossings of the smoothed second derivative.' },
  { key: 'canny', label: 'Canny', text: 'Gaussian smoothing → gradient → non-maximum suppression → hysteresis (edge linking).' },
]
const label = (k) => METHODS.find((m) => m.key === k)?.label || k

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
    </>
  )

  const controls = (
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
    <LabPage unit="Unit IV · Segmentation" title="Edge Detection" subtitle="Find intensity discontinuities and compare the classic detectors."
      theory={theory} controls={controls} panelTitle="Detectors"
      code={{ functions: ['edgeDetect', 'sobelManual', 'prewittManual', 'robertsManual', 'cannyManual', 'logEdgeManual'], snippets: [{ title: 'Toolbox call', code: "G = rgb2gray(I);\nE1 = edge(G, 'sobel');\nE2 = edge(G, 'prewitt');\nE3 = edge(G, 'roberts');\nE4 = edge(G, 'log');\nE5 = edge(G, 'canny');" }] }}>
      {!res ? (
        <div className="grid-2">
          <ImageView id={current} title="Original" height={420} />
          <ImageView id={null} title="Edges" height={420} emptyText="Select detectors and press Detect edges" />
        </div>
      ) : (
        <>
          <Tabs tabs={[{ key: 'maps', label: 'Edge maps' }, { key: 'compare', label: 'Comparison' }, ...(res.manual ? [{ key: 'grad', label: 'Manual gradients' }] : [])]} active={tab} onChange={setTab} />
          {tab === 'maps' && (
            <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
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
