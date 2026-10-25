// Every quiz a student plays is stored; the board shows each student once, with
// their best score (the rows arrive best first) and how often they played.
// Entries from before profile ids were stored are told apart by name + roll.
export function bestPerStudent(rows) {
  const seen = new Map()
  for (const r of rows) {
    const key = r.ProfileId || `${String(r.Name).toLowerCase()}|${r.Roll || ''}`
    const best = seen.get(key)
    if (best) best.Attempts += 1
    else seen.set(key, { ...r, Attempts: 1 })
  }
  return [...seen.values()]
}
