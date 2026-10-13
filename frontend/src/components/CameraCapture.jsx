import { useEffect, useRef, useState } from 'react'
import { Modal, Note } from './ui'

// Takes a photo with the webcam and hands it over as a PNG File. The browser
// only captures the frame; MATLAB (imread) decodes and processes it as usual.
export default function CameraCapture({ onCapture, onClose }) {
  const video = useRef(null)
  const stream = useRef(null)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState('')
  const [mirror, setMirror] = useState(true)

  useEffect(() => {
    let live = true
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot access a camera. Open ImageLab at http://localhost and use a recent Chrome, Edge or Firefox.')
        return
      }
      try {
        stream.current?.getTracks().forEach((t) => t.stop())
        const s = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (!live) { s.getTracks().forEach((t) => t.stop()); return }
        stream.current = s
        video.current.srcObject = s
        await video.current.play()
        setReady(true)
        const all = await navigator.mediaDevices.enumerateDevices()
        if (live) setDevices(all.filter((d) => d.kind === 'videoinput'))
      } catch (e) {
        setError(e.name === 'NotAllowedError'
          ? 'Camera access was blocked. Allow the camera for this site in the browser’s address bar and try again.'
          : e.name === 'NotFoundError' ? 'No camera was found on this computer.' : `Could not start the camera: ${e.message}`)
      }
    }
    start()
    return () => {
      live = false
      stream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [deviceId])

  const capture = () => {
    const v = video.current
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d')
    if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1) }
    ctx.drawImage(v, 0, 0)
    c.toBlob((blob) => {
      if (!blob) { setError('Could not capture the frame.'); return }
      const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
      onCapture(new File([blob], `camera_${stamp}.png`, { type: 'image/png' }))
    }, 'image/png')
  }

  return (
    <Modal title="Take a photo" onClose={onClose} wide>
      {error ? <Note kind="error">{error}</Note> : (
        <div className="camera">
          <video ref={video} playsInline muted className={mirror ? 'mirror' : ''} aria-label="Camera preview" />
          {!ready && <div className="camera-wait">Starting the camera…</div>}
        </div>
      )}
      <div className="row between mt-sm">
        <div className="row">
          {devices.length > 1 && (
            <select value={deviceId} onChange={(e) => { setReady(false); setDeviceId(e.target.value) }} aria-label="Camera" style={{ width: 'auto' }}>
              <option value="">Default camera</option>
              {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
            </select>
          )}
          <label className="check"><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Mirror</label>
        </div>
        <div className="row">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={capture} disabled={!ready || !!error}>Capture & send to MATLAB</button>
        </div>
      </div>
      <p className="tiny faint mt-sm">The photo is saved as PNG and loaded with imread like any upload. Nothing leaves this computer.</p>
    </Modal>
  )
}
