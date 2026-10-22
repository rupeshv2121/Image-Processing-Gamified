import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import ImagePair from '../components/ImagePair'
import LabPage from '../components/LabPage'
import { Card, ImageView, LineChart, Note, Segmented, Select, Slider, Tabs, UseButton } from '../components/ui'

const SPACES = [
  { value: 'rgb', label: 'RGB' }, { value: 'cmy', label: 'CMY' }, { value: 'cmyk', label: 'CMYK' }, { value: 'hsv', label: 'HSV' },
  { value: 'hsi', label: 'HSI' },
]
const ENHANCE_SPACES = SPACES.filter((s) => s.value !== 'cmyk')
const TEXT = {
  rgb: 'Additive model: each pixel mixes red, green and blue light. Brightness and colour are mixed in all three channels.',
  cmy: 'Subtractive model of printing: C = 1 − R, M = 1 − G, Y = 1 − B. A cyan pigment absorbs red light, and so on.',
  cmyk: 'CMY plus black ink K = min(C, M, Y). Equal amounts of C, M and Y print a muddy brown, so true black is added as a fourth ink.',
  hsv: 'Hue (colour angle), Saturation (purity) and Value = max(R, G, B) — close to how people describe colour.',
  hsi: 'Hue, Saturation and Intensity I = (R + G + B)/3 (Gonzalez & Woods). Decouples intensity from the colour information, so grey-level algorithms can run on I alone.',
}
const CHANNELS = {
  rgb: ['R', 'G', 'B'], cmy: ['C (cyan)', 'M (magenta)', 'Y (yellow)'], hsv: ['H (hue)', 'S (saturation)', 'V (value)'],
  hsi: ['H (hue)', 'S (saturation)', 'I (intensity)'],
}
const PRESETS = [
  { label: 'More vivid', space: 'hsv', channel: 2, op: 'gain', amount: 1.5 },
  { label: 'Equalise brightness', space: 'hsv', channel: 3, op: 'equalize', amount: 1 },
  { label: 'Equalise intensity (HSI)', space: 'hsi', channel: 3, op: 'equalize', amount: 1 },
  { label: 'Warmer', space: 'rgb', channel: 3, op: 'gain', amount: 0.85 },
  { label: 'Less cyan ink', space: 'cmy', channel: 1, op: 'gain', amount: 0.8 },
]
const MAPS = ['jet', 'hot', 'parula', 'hsv', 'cool']

export default function ColorLab() {
  const { current, meta, call } = useApp()
  const [tab, setTab] = useState('channels')
  const [space, setSpace] = useState('hsv')
  const [res, setRes] = useState(null)
  const [eSpace, setESpace] = useState('hsv')
  const [channel, setChannel] = useState(2)
  const [operation, setOperation] = useState('gain')
  const [amount, setAmount] = useState(1.4)
  const [enh, setEnh] = useState(null)
  const [pMethod, setPMethod] = useState('slicing')
  const [slices, setSlices] = useState(8)
  const [map, setMap] = useState('jet')
  const [freq, setFreq] = useState(1)
  const [phases, setPhases] = useState([0, 60, 120])
  const [pseudo, setPseudo] = useState(null)
  const isColor = meta?.info?.channels === 3

  const split = async (s) => {
    setSpace(s)
    const d = await call('color', { id: current, space: s }, { label: s === 'cmy' ? 'C = 1 − R …' : `rgb2${s}` })
    if (d) setRes({ ...d, space: s })
  }
  useEffect(() => {
    if (current && isColor && !res) split(space)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, isColor])
  useEffect(() => {
    if (meta?.info && !isColor) setTab('pseudo')     // grey image: only pseudocolour applies
  }, [meta, isColor])

  const enhance = async (s = eSpace, ch = channel, op = operation, am = amount) => {
    const d = await call('colorEnhance', { id: current, space: s, channel: ch, operation: op, amount: am }, { label: 'Colour enhancement' })
    if (d) setEnh({ ...d, desc: `${CHANNELS[s][ch - 1]} ${op}${op !== 'equalize' ? ` ×${am}` : ''}` })
  }
  const preset = (p) => {
    setESpace(p.space); setChannel(p.channel); setOperation(p.op); setAmount(p.amount)
    enhance(p.space, p.channel, p.op, p.amount)
  }
  const makePseudo = async () => {
    const params = pMethod === 'slicing' ? { id: current, method: 'slicing', slices, map } : { id: current, method: 'transform', frequency: freq, phases }
    const d = await call('pseudocolor', params, { label: pMethod === 'slicing' ? 'Intensity slicing' : 'Grey → colour transformation' })
    if (d) setPseudo({ ...d, method: pMethod, desc: pMethod === 'slicing' ? `${slices} slices · ${map}` : `sinusoids f = ${freq}` })
  }

  const theory = (
    <>
      <p>Colour is described by hue, saturation and brightness. Different <b>colour models</b> separate these properties differently.</p>
      {SPACES.map((s) => <p key={s.value} className="small"><b>{s.label}</b> — {TEXT[s.value]}</p>)}
      <div className="formula">{'Y = 0.299 R + 0.587 G + 0.114 B\nHSI: θ = cos⁻¹{ ½[(R−G)+(R−B)] / √[(R−G)² + (R−B)(G−B)] }\n     H = θ if B ≤ G, else 360° − θ\n     S = 1 − 3·min(R,G,B)/(R+G+B),   I = (R+G+B)/3'}</div>
      <p className="small">For enhancement, process only the brightness channel (V or I). Equalising R, G and B separately changes their ratios and shifts the hues.</p>
      <h4>Pseudocolour</h4>
      <p className="small">People can tell apart thousands of colours but only a few dozen grey levels. <b>Intensity slicing</b> cuts the grey range into intervals and paints each one a colour. A <b>grey-to-colour transformation</b> sends every grey level through three different functions (here phase-shifted sinusoids) to obtain R, G and B — grey levels where the curves differ get very different colours.</p>
    </>
  )

  const controls = tab === 'channels' ? (
    <>
      <span className="field-label">Colour model</span>
      <div className="choice-list">
        {SPACES.map((s) => <button key={s.value} className={`choice ${space === s.value ? 'active' : ''}`} onClick={() => split(s.value)} disabled={!isColor}>{s.label}</button>)}
      </div>
      <p className="small muted">{TEXT[space]}</p>
    </>
  ) : tab === 'enhance' ? (
    <>
      <Select label="Colour model" value={eSpace} onChange={(v) => { setESpace(v); setChannel(v === 'hsv' ? 2 : 1) }} options={ENHANCE_SPACES} />
      <Select label="Channel" value={String(channel)} onChange={(v) => setChannel(Number(v))} options={CHANNELS[eSpace].map((c, i) => ({ value: String(i + 1), label: c }))} />
      <Segmented value={operation} onChange={setOperation} options={[{ value: 'gain', label: 'Gain' }, { value: 'equalize', label: 'Equalise' }, { value: 'gamma', label: 'Gamma' }]} />
      {operation !== 'equalize' && <Slider label={operation === 'gain' ? 'Gain' : 'Gamma'} value={amount} min={0.2} max={3} step={0.05} onChange={setAmount} />}
      <button className="btn btn-primary btn-block" onClick={() => enhance()} disabled={!isColor}>Enhance</button>
      <div className="divider" />
      <span className="field-label">Presets</span>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{PRESETS.map((p) => <button key={p.label} className="btn btn-small" onClick={() => preset(p)} disabled={!isColor}>{p.label}</button>)}</div>
    </>
  ) : (
    <>
      <Segmented value={pMethod} onChange={setPMethod} options={[{ value: 'slicing', label: 'Intensity slicing' }, { value: 'transform', label: 'Grey → colour' }]} />
      {pMethod === 'slicing' ? (
        <>
          <Slider label="Number of slices" value={slices} min={2} max={32} step={1} onChange={setSlices} />
          <Select label="Colours" value={map} onChange={setMap} options={MAPS} />
        </>
      ) : (
        <>
          <Slider label="Frequency" value={freq} min={0.25} max={4} step={0.25} onChange={setFreq} format={(v) => `${v} cycles`} />
          {['Red', 'Green', 'Blue'].map((c, i) => (
            <Slider key={c} label={`${c} phase`} value={phases[i]} min={0} max={180} step={5} onChange={(v) => setPhases((ph) => ph.map((x, j) => (j === i ? v : x)))} format={(v) => `${v}°`} />
          ))}
        </>
      )}
      <button className="btn btn-primary btn-block" onClick={makePseudo}>Apply pseudocolour</button>
      <p className="tiny faint">Works on any image — a colour image is converted to grey first.</p>
    </>
  )

  return (
    <LabPage unit="Unit III · Colour" title="Color Processing" subtitle="Split an image into the channels of a colour model, enhance one channel at a time, or give a grey image false colours."
      theory={theory} controls={controls} panelTitle={tab === 'channels' ? 'Colour model' : tab === 'enhance' ? 'Enhancement' : 'Pseudocolour'}
      code={{
        functions: tab === 'pseudo' ? ['intensitySlicing', 'grayToColor'] : ['colorChannels', 'colorEnhance', 'rgbToHsi', 'hsiToRgb', 'rgbToCmyk'],
        snippets: [tab === 'pseudo'
          ? { title: 'MATLAB', code: "G = rgb2gray(I);\nimshow(G, []), colormap(jet(8))      % intensity slicing\nR = abs(sin(2*pi*f*G + phR));          % grey -> colour\nJ = cat(3, R, abs(sin(2*pi*f*G + phG)), abs(sin(2*pi*f*G + phB)));" }
          : { title: 'Toolbox', code: "H = rgb2hsv(I);\nH(:,:,2) = min(H(:,:,2) * 1.5, 1);   % saturation\nH(:,:,3) = histeq(H(:,:,3));         % brightness\nJ = hsv2rgb(H);\nC = imcomplement(I);                 % CMY = 1 - RGB" }],
      }}>
      {!isColor && tab !== 'pseudo' && <Note kind="warn">The workspace image is grayscale — load a colour image such as peppers.png, or use Pseudocolour.</Note>}
      <Tabs tabs={[{ key: 'channels', label: 'Channels' }, { key: 'enhance', label: 'Enhance' }, { key: 'pseudo', label: 'Pseudocolour' }]} active={tab} onChange={setTab} />
      {tab === 'channels' && (
        <div className="grid-2">
          <ImageView id={current} title="Image" height={300} />
          {res ? asArray(res.channels).map((c) => (
            <ImageView key={c.id} id={c.id} title={c.name} height={300} caption={`mean ${fmt(c.mean, 3)} · std ${fmt(c.std, 3)}`} />
          )) : <ImageView id={null} title="Channels" height={300} emptyText="Choose a colour model" />}
        </div>
      )}
      {tab === 'enhance' && (
        <ImagePair height={420}
          left={{ id: current, title: 'Before' }}
          right={{ id: enh?.id || null, title: enh ? `After · ${enh.desc}` : 'After', emptyText: 'Choose a channel or a preset',
            actions: enh && <UseButton id={enh.id} label={`Colour: ${enh.desc}`} /> }} />
      )}
      {tab === 'pseudo' && (
        <div className="stack">
          <ImagePair height={400}
            left={{ id: pseudo?.grayId || current, title: 'Grey levels' }}
            right={{ id: pseudo?.id || null, title: pseudo ? `Pseudocolour · ${pseudo.desc}` : 'Pseudocolour', emptyText: 'Choose a method and press Apply',
              actions: pseudo && <UseButton id={pseudo.id} label={`Pseudocolour: ${pseudo.desc}`} /> }} />
          {pseudo?.method === 'slicing' && (
            <Card title="Slices">
              <div className="row" style={{ gap: 0, borderRadius: 6, overflow: 'hidden' }}>
                {asArray(pseudo.colors).map((c, i) => (
                  <div key={i} title={`${asArray(pseudo.edges)[i]}–${asArray(pseudo.edges)[i + 1]}`} style={{ flex: 1, height: 26, background: c }} />
                ))}
              </div>
              <div className="axis"><span>0</span><span>grey level</span><span>255</span></div>
            </Card>
          )}
          {pseudo?.method === 'transform' && (
            <Card title="Transfer functions R(r), G(r), B(r)">
              <LineChart height={150} x={['0', '255']} yMin={0} yMax={255} series={[
                { values: pseudo.curves.r, color: '#e0413a', label: 'Red' },
                { values: pseudo.curves.g, color: '#22a565', label: 'Green' },
                { values: pseudo.curves.b, color: '#2f6fd6', label: 'Blue' },
              ]} />
            </Card>
          )}
        </div>
      )}
    </LabPage>
  )
}
