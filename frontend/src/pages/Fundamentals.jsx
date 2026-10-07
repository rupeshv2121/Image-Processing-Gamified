import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt, toMatrix } from '../api'
import LabPage from '../components/LabPage'
import { Card, ImageView, KernelGrid, Metrics, NeedImage, Note, Segmented, Tabs } from '../components/ui'

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
    </>
  )

  const controls = tab === 'neigh' ? (
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
    <LabPage unit="Unit I · Fundamentals" title="Pixels & Sampling" subtitle="Basic relationships between pixels, and how sampling and quantisation create a digital image."
      theory={theory} controls={controls} panelTitle={tab === 'neigh' ? 'Neighbourhood' : 'Digitisation'} needImage={false}
      code={{ functions: ['pixelNeighborhood', 'pixelDistances', 'sampleImage', 'quantizeImage'], snippets: [{ title: 'MATLAB', code: "small = I(1:f:end, 1:f:end, :);    % sampling\nq = floor(I * 2^k) / (2^k - 1);     % quantisation\nD4 = abs(x-s) + abs(y-t);" }] }}>
      <Tabs tabs={[{ key: 'neigh', label: 'Pixel neighbourhood' }, { key: 'samp', label: 'Sampling & quantisation' }]} active={tab} onChange={setTab} />
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
          <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {sView === 'sampling'
              ? samp?.map((s) => <ImageView key={s.id} id={s.id} title={SAMPLE_NAMES[s.factor]} caption={`${s.width} × ${s.height} samples`} height={240} pixelated />)
              : quant?.map((x) => <ImageView key={x.id} id={x.id} title={`${x.bits} bit · ${x.levels} levels`} caption={`PSNR ${x.psnr == null ? '∞' : fmt(x.psnr, 1) + ' dB'}`} height={240} />)}
          </div>
        </NeedImage>
      )}
    </LabPage>
  )
}
