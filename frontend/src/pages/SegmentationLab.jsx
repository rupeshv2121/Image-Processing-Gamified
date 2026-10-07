import { useEffect, useRef, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import LabPage from '../components/LabPage'
import { Card, Histogram, ImageView, Metrics, Note, Segmented, Select, Slider, Tabs, UseButton } from '../components/ui'

const METHODS = {
  global: { label: 'Global threshold', fn: ['globalThreshold'], text: 'g = 1 if f > T. Move the slider — MATLAB re-segments immediately.', code: 'BW = G > T;   % or imbinarize(G, T)' },
  iterative: { label: 'Iterative', fn: ['iterativeThreshold'], text: 'T ← (mean above T + mean below T)/2, repeated until T stops changing.', code: 'T = mean(G(:));\nwhile ...\n    T = (mean(G(G>T)) + mean(G(G<=T))) / 2;\nend' },
  otsu: { label: 'Otsu', fn: ['otsuThreshold'], text: 'Chooses T that maximises the between-class variance σ²_B — fully automatic.', code: 'T  = graythresh(G);\nBW = imbinarize(G, T);' },
  adaptive: { label: 'Adaptive', fn: ['adaptiveThreshold'], text: 'A different threshold per pixel: local mean − C. Handles uneven lighting.', code: "BW = imbinarize(G, 'adaptive');" },
  point: { label: 'Point detection', fn: ['pointDetection'], text: 'Mask [−1 −1 −1; −1 8 −1; −1 −1 −1]: strong |R| at isolated points.', code: 'R = imfilter(G, [-1 -1 -1; -1 8 -1; -1 -1 -1]);\nBW = abs(R) >= T * max(abs(R(:)));' },
  line: { label: 'Line detection', fn: ['lineDetection'], text: 'Directional masks respond to 1-pixel-thick lines in one direction.', code: 'K = [-1 -1 -1; 2 2 2; -1 -1 -1];   % horizontal\nR = imfilter(G, K);' },
  regiongrow: { label: 'Region growing', fn: ['regionGrowing'], text: 'Click a seed. Neighbours within the tolerance of the seed value join the region (BFS).', code: "% queue-based flood fill from the seed\nif abs(G(r,c) - seedValue) <= tol\n    BW(r,c) = true;\nend" },
  splitmerge: { label: 'Split & merge', fn: ['splitAndMerge'], text: 'Quadtree split while a block is not homogeneous, then merge similar neighbours.', code: 'S = qtdecomp(G, 0.2);' },
  boundary: { label: 'Boundary', fn: ['extractBoundary', 'otsuThreshold'], text: 'Boundary = A − (A eroded by 3×3): the outline of each region.', code: 'B = bwperim(BW);' },
}
const EXTRA = { adaptive: 'Local mean (threshold surface)', point: '|R| response', line: 'Line response R', splitmerge: 'Regions (mean intensity)' }

export default function SegmentationLab() {
  const { current, call } = useApp()
  const [method, setMethod] = useState('otsu')
  const [threshold, setThreshold] = useState(0.5)
  const [windowSize, setWindowSize] = useState(25)
  const [offset, setOffset] = useState(0.02)
  const [pointT, setPointT] = useState(0.9)
  const [lineT, setLineT] = useState(0.5)
  const [direction, setDirection] = useState('horizontal')
  const [seed, setSeed] = useState(null)
  const [tolerance, setTolerance] = useState(0.1)
  const [stdT, setStdT] = useState(0.05)
  const [mergeT, setMergeT] = useState(0.08)
  const [res, setRes] = useState(null)
  const [tab, setTab] = useState('result')
  const [view, setView] = useState('overlay')
  const inflight = useRef(false)
  const pending = useRef(false)
  const m = METHODS[method]

  const params = () => {
    const p = { id: current, method }
    if (method === 'global') p.threshold = threshold
    if (method === 'adaptive') Object.assign(p, { window: windowSize, offset })
    if (method === 'point') p.threshold = pointT
    if (method === 'line') Object.assign(p, { threshold: lineT, direction })
    if (method === 'regiongrow' && seed) Object.assign(p, { seedRow: seed.row, seedCol: seed.col, tolerance })
    if (method === 'splitmerge') Object.assign(p, { stdThreshold: stdT, mergeThreshold: mergeT, minBlock: 8 })
    return p
  }

  // Requests are serialised so a fast-moving slider never queues dozens of calls
  const run = async () => {
    if (inflight.current) { pending.current = true; return }
    inflight.current = true
    const d = await call('segment', params(), { label: m.label, quiet: method === 'global' })
    if (d) setRes({ ...d, method, input: current })
    inflight.current = false
    if (pending.current) { pending.current = false; run() }
  }

  useEffect(() => {
    if (method === 'global' && current) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, method])
  useEffect(() => {
    if (method === 'regiongrow' && seed && current) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, tolerance])

  const props = asArray(res?.props)
  const shownId = res ? ({ overlay: res.overlayId, binary: res.id, extra: res.extraId }[view] || res.overlayId) : null

  const theory = (
    <>
      <p><b>Segmentation</b> divides an image into regions. Thresholding separates objects from background by intensity; region-based methods group similar neighbouring pixels.</p>
      <div className="formula">g(x,y) = 1 if f(x,y) &gt; T, else 0</div>
      {Object.values(METHODS).map((x) => <p key={x.label} className="small"><b>{x.label}</b> — {x.text}</p>)}
    </>
  )

  const controls = (
    <>
      <Select label="Method" value={method} onChange={(v) => { setMethod(v); setRes(null); setView('overlay') }} options={Object.entries(METHODS).map(([k, v]) => ({ value: k, label: v.label }))} />
      <p className="small muted">{m.text}</p>
      {method === 'global' && <Slider label="Threshold T (live)" value={threshold} min={0} max={1} step={0.01} onChange={setThreshold} format={(v) => `${v.toFixed(2)} · ${Math.round(v * 255)}`} />}
      {method === 'adaptive' && (
        <>
          <Slider label="Window" value={windowSize} min={3} max={31} step={2} onChange={setWindowSize} format={(v) => `${v}×${v}`} />
          <Slider label="Offset C" value={offset} min={-0.1} max={0.15} step={0.005} onChange={setOffset} />
        </>
      )}
      {method === 'point' && <Slider label="T × max|R|" value={pointT} min={0.1} max={1} step={0.01} onChange={setPointT} />}
      {method === 'line' && (
        <>
          <Select label="Direction" value={direction} onChange={setDirection} options={['horizontal', 'vertical', '+45', '-45']} />
          <Slider label="T × max R" value={lineT} min={0.1} max={1} step={0.01} onChange={setLineT} />
        </>
      )}
      {method === 'regiongrow' && (
        <>
          <Slider label="Tolerance" value={tolerance} min={0.01} max={0.5} step={0.01} onChange={setTolerance} />
          <Note>{seed ? `Seed at (${seed.row}, ${seed.col}). Click the image to move it.` : 'Click on the input image to place a seed.'}</Note>
        </>
      )}
      {method === 'splitmerge' && (
        <>
          <Slider label="Split if std >" value={stdT} min={0.01} max={0.2} step={0.005} onChange={setStdT} />
          <Slider label="Merge if |Δmean| <" value={mergeT} min={0.01} max={0.3} step={0.01} onChange={setMergeT} />
        </>
      )}
      {method !== 'global' && method !== 'regiongrow' && <button className="btn btn-primary btn-block" onClick={run}>Segment</button>}
    </>
  )

  return (
    <LabPage unit="Unit IV · Segmentation" title="Segmentation" subtitle="Separate objects from the background with thresholds and region-based methods."
      theory={theory} controls={controls} panelTitle="Method"
      code={{ functions: [...m.fn, 'labelComponents', 'regionProperties'], snippets: [{ title: 'MATLAB', code: m.code + "\n[L, n] = bwlabel(BW);\nstats = regionprops(L, 'Area', 'Centroid');" }] }}>
      {res && (
        <Metrics items={[
          res.threshold != null ? { label: 'Threshold T', value: `${fmt(res.threshold, 3)} (${Math.round(res.threshold * 255)})` } : null,
          { label: 'Foreground', value: `${fmt(res.foreground, 1)} %` },
          { label: 'Regions', value: res.regions },
        ]} />
      )}
      <div className={res ? 'mt' : ''}>
        <Tabs tabs={[{ key: 'result', label: 'Result' }, { key: 'hist', label: 'Histogram' }, { key: 'regions', label: `Regions${res ? ` (${props.length})` : ''}` }]} active={tab} onChange={setTab} />
        {tab === 'result' && (
          <div className="grid-2">
            <ImageView id={res?.input || current} title={method === 'regiongrow' ? 'Input — click to set the seed' : 'Input'} height={400}
              onPick={method === 'regiongrow' ? setSeed : undefined} />
            <ImageView id={shownId} title="Segmentation" height={400}
              emptyText={method === 'regiongrow' ? 'Click the input image to grow a region' : 'Press Segment'}
              actions={res && (
                <>
                  <Segmented value={view} onChange={setView} options={[{ value: 'overlay', label: 'Overlay' }, { value: 'binary', label: 'Binary' }, ...(res.extraId ? [{ value: 'extra', label: 'Response' }] : [])]} />
                  <UseButton id={res.id} label={`${m.label} segmentation`} />
                </>
              )} />
          </div>
        )}
        {tab === 'hist' && (
          <Card>
            {res ? (
              <>
                <Histogram counts={res.histogram} height={220} mapping={res.threshold != null ? Array.from({ length: 256 }, (_, i) => (i / 255 > res.threshold ? 255 : 0)) : null} />
                <p className="small faint mt-sm">{res.threshold != null ? `The orange step marks T = ${Math.round(res.threshold * 255)}: pixels to the right become foreground.` : 'This method does not use a single global threshold.'}</p>
                {res.extraId && <p className="small muted mt-sm">{EXTRA[res.method]} is available under Result → Response.</p>}
              </>
            ) : <p className="muted">Segment the image first.</p>}
          </Card>
        )}
        {tab === 'regions' && (
          <Card>
            {props.length ? (
              <table className="data">
                <thead><tr><th>#</th><th>Area</th><th>Centroid (x, y)</th><th>Bounding box</th><th>Perimeter</th><th>Eq. diameter</th></tr></thead>
                <tbody>
                  {props.map((p) => (
                    <tr key={p.label}><td>{p.label}</td><td>{p.area}</td><td>{fmt(p.centroidX, 1)}, {fmt(p.centroidY, 1)}</td>
                      <td>{p.bboxWidth}×{p.bboxHeight}</td><td>{p.perimeter}</td><td>{fmt(p.equivDiameter, 1)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="muted">No regions yet.</p>}
            <p className="small faint mt-sm">Largest 15 regions · bwlabel + regionprops equivalent · 8-connectivity.</p>
          </Card>
        )}
      </div>
    </LabPage>
  )
}
