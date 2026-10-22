import { useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import ImagePair from '../components/ImagePair'
import LabPage from '../components/LabPage'
import { Card, ImageView, LineChart, Metrics, Note, Segmented, Slider, Tabs, UseButton } from '../components/ui'

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

const HU = ['φ₁', 'φ₂', 'φ₃', 'φ₄', 'φ₅', 'φ₆', 'φ₇']

// Boundary and regional descriptors of one region (describeRegion)
function Descriptors({ d, tolerance, setTolerance, redo }) {
  const [tab, setTab] = useState('signature')
  const fds = asArray(d.fourier)
  const tex = d.texture
  return (
    <Card title={`Shape descriptors · region ${d.region}`}>
      <Tabs tabs={[
        { key: 'signature', label: 'Signature' }, { key: 'polygon', label: 'Polygon' }, { key: 'skeleton', label: 'Skeleton' },
        { key: 'fourier', label: 'Fourier descriptors' }, { key: 'moments', label: 'Moments' }, { key: 'texture', label: 'Texture' },
      ]} active={tab} onChange={setTab} />
      {tab === 'signature' && (
        <div className="stack-sm">
          <LineChart height={180} x={['0°', '359°']} yMin={0} series={[{ values: d.signature.r, label: 'distance r(θ) from the centroid (px)' }]} markers={[90, 180, 270]} />
          <p className="small muted">The 2-D boundary as a 1-D function: distance from the centroid at every angle (counted anticlockwise from east). A circle gives a flat line, a square four equal humps. Rotating the region only shifts the curve; dividing by its maximum removes the size.</p>
        </div>
      )}
      {tab === 'polygon' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <ImageView id={d.polygonId} title={`${d.vertices} vertices`} caption="red = polygon, yellow = vertices" height={260} pixelated inspectable={false} />
          <div className="stack-sm">
            <Slider label="Tolerance (max distance boundary ↔ edge)" value={tolerance} min={0.5} max={15} step={0.5} onChange={setTolerance} onCommit={redo} format={(v) => `${v} px`} />
            <p className="small muted"><b>Splitting</b>: start with the two boundary points farthest apart; on every curve find the point farthest from its chord and make it a vertex when that distance exceeds the tolerance. A smaller tolerance gives more vertices and a closer fit ({d.boundaryPoints} boundary points).</p>
          </div>
        </div>
      )}
      {tab === 'skeleton' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <ImageView id={d.skeletonId} title={`Skeleton · ${d.skeletonPixels} pixels`} height={260} pixelated inspectable={false} />
          <div>
            <div className="formula">{'S(A) = ∪ₖ Sₖ(A)\nSₖ(A) = (A ⊖ kB) − (A ⊖ kB) ∘ B'}</div>
            <p className="small muted mt-sm">The morphological skeleton: the centres of the largest discs that fit inside the region. It was built from {d.skeletonSteps + 1} erosions with a 3×3 square B. It describes the shape as a "stick figure" but is not guaranteed to be connected.</p>
          </div>
        </div>
      )}
      {tab === 'fourier' && (
        <div className="stack-sm">
          <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(170px, 100%), 1fr))' }}>
            {fds.map((f) => <ImageView key={f.id} id={f.id} title={f.count === d.boundaryPoints ? `all ${f.count}` : `P = ${f.count}`} height={170} pixelated inspectable={false} />)}
          </div>
          <p className="small muted">The boundary points are a complex sequence s(k) = x(k) + j·y(k); its DFT a(u) are the Fourier descriptors. Rebuilding from only the P lowest frequencies keeps the overall shape — fine detail needs the high ones.</p>
          <p className="small">Invariant descriptors |a(u)|/|a(1)|, u = 2…: <span className="mono">{asArray(d.fourierInvariant).map((v) => fmt(v, 3)).join('  ')}</span></p>
        </div>
      )}
      {tab === 'moments' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <table className="data compact">
            <thead><tr><th>Hu invariant</th><th>value</th><th>−sign·log₁₀|φ|</th></tr></thead>
            <tbody>
              {asArray(d.hu).map((v, i) => <tr key={i}><th>{HU[i]}</th><td>{Number(v).toExponential(3)}</td><td>{fmt(asArray(d.huLog)[i], 3)}</td></tr>)}
            </tbody>
          </table>
          <div>
            <table className="data compact">
              <tbody>
                <tr><th>Orientation</th><td>{fmt(d.orientation, 1)}°</td></tr>
                <tr><th>Major axis</th><td>{fmt(d.majorAxis, 1)} px</td></tr>
                <tr><th>Minor axis</th><td>{fmt(d.minorAxis, 1)} px</td></tr>
                <tr><th>Eccentricity</th><td>{fmt(d.eccentricity, 3)}</td></tr>
              </tbody>
            </table>
            <p className="small muted mt-sm">Central moments μ_pq are translation invariant, normalised moments η_pq = μ_pq / μ₀₀^((p+q)/2+1) also scale invariant; Hu's seven combinations are in addition rotation invariant — the same values for a shifted, scaled or rotated copy.</p>
          </div>
        </div>
      )}
      {tab === 'texture' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <table className="data compact">
            <tbody>
              <tr><th>Mean m</th><td>{fmt(tex.mean, 2)}</td></tr>
              <tr><th>Standard deviation σ</th><td>{fmt(tex.std, 2)}</td></tr>
              <tr><th>Smoothness R</th><td>{fmt(tex.smoothness, 4)}</td></tr>
              <tr><th>Third moment μ₃</th><td>{fmt(tex.thirdMoment, 4)}</td></tr>
              <tr><th>Uniformity U</th><td>{fmt(tex.uniformity, 4)}</td></tr>
              <tr><th>Entropy e</th><td>{fmt(tex.entropy, 3)} bits</td></tr>
            </tbody>
          </table>
          <div>
            <div className="formula">{'R = 1 − 1/(1 + σ²)        U = Σ p(z)²\ne = −Σ p(z) log₂ p(z)      μ₃ = Σ (z − m)³ p(z)'}</div>
            <p className="small muted mt-sm">Statistical texture descriptors of the grey levels inside the region. A constant region has R = 0, U = 1 and e = 0; rough, busy textures raise σ, R and the entropy.</p>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function RegionLab() {
  const { current, call, currentLabel } = useApp()
  const [method, setMethod] = useState('otsu')
  const [threshold, setThreshold] = useState(0.5)
  const [invert, setInvert] = useState(false)
  const [minArea, setMinArea] = useState(20)
  const [res, setRes] = useState(null)
  const [sel, setSel] = useState(1)
  const [desc, setDesc] = useState(null)
  const [tolerance, setTolerance] = useState(2)

  const analyse = async () => {
    const params = { id: current, method, threshold, invert, minArea }
    const d = await call('regions', params, { label: 'Tracing region boundaries' })
    if (d) {
      setRes({ ...d, input: current, params })
      setSel(1)
      setDesc(null)
    }
  }
  const regions = asArray(res?.regions)
  const r = regions.find((x) => x.label === sel) || regions[0]
  const describe = async (label = r?.label, tol = tolerance) => {
    if (!res || !label) return
    const d = await call('describeRegion', { ...res.params, region: label, tolerance: tol }, { label: `Descriptors of region ${label}` })
    if (d) setDesc(d)
  }

  const theory = (
    <>
      <p>After segmentation every region is <b>represented</b> (by its boundary or its interior pixels) and <b>described</b> by numbers a computer can compare.</p>
      <h4>Chain codes</h4>
      <p>A boundary is <b>represented</b> by the directions of its steps (Freeman code, 0 = east, counted anticlockwise in 45° steps). It is traced with the Moore-neighbour algorithm from the top-left pixel.</p>
      <div className="formula">first difference  dₖ = (cₖ − cₖ₋₁) mod 8      → rotation invariant{'\n'}shape number = smallest circular rotation of d  → also start-point invariant</div>
      <h4>Region descriptors</h4>
      <div className="formula">area A = number of pixels{'\n'}centroid = (mean x, mean y){'\n'}perimeter P = n_even + √2 · n_odd   (from the chain code){'\n'}circularity = 4πA / P²   (1 for a circle)</div>
      <h4>More boundary descriptors</h4>
      <p className="small"><b>Signature</b>: distance from the centroid as a function of angle. <b>Polygonal approximation</b>: fewest straight edges that stay within a tolerance of the boundary (splitting). <b>Fourier descriptors</b>: the DFT of the boundary written as complex numbers x + jy.</p>
      <h4>Regional descriptors</h4>
      <p className="small"><b>Skeleton</b>: the medial axis — centres of the largest inscribed discs. <b>Moments</b>: Hu's seven invariants, orientation and eccentricity of the equivalent ellipse. <b>Texture</b>: statistical moments of the grey-level histogram inside the region (smoothness, uniformity, entropy).</p>
    </>
  )

  const controls = (
    <>
      <span className="field-label">Binary image</span>
      <Segmented value={method} onChange={setMethod} options={[{ value: 'otsu', label: 'Otsu' }, { value: 'global', label: 'Threshold T' }]} />
      {method === 'global' && <Slider label="Threshold T" value={threshold} min={0.02} max={0.98} step={0.01} onChange={setThreshold} format={(v) => `${v.toFixed(2)} · ${Math.round(v * 255)}`} />}
      <label className="check"><input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} /> Objects are darker than the background</label>
      <Slider label="Ignore regions smaller than" value={minArea} min={1} max={500} step={1} onChange={setMinArea} format={(v) => `${v} px`} />
      <button className="btn btn-primary btn-block" onClick={analyse}>Find & describe regions</button>
      <p className="tiny faint">Shows the 40 largest regions.</p>
    </>
  )

  return (
    <LabPage unit="Unit IV · Representation" title="Region Analysis" subtitle="Trace region boundaries as chain codes and describe each region by its shape, moments and texture."
      theory={theory} controls={controls} panelTitle="Regions"
      code={{ functions: ['chainCode', 'chainCodeDescriptors', 'boundarySignature', 'polygonApprox', 'fourierDescriptors', 'regionMoments', 'textureDescriptors', 'morphSkeleton'], snippets: [{ title: 'Toolbox call', code: "BW = imbinarize(rgb2gray(I));\nB = bwboundaries(BW);        % boundary pixel lists (input for a chain code)\nstats = regionprops(BW, 'Area', 'Centroid', 'Perimeter', 'Eccentricity', 'Orientation');" }] }}>
      {!res ? (
        <div className="stack">
          <div className="grid-2">
            <ImageView id={current} title={`Input · ${currentLabel}`} height={400} />
            <ImageView id={null} title="Regions" height={400} emptyText="Press Find & describe regions" />
          </div>
          <Note>Tip: <b>shapes.png</b> has a few large shapes; <b>unevenlight.png</b> or <b>coins.png</b> have many. Raise the minimum size to ignore specks.</Note>
        </div>
      ) : (
        <div className="stack">
          <Metrics items={[
            { label: `Regions ≥ ${res.minArea} px`, value: res.kept },
            { label: 'Threshold', value: res.threshold != null ? `${Math.round(res.threshold * 255)}` : '—' },
          ]} />
          <ImagePair height={400} modes={['side', 'slider']} pixelated
            left={{ id: res.binaryId, title: 'Binary image' }}
            right={{ id: res.id, title: 'Regions', actions: <UseButton id={res.id} label="Regions" /> }} />
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
                <p className="small faint mt-sm">Click a row for its chain code and shape descriptors. {res.implementation}.</p>
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
                  <button className="btn btn-navy btn-block mt-sm" onClick={() => describe(r.label)}>Signature, polygon, skeleton, moments…</button>
                </Card>
              )}
            </div>
          )}
          {desc && regions.some((g) => g.label === desc.region) && (
            <Descriptors key={desc.region} d={desc} tolerance={tolerance} setTolerance={setTolerance} redo={() => describe(desc.region)} />
          )}
        </div>
      )}
    </LabPage>
  )
}
