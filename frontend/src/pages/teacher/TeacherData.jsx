import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../AppContext'
import { asArray, run } from '../../api'

// The class overview (roster, KPIs, attention list, activity feed, assignment
// states) is built by MATLAB in ONE pass over the class (classAnalytics.m).
// Every teacher page reads it from here: it is fetched once, reused while it
// is fresh, and concurrent requests share one round trip.
const FRESH_MS = 30000
const TeacherContext = createContext(null)
export const useTeacher = () => useContext(TeacherContext)

export function TeacherProvider({ children }) {
  const { matlab, signOut, notify } = useApp()
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const loadedAt = useRef(0)
  const inflight = useRef(null)
  const latest = useRef(null)

  const handle = useCallback((err) => {
    if (/teacher PIN/i.test(err.message)) {          // PIN changed elsewhere: sign in again
      notify('Please enter the teacher PIN again', 'warn')
      signOut()
    } else {
      setError(err.message)
    }
  }, [notify, signOut])

  const refresh = useCallback(({ force = false } = {}) => {
    if (!force && latest.current && Date.now() - loadedAt.current < FRESH_MS) return Promise.resolve(latest.current)
    if (inflight.current) return inflight.current
    setLoading(true)
    inflight.current = run('classroom', { action: 'overview' })
      .then((d) => {
        latest.current = d
        loadedAt.current = Date.now()
        setOverview(d)
        setError(null)
        return d
      })
      .catch((err) => { handle(err); return null })
      .finally(() => { inflight.current = null; setLoading(false) })
    return inflight.current
  }, [handle])

  useEffect(() => { if (matlab.ok) refresh() }, [matlab.ok, refresh])

  // Teacher actions (assign, lock, ...) - the overview is rebuilt afterwards
  const act = useCallback(async (params) => {
    try {
      const d = await run('classroom', params)
      refresh({ force: true })
      return d
    } catch (err) {
      handle(err)
      return null
    }
  }, [refresh, handle])

  const value = useMemo(() => ({
    overview, error, loading, refresh, act,
    students: asArray(overview?.students),
    dashboard: overview?.dashboard || null,
  }), [overview, error, loading, refresh, act])
  return <TeacherContext.Provider value={value}>{children}</TeacherContext.Provider>
}

// ------------------------------------------------------------------ helpers
const parse = (t) => (t ? new Date(t.replace(' ', 'T')) : null)

export function timeAgo(t) {
  const d = parse(t)
  if (!d || Number.isNaN(d.getTime())) return 'never'
  const min = Math.round((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  const days = Math.round(h / 24)
  return days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : t.slice(0, 10)
}

export const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const studentHref = (id) => `#student?id=${encodeURIComponent(id)}`

export function TeacherError() {
  const { error, refresh } = useTeacher()
  if (!error) return null
  return (
    <div className="note note-error mt-sm">
      {error} <button className="btn btn-small" onClick={() => refresh({ force: true })}>Try again</button>
    </div>
  )
}
