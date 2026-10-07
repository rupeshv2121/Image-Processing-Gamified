// Thin client for the ImageLab bridge server.
// Every call is forwarded to the MATLAB function ilab_dispatch.m —
// the browser never processes pixels itself, it only displays MATLAB's output.

export async function run(op, params = {}) {
  let res
  try {
    res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, params }),
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
  if (!json.ok) throw new Error(json.error || 'Unknown MATLAB error.')
  return json.data
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
