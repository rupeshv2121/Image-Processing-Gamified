import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { fmt, run, toMatrix } from '../api'
import ImagePair from '../components/ImagePair'
import LabPage from '../components/LabPage'
import { Card, ImageView, Metrics, Note, Segmented, Slider, Tabs, UseButton } from '../components/ui'

const OPS = {
  erode: { label: 'Erosion', formula: 'A ⊖ B = { z | (B)z ⊆ A }', text: 'Keeps a pixel only where the structuring element fits completely inside the object: objects shrink, thin bridges break, specks smaller than B vanish.', code: 'J = imerode(BW, SE);', fn: ['erodeImage', 'morphologyManual'] },
  dilate: { label: 'Dilation', formula: 'A ⊕ B = { z | (B̂)z ∩ A ≠ ∅ }', text: 'Turns a pixel on wherever the reflected element touches the object: objects grow, small gaps and holes are bridged.', code: 'J = imdilate(BW, SE);', fn: ['dilateImage', 'morphologyManual'] },
  open: { label: 'Opening', formula: 'A ∘ B = (A ⊖ B) ⊕ B', text: 'Erosion then dilation. Removes objects and protrusions smaller than B but keeps the size of the large objects.', code: 'J = imopen(BW, SE);', fn: ['openImage', 'erodeImage', 'dilateImage'] },
  close: { label: 'Closing', formula: 'A • B = (A ⊕ B) ⊖ B', text: 'Dilation then erosion. Fills small holes and narrow gaps and joins nearby objects, again keeping the overall size.', code: 'J = imclose(BW, SE);', fn: ['closeImage', 'erodeImage', 'dilateImage'] },
  boundary: { label: 'Boundary extraction', formula: 'β(A) = A − (A ⊖ B)', text: 'The pixels removed by one erosion form the outline. A bigger B gives a thicker boundary.', code: 'B = BW & ~imerode(BW, SE);   % or bwperim(BW)', fn: ['morphBoundary', 'erodeImage'], binaryOnly: true },
  fill: { label: 'Hole filling', formula: 'Xk = (Xk−1 ⊕ B) ∩ Aᶜ,  F = Xkᶜ', text: 'Grows the background in from the image border; background that is never reached is a hole and gets filled. Uses 4-connectivity, not the structuring element.', code: "F = imfill(BW, 'holes');", fn: ['fillHoles', 'labelComponents'], binaryOnly: true },
}
const SHAPES = [
  { value: 'square', label: 'Square' }, { value: 'disk', label: 'Disk' }, { value: 'diamond', label: 'Diamond' },
  { value: 'cross', label: 'Cross' }, { value: 'hline', label: 'H-line' }, { value: 'vline', label: 'V-line' },
]

// Click a cell to switch it on/off; the outlined cell is the origin
function SEEditor({ se, onChange, disabled }) {
  const n = se.length
  const c = (n - 1) / 2
  return (
    <div className={`se-editor ${disabled ? 'disabled' : ''}`}>
      <table className={`kernel ${n > 5 ? 'small' : ''}`}>
        <tbody>
          {se.map((row, r) => (
            <tr key={r}>
              {row.map((v, k) => (
                <td key={k} className={`se-cell ${v ? 'on' : ''} ${r === c && k === c ? 'origin' : ''}`}>
                  <button disabled={disabled} aria-pressed={!!v} aria-label={`Row ${r + 1}, column ${k + 1}${r === c && k === c ? ' (origin)' : ''}`}
                    onClick={() => onChange(se.map((rr, i) => rr.map((x, j) => (i === r && j === k ? (x ? 0 : 1) : x))))}>
                    {v ? 1 : 0}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function MorphologyLab() {
  const { current, call, currentLabel } = useApp()
  const [op, setOp] = useState('open')
  const [mode, setMode] = useState('binary')
  const [invert, setInvert] = useState(false)
  const [shape, setShape] = useState('square')
  const [size, setSize] = useState(3)
  const [se, setSe] = useState([[1, 1, 1], [1, 1, 1], [1, 1, 1]])
  const [impl, setImpl] = useState('toolbox')
  const [res, setRes] = useState(null)
  const [tab, setTab] = useState('result')
  const o = OPS[op]
  const effMode = o.binaryOnly ? 'binary' : mode
  const ones = se.flat().filter(Boolean).length

  // Presets come from structuringElement.m
  useEffect(() => {
    if (shape === 'custom') return
    let live = true
    run('structuringElement', { shape, size, track: false })
      .then((m) => live && setSe(toMatrix(m).map((r) => r.map((v) => (v ? 1 : 0)))))
      .catch(() => {})
    return () => { live = false }
  }, [shape, size])

  const apply = async () => {
    const d = await call('morphology', { id: current, operation: op, se, mode: effMode, invert, impl }, { label: `${o.label} (${impl === 'manual' ? 'loops' : 'fast'})` })
    if (d) {
      setRes({ ...d, label: o.label, input: current, inputLabel: currentLabel })
      setTab('result')
    }
  }

  const st = res?.stats
  const theory = (
    <>
      <p><b>Mathematical morphology</b> processes shapes with a small binary <b>structuring element</b> B (SE). B is placed at every pixel; its origin (centre) marks the output position.</p>
      {Object.values(OPS).map((x) => (
        <div key={x.label}>
          <h4>{x.label}</h4>
          <div className="formula" style={{ margin: '6px 0' }}>{x.formula}</div>
          <p className="small">{x.text}</p>
        </div>
      ))}
      <p className="small"><b>Grayscale morphology</b> with a flat SE: erosion = minimum under B, dilation = maximum under B — the min/max filters of Unit II.</p>
      <p className="small">Opening and closing are <b>idempotent</b>: applying them twice changes nothing. Erosion and dilation are <b>duals</b>: (A ⊖ B)ᶜ = Aᶜ ⊕ B̂.</p>
    </>
  )

  const controls = (
    <>
      <div className="choice-list">
        {Object.entries(OPS).map(([k, v]) => (
          <button key={k} className={`choice ${op === k ? 'active' : ''}`} onClick={() => setOp(k)}>{v.label}<small>{v.binaryOnly ? 'binary' : ''}</small></button>
        ))}
      </div>
      <div className="formula">{o.formula}</div>
      <span className="field-label">Image</span>
      <Segmented value={effMode} onChange={setMode} options={[{ value: 'binary', label: 'Binary (Otsu)' }, { value: 'gray', label: 'Grayscale' }]} />
      {o.binaryOnly && <p className="tiny faint">{o.label} works on the binary image.</p>}
      {effMode === 'binary' && <label className="check"><input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} /> Objects are darker than the background</label>}
      <div className="divider" />
      <span className="field-label">Structuring element <b>{ones} ones</b></span>
      <div className="row" style={{ gap: 6 }}>
        {SHAPES.map((x) => (
          <button key={x.value} className={`btn btn-small ${shape === x.value ? 'btn-navy' : ''}`} onClick={() => setShape(x.value)} disabled={op === 'fill'}>{x.label}</button>
        ))}
      </div>
      <Slider label="Size" value={size} min={3} max={9} step={2} onChange={(v) => { setSize(v); if (shape === 'custom') setShape('square') }} format={(v) => `${v}×${v}`} />
      <SEEditor se={se} disabled={op === 'fill'} onChange={(m) => { setSe(m); setShape('custom') }} />
      {ones === 0 && <Note kind="warn">Switch on at least one cell.</Note>}
      <div className="divider" />
      <span className="field-label">Implementation</span>
      <Segmented value={impl} onChange={setImpl} options={[{ value: 'toolbox', label: 'Fast' }, { value: 'manual', label: 'Manual loops' }]} />
      <button className="btn btn-primary btn-block" onClick={apply} disabled={ones === 0}>Apply {o.label.toLowerCase()}</button>
    </>
  )

  return (
    <LabPage animation="morphology" unit="Unit IV · Morphology" title="Morphology Lab" subtitle="Erode, dilate, open and close shapes with a structuring element you design — then extract boundaries and fill holes."
      theory={theory} controls={controls} panelTitle="Operation"
      code={{ functions: o.fn, snippets: [{ title: 'Toolbox call', code: `BW = imbinarize(rgb2gray(I));\nSE = logical([${se.map((r) => r.join(' ')).join('; ')}]);   % the element designed above\n${o.code}` }] }}>
      {!res ? (
        <div className="stack">
          <div className="grid-2">
            <ImageView id={current} title={`Input · ${currentLabel}`} height={400} />
            <ImageView id={null} title="Result" height={400} emptyText="Choose an operation and press Apply" />
          </div>
          <Note>Tip: <b>shapes.png</b> or <b>unevenlight.png</b> show the binary operations best. Try a 1×n line element to erode only in one direction.</Note>
        </div>
      ) : (
        <div className="stack">
          <Metrics items={res.binary ? [
            { label: 'Foreground', value: `${fmt(st.foregroundBefore, 1)} → ${fmt(st.foregroundAfter, 1)} %` },
            { label: 'Regions (8-conn.)', value: `${st.regionsBefore} → ${st.regionsAfter}` },
            { label: 'Pixels removed', value: st.removed.toLocaleString() },
            { label: 'Pixels added', value: st.added.toLocaleString() },
            { label: 'Time', value: `${fmt(res.timeMs, 1)} ms` },
          ] : [
            { label: 'Mean intensity', value: `${fmt(st.meanBefore, 1)} → ${fmt(st.meanAfter, 1)}` },
            { label: 'Pixels changed', value: `${fmt(st.changed, 1)} %` },
            { label: 'Time', value: `${fmt(res.timeMs, 1)} ms` },
          ]} />
          <div>
            <Tabs tabs={[{ key: 'result', label: 'Result' }, { key: 'change', label: 'What changed' }, { key: 'se', label: 'Structuring element' }]} active={tab} onChange={setTab} />
            {tab === 'result' && (
              <ImagePair height={420}
                left={{ id: res.inputId, title: res.binary ? `Binary input${res.threshold != null ? ` (T = ${Math.round(res.threshold * 255)})` : ''}` : 'Input' }}
                right={{ id: res.id, title: res.label, actions: <UseButton id={res.id} label={`${res.label}`} /> }} />
            )}
            {tab === 'change' && (
              <div className="grid-2">
                <ImageView id={res.changeId} title={res.binary ? 'Change map' : '|Result − Input| × 4'} height={420} pixelated />
                <Card title="How to read it">
                  {res.binary ? (
                    <ul className="prose small">
                      <li><span className="swatch" style={{ background: '#f2f2f2' }} /> object pixels that were kept</li>
                      <li><span className="swatch" style={{ background: '#e8392f' }} /> object pixels <b>removed</b> ({st.removed.toLocaleString()})</li>
                      <li><span className="swatch" style={{ background: '#2bd36a' }} /> background pixels <b>added</b> ({st.added.toLocaleString()})</li>
                    </ul>
                  ) : <p className="small muted">Brighter = larger change in grey level.</p>}
                  <p className="small muted mt-sm">{res.implementation} · {res.functionName}.m</p>
                </Card>
              </div>
            )}
            {tab === 'se' && (
              <Card title={`Structuring element used (${toMatrix(res.se).length}×${toMatrix(res.se)[0].length})`}>
                {res.operation === 'fill'
                  ? <p className="muted small">Hole filling does not use the structuring element — it labels the background with 4-connectivity.</p>
                  : <SEEditor se={toMatrix(res.se)} disabled onChange={() => {}} />}
                <p className="small muted mt-sm">The outlined cell is the origin. For dilation MATLAB uses the reflected element B̂ (rotated 180°) — it only matters for asymmetric shapes.</p>
              </Card>
            )}
          </div>
          {res.operation === 'boundary' && (
            <Note>Next: measure every outline with chain codes in <a href="#regions">Region Analysis</a>.</Note>
          )}
        </div>
      )}
    </LabPage>
  )
}
