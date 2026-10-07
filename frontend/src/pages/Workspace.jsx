import { useEffect, useRef, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, downloadUrl, fmt } from '../api'
import Icon from '../components/Icon'
import { EmptyState } from '../components/LabPage'
import { Card, CodeButton, Histogram, ImageView, Modal, Page, Tabs } from '../components/ui'

export default function Workspace() {
  const app = useApp()
  const { current, original, meta, call, history, index } = app
  const [samples, setSamples] = useState([])
  const [showSamples, setShowSamples] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [info, setInfo] = useState(null)
  const [hist, setHist] = useState(null)
  const [tab, setTab] = useState('info')
  const fileRef = useRef(null)

  useEffect(() => {
    if (app.matlab.ok) call('samples', {}, { quiet: true }).then((s) => s && setSamples(asArray(s)))
  }, [app.matlab.ok, call])
  useEffect(() => {
    if (!current) return
    call('histogramOf', { id: current }, { quiet: true, label: 'Histogram' }).then((h) => h && setHist(h))
  }, [current, call])

  const openInfo = async () => {
    const d = await call('imageInfo', { id: current }, { label: 'Reading image info' })
    if (d) setInfo(d)
  }
  const toGray = async () => {
    const d = await call('grayscale', { id: current }, { label: 'rgb2gray' })
    if (d) app.push(d.id, 'Converted to grayscale')
  }
  const pickSample = async (name) => {
    setShowSamples(false)
    await app.loadSample(name)
  }

  return (
    <Page eyebrow="Workspace" title="Image Workspace" subtitle="Load an image into MATLAB. Results from any lab can be sent here and undone or redone.">
      <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.tif,.tiff,.bmp,.gif" hidden
        onChange={(e) => { if (e.target.files[0]) app.upload(e.target.files[0]); e.target.value = '' }} />

      <div className="row between" style={{ marginBottom: 24 }}>
        <div className="row">
          <button className="btn btn-primary" onClick={() => fileRef.current.click()} disabled={!app.matlab.ok}><Icon name="upload" size={17} /> Upload</button>
          <button className="btn" onClick={() => setShowSamples(true)} disabled={!app.matlab.ok}><Icon name="image" size={17} /> Samples</button>
          <a className={`btn ${current ? '' : 'disabled'}`} href={current ? downloadUrl(current) : undefined}><Icon name="download" size={17} /> Save</a>
        </div>
        <div className="row">
          <div className="btn-group">
            <button className="btn" onClick={app.undo} disabled={!app.canUndo} title="Undo"><Icon name="undo" size={17} /></button>
            <button className="btn" onClick={app.redo} disabled={!app.canRedo} title="Redo"><Icon name="redo" size={17} /></button>
            <button className="btn" onClick={app.reset} disabled={!current} title="Reset to original"><Icon name="reset" size={17} /></button>
          </div>
          <div className="btn-group">
            <button className="btn" onClick={() => setZoom((z) => Math.max(1, z / 1.5))} disabled={!current} title="Zoom out"><Icon name="zoomout" size={17} /></button>
            <button className="btn" onClick={() => setZoom(1)} disabled={!current} title="Fit">{Math.round(zoom * 100)}%</button>
            <button className="btn" onClick={() => setZoom((z) => Math.min(8, z * 1.5))} disabled={!current} title="Zoom in"><Icon name="zoomin" size={17} /></button>
          </div>
          <button className="btn" onClick={toGray} disabled={!current}>Grayscale</button>
          <button className="btn btn-navy" onClick={openInfo} disabled={!current}><Icon name="info" size={17} /> Image info</button>
        </div>
      </div>

      {!current ? (
        <EmptyState icon="image" title="No image yet" text="Upload a PNG, JPG, TIF, BMP or GIF, or start with one of the sample images.">
          <div className="row center mt-sm">
            <button className="btn btn-primary" onClick={() => pickSample('peppers.png')} disabled={!app.matlab.ok}>Use peppers.png</button>
            <button className="btn" onClick={() => setShowSamples(true)} disabled={!app.matlab.ok}>Browse samples</button>
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="grid-2">
            <ImageView id={original} title="Original" height={460} zoom={zoom} pixelated={zoom > 2} />
            <ImageView id={current} title="Current" badge={index > 0 ? `step ${index}` : null} height={460} zoom={zoom} pixelated={zoom > 2} />
          </div>

          <div className="mt">
            <Tabs tabs={[{ key: 'info', label: 'Information' }, { key: 'hist', label: 'Histogram' }, { key: 'history', label: `History (${history.length})` }]} active={tab} onChange={setTab} />
            {tab === 'info' && meta && (
              <Card>
                <table className="data">
                  <tbody>
                    <tr><th>Width</th><td>{meta.info.width} px</td><th>Height</th><td>{meta.info.height} px</td></tr>
                    <tr><th>Channels</th><td>{meta.info.channels}</td><th>Colour space</th><td>{meta.info.colorSpace}</td></tr>
                    <tr><th>Class (file)</th><td>{meta.original.class}</td><th>Data type</th><td>{meta.info.dataType}</td></tr>
                    <tr><th>Format</th><td>{meta.original.format}</td><th>Bit depth</th><td>{fmt(meta.original.bitDepth)}</td></tr>
                  </tbody>
                </table>
                {meta.resized && <p className="small faint mt-sm">Resized from {meta.original.width}×{meta.original.height} to keep the manual implementations fast.</p>}
                <div className="row mt-sm">
                  <CodeButton functions={['toGray', 'toDouble', 'ilab_store']} snippets={[{ title: 'Reading an image', code: "I = imread('peppers.png');   % uint8, M x N x 3\nwhos I\nI = im2double(I);             % 0..1\nG = rgb2gray(I);\nimshow(G)" }]} />
                </div>
              </Card>
            )}
            {tab === 'hist' && (
              <Card>
                {hist ? (
                  <>
                    <Histogram counts={hist.counts} height={200} />
                    <p className="small muted mt-sm">Mean {fmt(hist.stats.mean, 1)} · Std {fmt(hist.stats.std, 1)} · Entropy {fmt(hist.stats.entropy, 2)} bits</p>
                  </>
                ) : <p className="muted">Loading…</p>}
              </Card>
            )}
            {tab === 'history' && (
              <Card>
                <div className="stack-sm" style={{ gap: 6 }}>
                  {history.map((h, i) => (
                    <div key={i} className="row" style={{ opacity: i > index ? 0.45 : 1 }}>
                      <span className={`badge ${i === index ? '' : 'badge-navy'}`}>{i === 0 ? 'start' : `step ${i}`}</span>
                      <span style={{ fontWeight: i === index ? 650 : 400 }}>{h.label}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      {showSamples && (
        <Modal title="Sample images" onClose={() => setShowSamples(false)} wide>
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {samples.map((s) => (
              <button key={s.name} className="tile" onClick={() => pickSample(s.name)}>
                <span className="ic"><Icon name="image" /></span>
                <b>{s.name}</b>
                <span>{s.description}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {info && (
        <Modal title="Image information (from MATLAB)" onClose={() => setInfo(null)}>
          <table className="data">
            <tbody>
              {[['Width', `${info.width} px`], ['Height', `${info.height} px`], ['Channels', info.channels], ['Class', info.class],
                ['Data type', info.dataType], ['Colour space', info.colorSpace], ['Pixels', info.pixels.toLocaleString()],
                ['Memory', `${fmt(info.memoryKB, 1)} KB`], ['Min / Max', `${info.min} / ${info.max}`], ['Mean intensity', fmt(info.mean, 1)]]
                .map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
            </tbody>
          </table>
        </Modal>
      )}
    </Page>
  )
}
