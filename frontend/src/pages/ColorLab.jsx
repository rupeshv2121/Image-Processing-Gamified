import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import LabPage from '../components/LabPage'
import { ImageView, Note, Segmented, Select, Slider, Tabs, UseButton } from '../components/ui'

const SPACES = [
  { value: 'rgb', label: 'RGB' }, { value: 'hsv', label: 'HSV' }, { value: 'ycbcr', label: 'YCbCr' }, { value: 'lab', label: 'Lab' },
]
const TEXT = {
  rgb: 'Additive model: each pixel mixes red, green and blue light. Brightness and colour are mixed in all three channels.',
  hsv: 'Hue (colour angle), Saturation (purity) and Value (brightness) — close to how people describe colour.',
  ycbcr: 'Y = luma (brightness), Cb/Cr = blue and red colour differences. Used in JPEG and video.',
  lab: 'CIE L*a*b*: L* = lightness, a* = green↔red, b* = blue↔yellow. Approximately perceptually uniform.',
}
const CHANNELS = { rgb: ['R', 'G', 'B'], hsv: ['H (hue)', 'S (saturation)', 'V (value)'], ycbcr: ['Y', 'Cb', 'Cr'], lab: ['L*', 'a*', 'b*'] }
const PRESETS = [
  { label: 'More vivid', space: 'hsv', channel: 2, op: 'gain', amount: 1.5 },
  { label: 'Equalise brightness', space: 'hsv', channel: 3, op: 'equalize', amount: 1 },
  { label: 'Warmer', space: 'rgb', channel: 3, op: 'gain', amount: 0.85 },
]

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
  const isColor = meta?.info?.channels === 3

  const split = async (s) => {
    setSpace(s)
    const d = await call('color', { id: current, space: s }, { label: `rgb2${s}` })
    if (d) setRes({ ...d, space: s })
  }
  useEffect(() => {
    if (current && isColor && !res) split(space)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, isColor])

  const enhance = async (s = eSpace, ch = channel, op = operation, am = amount) => {
    const d = await call('colorEnhance', { id: current, space: s, channel: ch, operation: op, amount: am }, { label: 'Colour enhancement' })
    if (d) setEnh({ ...d, desc: `${CHANNELS[s][ch - 1]} ${op}${op !== 'equalize' ? ` ×${am}` : ''}` })
  }
  const preset = (p) => {
    setESpace(p.space); setChannel(p.channel); setOperation(p.op); setAmount(p.amount)
    enhance(p.space, p.channel, p.op, p.amount)
  }

  const theory = (
    <>
      <p>Colour is described by hue, saturation and brightness. Different <b>colour models</b> separate these properties differently.</p>
      {SPACES.map((s) => <p key={s.value} className="small"><b>{s.label}</b> — {TEXT[s.value]}</p>)}
      <div className="formula">Y = 0.299 R + 0.587 G + 0.114 B</div>
      <p className="small">For enhancement, process only the brightness channel (V, Y or L*). Equalising R, G and B separately changes their ratios and shifts the hues.</p>
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
  ) : (
    <>
      <Select label="Colour model" value={eSpace} onChange={(v) => { setESpace(v); setChannel(v === 'hsv' ? 2 : 1) }} options={SPACES} />
      <Select label="Channel" value={String(channel)} onChange={(v) => setChannel(Number(v))} options={CHANNELS[eSpace].map((c, i) => ({ value: String(i + 1), label: c }))} />
      <Segmented value={operation} onChange={setOperation} options={[{ value: 'gain', label: 'Gain' }, { value: 'equalize', label: 'Equalise' }, { value: 'gamma', label: 'Gamma' }]} />
      {operation !== 'equalize' && <Slider label={operation === 'gain' ? 'Gain' : 'Gamma'} value={amount} min={0.2} max={3} step={0.05} onChange={setAmount} />}
      <button className="btn btn-primary btn-block" onClick={() => enhance()} disabled={!isColor}>Enhance</button>
      <div className="divider" />
      <span className="field-label">Presets</span>
      <div className="row" style={{ gap: 6 }}>{PRESETS.map((p) => <button key={p.label} className="btn btn-small" onClick={() => preset(p)} disabled={!isColor}>{p.label}</button>)}</div>
    </>
  )

  return (
    <LabPage unit="Unit III · Colour" title="Color Processing" subtitle="Split an image into the channels of a colour model and enhance one channel at a time."
      theory={theory} controls={controls} panelTitle={tab === 'channels' ? 'Colour model' : 'Enhancement'}
      code={{ functions: ['colorChannels', 'colorEnhance', 'rgbToYCbCr', 'rgbToLab'], snippets: [{ title: 'Toolbox', code: "H = rgb2hsv(I);\nH(:,:,2) = min(H(:,:,2) * 1.5, 1);   % saturation\nH(:,:,3) = histeq(H(:,:,3));         % brightness\nJ = hsv2rgb(H);" }] }}>
      {!isColor && <Note kind="warn">The workspace image is grayscale — load a colour image such as peppers.png.</Note>}
      <Tabs tabs={[{ key: 'channels', label: 'Channels' }, { key: 'enhance', label: 'Enhance' }]} active={tab} onChange={setTab} />
      {tab === 'channels' && (
        <div className="grid-2">
          <ImageView id={current} title="Image" height={300} />
          {res ? asArray(res.channels).map((c) => (
            <ImageView key={c.id} id={c.id} title={c.name} height={300} caption={`mean ${fmt(c.mean, 3)} · std ${fmt(c.std, 3)}`} />
          )) : <ImageView id={null} title="Channels" height={300} emptyText="Choose a colour model" />}
        </div>
      )}
      {tab === 'enhance' && (
        <div className="grid-2">
          <ImageView id={current} title="Before" height={420} />
          <ImageView id={enh?.id || null} title={enh ? `After · ${enh.desc}` : 'After'} height={420} emptyText="Choose a channel or a preset"
            actions={enh && <UseButton id={enh.id} label={`Colour: ${enh.desc}`} />} />
        </div>
      )}
    </LabPage>
  )
}
