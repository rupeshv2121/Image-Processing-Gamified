// Thin client for the ImageLab backend (backend/imagelab, FastAPI).
// Every operation is POST /api/run {op, params}. Image operations are run by
// MATLAB (api/ilab_dispatch.m) — the browser never processes pixels itself.

// ------------------------------------------------------------------ session
// Signing in (backend services/auth.py) returns a session token. It travels with every
// request and the backend derives WHO is asking from it - the browser never says
// which student it is. Students may stay signed in on this computer
// ("remember me": localStorage); otherwise, and always for the teacher, the
// session ends with the browser tab (sessionStorage).
const SESSION_KEY = 'imagelab.session'
const readSession = (store) => { try { return JSON.parse(store.getItem(SESSION_KEY) || 'null') } catch { return null } }
let session = readSession(sessionStorage) || readSession(localStorage)
export const getSession = () => session
export const getRole = () => session?.role || null
// Key for per-student browser data (Code Lab drafts)
export const getProfileId = () => (session ? (session.role === 'teacher' ? 'teacher' : session.profileId) : 'guest')

export function setSession(next, remember = false) {
  session = next
  for (const store of [sessionStorage, localStorage]) {
    try { store.removeItem(SESSION_KEY) } catch { /* storage unavailable */ }
  }
  // tidy up keys of the previous version (role / PIN / chosen profile)
  for (const [store, key] of [[localStorage, 'imagelab.role'], [localStorage, 'imagelab.profile'], [sessionStorage, 'imagelab.role'], [sessionStorage, 'imagelab.teacherPin']]) {
    try { store.removeItem(key) } catch { /* storage unavailable */ }
  }
  if (!next) return
  const keep = { token: next.token, role: next.role, profileId: next.profileId, name: next.name }
  try { (remember && next.role === 'student' ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(keep)) } catch { /* storage unavailable */ }
}

// Called when the backend no longer knows the token (expired, signed out elsewhere,
// password reset by the teacher, server restarted)
let onSessionLost = null
export const setSessionLostHandler = (fn) => { onSessionLost = fn }

export async function run(op, params = {}) {
  let res
  try {
    res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, params: { ...params, ...(session ? { token: session.token } : {}), ...(session?.role === 'teacher' ? { track: false } : {}) } }),
    })
  } catch {
    throw new Error('Cannot reach the ImageLab server. Start it with start_imagelab.bat.')
  }
  let json
  try {
    json = await res.json()
  } catch {
    throw new Error('The ImageLab server returned an invalid response.')
  }
  if (!json.ok) {
    const err = new Error(json.error || 'Unknown MATLAB error.')
    err.cancelled = !!json.cancelled
    err.errorId = json.errorId || ''
    if (err.errorId === 'ImageLab:auth' && session) {
      setSession(null)
      onSessionLost?.(err.message)
    }
    throw err
  }
  return json.data
}

// Interrupts the MATLAB computation that is running right now (backend → MATLAB engine cancel)
export async function cancelRun() {
  try {
    const res = await fetch('/api/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    return (await res.json()).data
  } catch {
    return null
  }
}

export async function serverStatus() {
  const res = await fetch('/api/status')
  return res.json()
}

export function uploadImage(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 25 * 1024 * 1024) {
      reject(new Error('Image too large (max 25 MB).'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.onload = async () => {
      const data = String(reader.result).split(',')[1] || ''
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, data }),
        })
        const json = await res.json()
        if (!json.ok) reject(new Error(json.error || 'Upload failed.'))
        else resolve(json.data)
      } catch {
        reject(new Error('Cannot reach the ImageLab server.'))
      }
    }
    reader.readAsDataURL(file)
  })
}

export const imageUrl = (id) => (id ? `/api/image/${id}.png` : null)
export const downloadUrl = (id) => `/api/download/${id}.png`

// MATLAB's jsonencode turns 1-element arrays into scalars — normalise.
export const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])

// Matrices are sent by MATLAB as {rows, cols, data(row-major)} (see ilab_mat.m)
export function toMatrix(m) {
  if (!m) return null
  const data = asArray(m.data)
  const out = []
  for (let r = 0; r < m.rows; r++) out.push(data.slice(r * m.cols, (r + 1) * m.cols))
  return out
}

export function fmt(v, digits = 3) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v !== 'number') return String(v)
  if (!isFinite(v)) return '∞'
  if (Number.isInteger(v)) return String(v)
  const a = Math.abs(v)
  if (a !== 0 && (a < 0.001 || a >= 1e5)) return v.toExponential(2)
  return Number(v.toFixed(digits)).toString()
}

// PSNR of identical images is Inf, which MATLAB encodes as null
export const fmtPsnr = (v) => (v === null || v === undefined ? '∞' : `${Number(v).toFixed(2)} dB`)
