import { useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import ImagePair from '../components/ImagePair'
import LabPage from '../components/LabPage'
import { Card, ImageView, Metrics, Note, Segmented, Slider, UseButton } from '../components/ui'

// Freeman directions, laid out like the 8-neighbourhood
const COMPASS = [[3, 2, 1], [4, null, 0], [5, 6, 7]]
const ARROWS = { 0: '→', 1: '↗', 2: '↑', 3: '↖', 4: '←', 5: '↙', 6: '↓', 7: '↘' }

function ChainCode({ label, value, length }) {
  return (
    <div className="chain">
      <div className="field-label">{label}{length != null && <b>{length} steps</b>}</div>
      <div className="chain-code mono">{value || '—'}</div>
    </div>
  )
}

export default function RegionLab() {
  const { current, call, currentLabel } = useApp()
  const [method, setMethod] = useState('otsu')
  const [threshold, setThreshold] = useState(0.5)
  const [invert, setInvert] = useState(false)
  const [conn, setConn] = useState(8)
  const [minArea, setMinArea] = useState(20)
  const [res, setRes] = useState(null)
  const [sel, setSel] = useState(1)

  const analyse = async () => {
    const d = await call('regions', { id: current, method, threshold, invert, conn, minArea }, { label: `Labelling (${conn}-connectivity)` })
    if (d) {
      setRes({ ...d, input: current })
      setSel(1)
    }
  }
  const regions = asArray(res?.regions)
  const r = regions.find((x) => x.label === sel) || regions[0]

  const theory = (
    <>
      <p><b>Connected-component labelling</b> gives every connected group of object pixels its own number. Whether two diagonal pixels belong together depends on the <b>connectivity</b>: 4-connectivity only links horizontal/vertical neighbours (N4), 8-connectivity also links diagonals (N8) — so the same image can have more regions under 4-connectivity.</p>
      <p>The algorithm (labelComponents.m) is a breadth-first flood fill: scan the image, start a new label at every unlabelled object pixel and spread it to all connected neighbours with a queue.</p>
      <h4>Chain codes</h4>
      <p>A boundary is <b>represented</b> by the directions of its steps (Freeman code, 0 = east, counted anticlockwise in 45° steps). It is traced with the Moore-neighbour algorithm from the top-left pixel.</p>
      <div className="formula">first difference  dₖ = (cₖ − cₖ₋₁) mod 8      → rotation invariant{'\n'}shape number = smallest circular rotation of d  → also start-point invariant</div>
      <h4>Region descriptors</h4>
      <div className="formula">area A = number of pixels{'\n'}centroid = (mean x, mean y){'\n'}perimeter P = n_even + √2 · n_odd   (from the chain code){'\n'}circularity = 4πA / P²   (1 for a circle)</div>
    </>
  )

  const controls = (
    <>
      <span className="field-label">Binary image</span>
      <Segmented value={method} onChange={setMethod} options={[{ value: 'otsu', label: 'Otsu' }, { value: 'global', label: 'Threshold T' }]} />
      {method === 'global' && <Slider label="Threshold T" value={threshold} min={0.02} max={0.98} step={0.01} onChange={setThreshold} format={(v) => `${v.toFixed(2)} · ${Math.round(v * 255)}`} />}
      <label className="check"><input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} /> Objects are darker than the background</label>
      <span className="field-label">Connectivity</span>
      <Segmented value={conn} onChange={setConn} options={[{ value: 4, label: '4-connected' }, { value: 8, label: '8-connected' }]} />
      <Slider label="Ignore regions smaller than" value={minArea} min={1} max={500} step={1} onChange={setMinArea} format={(v) => `${v} px`} />
      <button className="btn btn-primary btn-block" onClick={analyse}>Label & describe regions</button>
      <p className="tiny faint">Shows the 40 largest regions. Run with both connectivities to compare.</p>
    </>
  )

  return (
    <LabPage unit="Unit IV · Representation" title="Region Analysis" subtitle="Label connected regions, trace their boundaries as chain codes and measure area, perimeter and centroid."
      theory={theory} controls={controls} panelTitle="Regions"
      code={{ functions: ['labelComponents', 'chainCode', 'chainCodeDescriptors', 'regionProperties'], snippets: [{ title: 'Toolbox call', code: `BW = imbinarize(rgb2gray(I));\n[L, n] = bwlabel(BW, ${conn});\nstats = regionprops(L, 'Area', 'Centroid', 'BoundingBox', 'Perimeter');\nB = bwboundaries(BW, ${conn});   % boundary pixel lists (input for a chain code)` }] }}>
      {!res ? (
        <div className="stack">
          <div className="grid-2">
            <ImageView id={current} title={`Input · ${currentLabel}`} height={400} />
            <ImageView id={null} title="Labelled regions" height={400} emptyText="Press Label & describe regions" />
          </div>
          <Note>Tip: <b>shapes.png</b> has a few large shapes; <b>unevenlight.png</b> or <b>coins.png</b> have many. Use <a href="#morphology">Morphology</a> first to separate touching objects or remove specks.</Note>
        </div>
      ) : (
        <div className="stack">
          <Metrics items={[
            { label: `Components (${res.conn}-conn.)`, value: res.components },
            { label: `≥ ${res.minArea} px`, value: res.kept },
            { label: 'Threshold', value: res.threshold != null ? `${Math.round(res.threshold * 255)}` : '—' },
            { label: 'Labelling time', value: `${fmt(res.labelTimeMs, 1)} ms` },
          ]} />
          <ImagePair height={400} modes={['side', 'slider']} pixelated
            left={{ id: res.binaryId, title: 'Binary image' }}
            right={{ id: res.id, title: 'Labelled regions', actions: <UseButton id={res.id} label="Labelled regions" /> }} />
          {regions.length === 0 ? <Note kind="warn">No region is at least {res.minArea} pixels. Lower the minimum size or change the threshold.</Note> : (
            <div className="region-grid">
              <Card title={`Regions (${res.shown}${res.kept > res.shown ? ` of ${res.kept}` : ''})`}>
                <div className="table-scroll">
                  <table className="data clickable">
                    <thead><tr><th>#</th><th>Area</th><th>Centroid (x, y)</th><th>Box</th><th>Perimeter</th><th>Circularity</th></tr></thead>
                    <tbody>
                      {regions.map((g) => (
                        <tr key={g.label} className={g.label === r?.label ? 'best' : ''} tabIndex={0} aria-selected={g.label === r?.label}
                          onClick={() => setSel(g.label)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSel(g.label))}>
                          <td><span className="swatch" style={{ background: g.color }} />{g.label}</td>
                          <td>{g.area.toLocaleString()}</td>
                          <td>{fmt(g.centroidX, 1)}, {fmt(g.centroidY, 1)}</td>
                          <td>{g.bboxWidth}×{g.bboxHeight}</td>
                          <td>{fmt(g.perimeter, 1)}</td>
                          <td>{fmt(g.circularity, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="small faint mt-sm">Click a row for its chain code. {res.implementation}.</p>
              </Card>
              {r && (
                <Card title={<><span className="swatch" style={{ background: r.color }} />Region {r.label}</>}>
                  <div className="region-detail">
                    <ImageView id={r.cropId} title="Close-up" caption="red = traced boundary · yellow = start pixel" height={220} pixelated inspectable={false} />
                    <div>
                      <div className="field-label" style={{ marginBottom: 6 }}>Directions</div>
                      <table className="compass" aria-label="Freeman direction numbers">
                        <tbody>
                          {COMPASS.map((row, i) => (
                            <tr key={i}>{row.map((d, j) => <td key={j}>{d == null ? '•' : <><b>{d}</b><span>{ARROWS[d]}</span></>}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <table className="data compact">
                        <tbody>
                          <tr><th>Area</th><td>{r.area.toLocaleString()} px</td></tr>
                          <tr><th>Start pixel</th><td>row {r.startRow}, col {r.startCol}</td></tr>
                          <tr><th>Perimeter</th><td>{r.nEven} + √2·{r.nOdd} = <b>{fmt(r.perimeter, 2)}</b></td></tr>
                          <tr><th>Boundary pixels</th><td>{r.boundaryPixels}</td></tr>
                          <tr><th>Eq. diameter</th><td>{fmt(r.equivDiameter, 1)} px</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <ChainCode label="Chain code" value={r.chain} length={r.chainLength} />
                  <ChainCode label="First difference" value={r.firstDifference} />
                  <ChainCode label="Shape number" value={r.shapeNumber || (r.chainLength > 1000 ? 'boundary too long (> 1000 steps)' : '')} />
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </LabPage>
  )
}
