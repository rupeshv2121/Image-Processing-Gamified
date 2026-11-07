// Every Arcade game that posts scores, in the Arcade's order. game = its key in
// QuizHub (#quiz?game=...). Classroom Mode is played by the whole class on the
// projector, so it has no personal score.
export const MODES = [
  { mode: 'Daily Challenge', game: 'daily' },
  { mode: 'Weak-Topic Practice', game: 'weak' },
  { mode: 'Rapid Fire', game: 'rapid' },
  { mode: 'Kernel Quiz', game: 'kernel' },
  { mode: 'Guess the Filter', game: 'guess' },
  { mode: 'Build the Pipeline', game: 'pipeline' },
  { mode: 'Challenge Mode', game: 'challenge' },
]

// Older scores were saved as "Challenge (easy)" etc. and "Weak-topic practice"
export function modeOf(row) {
  const m = String(row.Mode || 'Rapid Fire')
  if (/^challenge/i.test(m)) return 'Challenge Mode'
  if (/^weak/i.test(m)) return 'Weak-Topic Practice'
  return m
}

const nameKey = (r) => `${String(r.Name).toLowerCase()}|${r.Roll || ''}`

// Entries from before profile ids were stored belong to the student with the
// same name + roll number when there is one.
export function withProfileIds(rows) {
  const idOf = new Map()
  for (const r of rows) if (r.ProfileId) idOf.set(nameKey(r), r.ProfileId)
  return rows.map((r) => (r.ProfileId ? r : { ...r, ProfileId: idOf.get(nameKey(r)) || '' }))
}

// Every quiz a student plays is stored; the board shows each student once, with
// their best score (the rows arrive best first) and how often they played.
export function bestPerStudent(rows) {
  const seen = new Map()
  for (const r of withProfileIds(rows)) {
    const key = r.ProfileId || nameKey(r)
    const best = seen.get(key)
    if (best) best.Attempts += 1
    else seen.set(key, { ...r, Mode: modeOf(r), Attempts: 1 })
  }
  return [...seen.values()]
}
