// Parse "1 2 3; 4 5 6" or one row per line into a numeric matrix.
export function parseMatrix(text) {
  const clean = text.replace(/[[\]]/g, '').trim()
  if (!clean) throw new Error('The matrix is empty.')
  const rows = clean.split(/[;\n]+/).map((r) => r.trim()).filter(Boolean)
  const m = rows.map((r) => r.split(/[\s,]+/).filter(Boolean).map(evalNumber))
  const cols = m[0].length
  if (m.some((r) => r.length !== cols)) throw new Error('Every row must have the same number of values.')
  return m
}

// Accept numbers and simple fractions like 1/9
export function evalNumber(s) {
  const str = String(s).trim()
  let v
  if (/^-?\d*\.?\d+\s*\/\s*-?\d*\.?\d+$/.test(str)) {
    const [a, b] = str.split('/').map(Number)
    v = a / b
  } else {
    v = Number(str)
  }
  if (str === '' || !isFinite(v)) throw new Error(`"${s}" is not a valid number.`)
  return v
}

export const matrixToText = (m) => m.map((r) => r.join(' ')).join('\n')
