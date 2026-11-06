import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../AppContext'
import { asArray } from '../../api'
import Icon from '../../components/Icon'
import { Card, Modal, Note, Page } from '../../components/ui'

// Teacher: the sample images every lab offers. Own images are uploaded here
// (MATLAB reads each one first), described, and removed; built-in samples the
// class does not need can be hidden from the lists.
const ACCEPT = '.png,.jpg,.jpeg,.tif,.tiff,.bmp,.gif'
const MAX_MB = 25

const readBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
  reader.readAsDataURL(file)
})

export default function SampleLibrary() {
  const { call, matlab, loadSample, notify } = useApp()
  const [items, setItems] = useState(null)
  const [drag, setDrag] = useState(false)
  const [errors, setErrors] = useState([])
  const [remove, setRemove] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (matlab.ok) call('sampleLibrary', { action: 'list' }, { quiet: true }).then((d) => d && setItems(asArray(d)))
  }, [matlab.ok, call])

  const add = async (files) => {
    const failed = []
    for (const file of files) {
      if (file.size > MAX_MB * 1024 * 1024) { failed.push(`${file.name}: larger than ${MAX_MB} MB`); continue }
      try {
        const data = await readBase64(file)
        const d = await call('sampleLibrary', { action: 'add', name: file.name, data }, { label: `Adding ${file.name}`, quiet: true })
        if (d) setItems(asArray(d))
        else failed.push(`${file.name}: MATLAB could not read it`)
      } catch (err) {
        failed.push(err.message)
      }
    }
    setErrors(failed)
    const added = files.length - failed.length
    if (added) notify(`${added} image${added === 1 ? '' : 's'} added to the samples`)
  }
  const update = async (name, change) => {
    const d = await call('sampleLibrary', { action: 'update', name, ...change }, { label: 'Saving' })
    if (d) setItems(asArray(d))
  }
  const confirmRemove = async () => {
    const d = await call('sampleLibrary', { action: 'remove', name: remove.name }, { label: `Deleting ${remove.name}` })
    setRemove(null)
    if (d) setItems(asArray(d))
  }
  const use = async (name) => {
    if (await loadSample(name)) window.location.hash = 'workspace'
  }
  const onDrop = (e) => {
    e.preventDefault()
    setDrag(false)
    const files = [...e.dataTransfer.files].filter((f) => /\.(png|jpe?g|tiff?|bmp|gif)$/i.test(f.name))
    if (files.length) add(files)
  }

  const own = (items || []).filter((s) => s.custom)
  const builtin = (items || []).filter((s) => !s.custom)
  return (
    <Page eyebrow="Teacher" title="Sample images"
      subtitle="The images every lab offers under “Samples”. Upload your own, describe them, and hide built-in ones the class does not need.">
      <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden
        onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) add(f) }} />
      {!matlab.ok && <Note kind="warn">Waiting for MATLAB — it reads every image you add.</Note>}

      <Card title="Your images" extra={<span className="small faint">{own.length} uploaded</span>}>
        <div className={`sample-drop ${drag ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)} onDrop={onDrop}>
          <Icon name="upload" size={26} />
          <div><b>Drop images here</b> or</div>
          <button className="btn btn-primary" onClick={() => fileRef.current.click()} disabled={!matlab.ok}>
            <Icon name="upload" size={16} /> Choose files
          </button>
          <span className="small faint">PNG, JPG, TIF, BMP or GIF · up to {MAX_MB} MB each</span>
        </div>
        {errors.length > 0 && <Note kind="error">Not added: {errors.join(' · ')}</Note>}
        {items && own.length === 0 && <p className="muted small mt-sm">No images of your own yet. Students see them in every lab as soon as you add them.</p>}
        <div className="sample-grid mt-sm">
          {own.map((s) => (
            <div key={s.name} className="sample-card">
              <div className="sample-thumb"><img src={s.preview} alt={s.name} loading="lazy" /></div>
              <div className="sample-body">
                <b title={s.name}>{s.name}</b>
                {s.width && <span className="tiny faint">{s.width} × {s.height} px · added {s.added}</span>}
                <input type="text" defaultValue={s.description} maxLength={120} aria-label={`Description of ${s.name}`}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.description) update(s.name, { description: v }) }} />
                <div className="row">
                  <button className="btn btn-small" onClick={() => use(s.name)}><Icon name="image" size={15} /> Open</button>
                  <button className="btn btn-small btn-ghost" onClick={() => setRemove(s)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Built-in samples" className="mt"
        extra={<span className="small faint">{builtin.filter((s) => !s.hidden).length} of {builtin.length} shown</span>}>
        <p className="small muted">Hidden samples disappear from the students’ lists. Experiments and Code Lab tasks that use one keep working.</p>
        <div className="sample-list">
          {builtin.map((s) => (
            <div key={s.name} className={`sample-row ${s.hidden ? 'is-hidden' : ''}`}>
              <span className="grow"><b>{s.name}</b> <span className="small muted">{s.description}</span></span>
              <button className="btn btn-small btn-ghost" onClick={() => use(s.name)}>Open</button>
              <label className="check">
                <input type="checkbox" checked={!s.hidden} onChange={(e) => update(s.name, { hidden: !e.target.checked })} />
                Shown
              </label>
            </div>
          ))}
        </div>
      </Card>

      {remove && (
        <Modal title="Delete this image?" onClose={() => setRemove(null)}>
          <p><b>{remove.name}</b> is removed from the samples. Images students already loaded stay open.</p>
          <div className="row right">
            <button className="btn" onClick={() => setRemove(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmRemove}>Delete</button>
          </div>
        </Modal>
      )}
    </Page>
  )
}
