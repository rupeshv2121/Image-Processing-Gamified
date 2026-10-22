import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt, imageUrl, toMatrix } from '../api'
import LabPage from '../components/LabPage'
import { Card, ImageView, KernelGrid, LineChart, Metrics, NeedImage, Note, Segmented, Slider, Tabs } from '../components/ui'

const START = [
  [0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 0, 1, 0],
  [0, 0, 1, 1, 0, 1, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 1, 0, 0, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0],
]
const SHOW = [
  { value: 'n4', label: 'N4(p)', text: 'The 4 horizontal and vertical neighbours (x±1, y), (x, y±1).' },
  { value: 'nd', label: 'ND(p)', text: 'The 4 diagonal neighbours (x±1, y±1).' },
  { value: 'n8', label: 'N8(p)', text: 'All 8 surrounding pixels: N4 (green) ∪ ND (orange).' },
  { value: 'a4', label: '4-adjacent', text: 'Pixels with a value in V that are in N4(p).' },
  { value: 'a8', label: '8-adjacent', text: 'Pixels with a value in V that are in N8(p) — can create double paths.' },
  { value: 'm', label: 'm-adjacent', text: 'q ∈ N4(p), or q ∈ ND(p) and N4(p) ∩ N4(q) has no pixel from V. Removes the ambiguity of 8-adjacency.' },
]
// Bands of the electromagnetic spectrum (wavelength range in metres) and the images formed in them
const BANDS = [
  { band: 'Gamma rays', range: '< 0.01 nm', use: 'Nuclear medicine (PET), astronomy' },
  { band: 'X-rays', range: '0.01 – 10 nm', use: 'Radiography, CT, circuit-board inspection' },
  { band: 'Ultraviolet', range: '10 – 380 nm', use: 'Fluorescence microscopy, lithography' },
  { band: 'Visible light', range: '380 – 780 nm', use: 'Photography, inspection, the human eye' },
  { band: 'Infrared', range: '0.78 µm – 1 mm', use: 'Thermal imaging, satellite remote sensing' },
  { band: 'Microwaves', range: '1 mm – 1 m', use: 'Radar (SAR) — images through clouds and at night' },
  { band: 'Radio waves', range: '> 1 m', use: 'MRI, radio astronomy' },
]
const PERCEPTION = [
  { value: 'machbands', label: 'Mach bands' },
  { value: 'simultaneous', label: 'Simultaneous contrast' },
  { value: 'weber', label: 'Weber ratio' },
]

const SAMPLE_NAMES = { 1: 'Original', 2: 'High sampling (½)', 4: 'Medium sampling (¼)', 8: 'Low sampling (⅛)', 16: 'Very low (1/16)' }

export default function Fundamentals() {
  const { call, current } = useApp()
  const [tab, setTab] = useState('neigh')
  const [grid, setGrid] = useState(START)
  const [p, setP] = useState({ r: 3, c: 3 })
  const [q, setQ] = useState({ r: 5, c: 6 })
  const [tool, setTool] = useState('p')
  const [show, setShow] = useState('m')
  const [dist, setDist] = useState('euclidean')
  const [info, setInfo] = useState(null)
  const [samp, setSamp] = useState(null)
  const [quant, setQuant] = useState(null)
  const [sView, setSView] = useState('sampling')
  const [demo, setDemo] = useState('machbands')
  const [steps, setSteps] = useState(8)
  const [centre, setCentre] = useState(0.5)
  const [bg, setBg] = useState(0.5)
  const [delta, setDelta] = useState(0.02)
  const [percept, setPercept] = useState(null)
  const [lambda, setLambda] = useState(550)
  const [spec, setSpec] = useState(null)

  useEffect(() => {
    if (tab !== 'perception') return
    const params = demo === 'machbands' ? { kind: demo, steps } : demo === 'simultaneous' ? { kind: demo, centre } : { kind: demo, background: bg, delta }
    const t = setTimeout(() => call('perception', params, { label: 'Perception demo', quiet: true }).then((d) => d && setPercept({ ...d, kind: demo })), 150)
    return () => clearTimeout(t)
  }, [tab, demo, steps, centre, bg, delta, call])

  useEffect(() => {
    if (tab !== 'spectrum') return
    const t = setTimeout(() => call('spectrum', { wavelength: lambda }, { label: 'Spectrum', quiet: true }).then((d) => d && setSpec(d)), 120)
    return () => clearTimeout(t)
  }, [tab, lambda, call])
  const specColor = spec ? `rgb(${asArray(spec.rgb).map((v) => Math.round(255 * v)).join(',')})` : '#000'

  useEffect(() => {
    call('neighborhood', { matrix: grid, row: p.r, col: p.c, valueSet: 1 }, { label: 'Neighbourhood', quiet: true }).then((d) => d && setInfo(d))
  }, [grid, p, call])

  useEffect(() => {
    if (tab !== 'samp' || !current) return
    call('sampling', { id: current, factors: [1, 2, 4, 8, 16] }, { label: 'Sampling' }).then((d) => d && setSamp(asArray(d)))
    call('quantize', { id: current, bits: [8, 4, 2, 1] }, { label: 'Quantisation' }).then((d) => d && setQuant(asArray(d)))
  }, [tab, current, call])

  const has = (list, r, c) => asArray(list).some((x) => x.r === r + 1 && x.c === c + 1)
  const hl = (r, c) => {
    if (r + 1 === p.r && c + 1 === p.c) return 'center'
    if (info) {
      if (show === 'n4' && has(info.N4, r, c)) return 'n4'
      if (show === 'nd' && has(info.ND, r, c)) return 'nd'
      if (show === 'n8') { if (has(info.N4, r, c)) return 'n4'; if (has(info.ND, r, c)) return 'nd' }
      if (show === 'a4' && has(info.adjacent4, r, c)) return 'm'
      if (show === 'a8' && has(info.adjacent8, r, c)) return 'm'
      if (show === 'm' && has(info.adjacentM, r, c)) return 'm'
    }
    if (r + 1 === q.r && c + 1 === q.c) return 'window'
    return null
  }
  const click = (r, c) => {
    if (tool === 'p') setP({ r: r + 1, c: c + 1 })
    else if (tool === 'q') setQ({ r: r + 1, c: c + 1 })
    else setGrid((g) => g.map((row, i) => row.map((v, j) => (i === r && j === c ? 1 - v : v))))
  }
  const distM = info ? toMatrix(info[dist]) : null
  const dx = Math.abs(p.r - q.r)
  const dy = Math.abs(p.c - q.c)

  const theory = (
    <>
      <h4>Neighbours and adjacency</h4>
      {SHOW.map((s) => <p key={s.value} className="small"><b>{s.label}</b> — {s.text}</p>)}
      <h4>Distances between p = (x, y) and q = (s, t)</h4>
      <div className="formula">De = √((x−s)² + (y−t)²)   D4 = |x−s| + |y−t|   D8 = max(|x−s|, |y−t|)</div>
      <h4>Sampling and quantisation</h4>
      <p className="small">Sampling chooses how many pixels represent the scene (spatial resolution); too few give blocky checkerboard artefacts. Quantisation chooses the number of grey levels L = 2^k; too few give false contours.</p>
      <h4>Visual perception</h4>
      <p className="small">The retina has 6–7 million <b>cones</b> (colour, bright light, concentrated in the fovea) and 75–150 million <b>rods</b> (dim light, no colour). The eye spans about 10¹⁰ intensity levels, but not at once: it <b>adapts</b> to the current level and only discriminates a small range around it.</p>
      <div className="formula">Weber ratio = ΔI_c / I      (ΔI_c = just-noticeable increment on background I)</div>
      <p className="small">A small Weber ratio means good brightness discrimination (≈ 0.02 in normal light); in dim light it is much larger. <b>Mach bands</b> and <b>simultaneous contrast</b> show that perceived brightness is not a simple function of intensity: the visual system emphasises edges and judges brightness relative to the surround.</p>
      <h4>Light and the electromagnetic spectrum</h4>
      <div className="formula">λ = c / ν        E = h·ν        c = 2.998·10⁸ m/s,  h = 6.626·10⁻³⁴ J·s</div>
      <p className="small">Visible light is the narrow band 380–780 nm. Images can be formed in every band — gamma rays to radio waves — as long as the wavelength is not larger than the objects to be seen.</p>
    </>
  )

  const controls = tab === 'perception' ? (
    <>
      <div className="choice-list">
        {PERCEPTION.map((x) => <button key={x.value} className={`choice ${demo === x.value ? 'active' : ''}`} onClick={() => setDemo(x.value)}>{x.label}</button>)}
      </div>
      {demo === 'machbands' && <Slider label="Number of bands" value={steps} min={3} max={16} step={1} onChange={setSteps} />}
      {demo === 'simultaneous' && <Slider label="Grey level of the squares" value={centre} min={0.1} max={0.9} step={0.01} onChange={setCentre} format={(v) => Math.round(v * 255)} />}
      {demo === 'weber' && (
        <>
          <Slider label="Background I" value={bg} min={0.02} max={0.95} step={0.01} onChange={setBg} format={(v) => Math.round(v * 255)} />
          <Slider label="Increment ΔI" value={delta} min={0} max={0.2} step={0.002} onChange={setDelta} format={(v) => Math.round(v * 255)} />
        </>
      )}
    </>
  ) : tab === 'spectrum' ? (
    <>
      <Slider label="Wavelength λ" value={lambda} min={380} max={780} step={5} onChange={setLambda} format={(v) => `${v} nm`} />
      <p className="small muted">Drag through the visible band: violet (≈ 400 nm) → blue → green → yellow → red (≈ 700 nm).</p>
    </>
  ) : tab === 'neigh' ? (
    <>
      <span className="field-label">Click on the grid to…</span>
      <Segmented value={tool} onChange={setTool} options={[{ value: 'p', label: 'Set p' }, { value: 'q', label: 'Set q' }, { value: 'edit', label: 'Toggle 0/1' }]} />
      <span className="field-label">Highlight</span>
      <div className="choice-list">
        {SHOW.map((s) => <button key={s.value} className={`choice ${show === s.value ? 'active' : ''}`} onClick={() => setShow(s.value)}>{s.label}</button>)}
      </div>
    </>
  ) : (
    <>
      <Segmented value={sView} onChange={setSView} options={[{ value: 'sampling', label: 'Sampling' }, { value: 'quant', label: 'Quantisation' }]} />
      <p className="small muted">{sView === 'sampling' ? 'Keep every f-th pixel, then enlarge back to the original size.' : 'Reduce the number of grey levels to 2^k. Try gradient.png to see false contours.'}</p>
    </>
  )

  return (
    <LabPage unit="Unit I · Fundamentals" title="Pixels & Sampling" subtitle="Basic relationships between pixels, how sampling and quantisation create a digital image, and how the eye perceives it."
      theory={theory} controls={controls} needImage={false}
      panelTitle={{ neigh: 'Neighbourhood', samp: 'Digitisation', perception: 'Perception', spectrum: 'Spectrum' }[tab]}
      code={{ functions: ['pixelNeighborhood', 'pixelDistances', 'sampleImage', 'quantizeImage', 'perceptionDemo', 'wavelengthToRGB'], snippets: [{ title: 'MATLAB', code: "small = I(1:f:end, 1:f:end, :);    % sampling\nq = floor(I * 2^k) / (2^k - 1);     % quantisation\nD4 = abs(x-s) + abs(y-t);" }] }}>
      <Tabs tabs={[{ key: 'neigh', label: 'Pixel neighbourhood' }, { key: 'samp', label: 'Sampling & quantisation' }, { key: 'perception', label: 'Visual perception' }, { key: 'spectrum', label: 'EM spectrum' }]} active={tab} onChange={setTab} />
      {tab === 'perception' && percept && (
        <div className="stack">
          <ImageView id={percept.id} title={PERCEPTION.find((x) => x.value === percept.kind).label} height={percept.kind === 'machbands' ? 200 : 260} pixelated inspectable />
          {percept.kind === 'machbands' && (
            <Card title="Intensity profile across the bands">
              <LineChart height={170} x={['left', 'right']} series={[
                { values: percept.actual, color: '#2f6fd6', label: 'actual intensity (flat steps)' },
                { values: percept.perceived, color: '#e08a1e', label: 'perceived brightness (lateral-inhibition model)', dashed: true },
              ]} />
              <p className="small muted mt-sm">Every band is perfectly flat, yet each looks lighter next to its darker neighbour and darker next to its lighter one. The retina's centre–surround cells (modelled here by a difference-of-Gaussians filter) overshoot at edges — the visual system enhances edges.</p>
            </Card>
          )}
          {percept.kind === 'simultaneous' && (
            <Note>All four inner squares have exactly the same grey level <b>{Math.round(percept.centre * 255)}</b> (hover the image to check), but the square on the dark background looks brighter than the one on the light background. Perceived brightness depends on the surround.</Note>
          )}
          {percept.kind === 'weber' && (
            <Metrics items={[
              { label: 'Background I', value: Math.round(percept.background * 255) },
              { label: 'Increment ΔI', value: Math.round(percept.delta * 255) },
              { label: 'Weber ratio ΔI / I', value: fmt(percept.weber, 3) },
              { label: 'Visible?', value: percept.weber >= 0.02 ? 'usually' : 'hard to see' },
            ]} />
          )}
          {percept.kind === 'weber' && <Note>Find the smallest ΔI at which you can still see the disc — that is your just-noticeable difference. Repeat with a dark background: the ratio you need is larger, because discrimination is poorer at low light levels.</Note>}
        </div>
      )}
      {tab === 'spectrum' && spec && (
        <div className="stack">
          <Card title="Visible spectrum, 380 – 780 nm">
            <div style={{ position: 'relative' }}>
              <img src={imageUrl(spec.stripId)} alt="visible spectrum" style={{ width: '100%', height: 60, display: 'block', borderRadius: 6 }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: 'var(--text, #000)', left: `${((lambda - 380) / 400) * 100}%` }} />
            </div>
            <div className="axis"><span>380 nm (violet)</span><span>580 nm</span><span>780 nm (red)</span></div>
          </Card>
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <Card title={`λ = ${lambda} nm`}>
              <div style={{ height: 70, borderRadius: 8, background: specColor, border: '1px solid var(--border, #ccc)' }} />
              <Metrics items={[
                { label: 'Frequency ν = c/λ', value: `${fmt(spec.frequencyTHz, 0)} THz` },
                { label: 'Photon energy E = hν', value: `${fmt(spec.energyEV, 3)} eV` },
              ]} />
            </Card>
            <Card title="Imaging in every band">
              <table className="data compact">
                <thead><tr><th>Band</th><th>Wavelength</th><th>Imaging examples</th></tr></thead>
                <tbody>{BANDS.map((b) => <tr key={b.band} className={b.band === 'Visible light' ? 'best' : ''}><td><b>{b.band}</b></td><td>{b.range}</td><td>{b.use}</td></tr>)}</tbody>
              </table>
            </Card>
          </div>
        </div>
      )}
      {tab === 'neigh' && (
        <div className="stack">
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <Card title="Binary image, V = {1}">
              <table className="kernel" style={{ fontSize: 16 }}>
                <tbody>
                  {grid.map((row, r) => (
                    <tr key={r}>
                      {row.map((v, c) => (
                        <td key={c} className={hl(r, c) ? `hl-${hl(r, c)}` : ''} onClick={() => click(r, c)} style={{ cursor: 'pointer', width: 46, height: 44 }}>
                          {v}{r + 1 === p.r && c + 1 === p.c ? 'ᵖ' : r + 1 === q.r && c + 1 === q.c ? 'ᵠ' : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small muted mt-sm">{SHOW.find((s) => s.value === show).text}</p>
              {info && !info.centerInSet && <Note kind="warn">p has value 0 (not in V), so it is not adjacent to anything.</Note>}
            </Card>
            <Card title={`Distance from p(${p.r},${p.c}) to q(${q.r},${q.c})`}>
              <Metrics items={[
                { label: 'Euclidean De', value: fmt(Math.sqrt(dx * dx + dy * dy), 3) },
                { label: 'City-block D4', value: dx + dy },
                { label: 'Chessboard D8', value: Math.max(dx, dy) },
              ]} />
              <div className="mt">
                <Segmented value={dist} onChange={setDist} options={[{ value: 'euclidean', label: 'De map' }, { value: 'cityBlock', label: 'D4 map' }, { value: 'chessboard', label: 'D8 map' }]} />
              </div>
              {distM && (
                <div className="mt-sm">
                  <KernelGrid matrix={distM} small highlight={(r, c) => (r + 1 === p.r && c + 1 === p.c ? 'center' : r + 1 === q.r && c + 1 === q.c ? 'window' : null)} />
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
      {tab === 'samp' && (
        <NeedImage>
          <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))' }}>
            {sView === 'sampling'
              ? samp?.map((s) => <ImageView key={s.id} id={s.id} title={SAMPLE_NAMES[s.factor]} caption={`${s.width} × ${s.height} samples`} height={240} pixelated />)
              : quant?.map((x) => <ImageView key={x.id} id={x.id} title={`${x.bits} bit · ${x.levels} levels`} caption={`PSNR ${x.psnr == null ? '∞' : fmt(x.psnr, 1) + ' dB'}`} height={240} />)}
          </div>
        </NeedImage>
      )}
    </LabPage>
  )
}
