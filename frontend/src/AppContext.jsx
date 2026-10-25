import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { asArray, getSession, run, serverStatus, setSession, setSessionLostHandler, setXpHandler, uploadImage } from './api'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

export function AppProvider({ children }) {
  // server: the Spatia server answers (sign-in and the live quiz need nothing more)
  // ok: MATLAB is running too (image operations)
  // remote: this browser is a student's own device on the classroom network (no Code Lab)
  // lan: the addresses students open to join (classroom network mode, start_imagelab_lan.bat)
  const [matlab, setMatlab] = useState({ server: false, ready: false, ok: false, error: null, ipt: false, release: '', remote: false, lan: [] })
  const [history, setHistory] = useState([]) // [{id, label}]
  const [index, setIndex] = useState(-1)
  const [meta, setMeta] = useState(null) // {name, info, original, resized}
  const [progress, setProgress] = useState(null)
  const [busy, setBusy] = useState(0)
  const [busyLabel, setBusyLabel] = useState('')
  const [alertMsg, setAlertMsg] = useState(null)
  const [toast, setToast] = useState(null)
  const [profiles, setProfiles] = useState([])
  // Signed-in user: { token, role: 'student' | 'teacher', profileId, name } or null
  const [session, setSessionState] = useState(getSession)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [sessionMessage, setSessionMessage] = useState(null)   // why the user was signed out
  const role = session?.role || null
  const profileId = role === 'student' ? session.profileId : null
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem('imagelab.theme') || 'system' } catch { return 'system' }
  })
  const toastTimer = useRef(null)

  // ---------------------------------------------------------- theme
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    try { localStorage.setItem('imagelab.theme', theme) } catch { /* storage unavailable */ }
  }, [theme])
  const setTheme = useCallback((t) => setThemeState(t), [])

  // ---------------------------------------------------------- MATLAB status
  useEffect(() => {
    let stop = false
    let checkedSession = false
    const poll = async () => {
      try {
        const s = await serverStatus()
        const base = { server: true, remote: !!s.remote, lan: s.lan || [] }
        if (!stop) setMatlab((m) => (m.server ? m : { ...m, ...base, error: null }))
        // A remembered session is only valid while the server still knows its token
        // (signing in never waits for MATLAB to start)
        if (!checkedSession && getSession()) {
          checkedSession = true
          const me = await run('auth', { action: 'me' }).catch(() => null)
          if (me && !stop) {
            await refreshProfiles()
            refreshProgress()
          }
        }
        if (s.ready) {
          if (s.matlab) {
            const ping = await run('ping').catch(() => null)
            if (!ping) throw new Error('MATLAB is not answering yet')
            if (!stop) setMatlab({ ...base, ready: true, ok: true, error: null, ipt: ping.ipt, iptLicensed: ping.iptLicensed, release: ping.release })
            // Deep link for demos: #filters?sample=peppers.png loads a sample image
            const m = window.location.hash.match(/[?&]sample=([\w.-]+)/)
            if (m && !stop && !s.remote) {
              const data = await run('loadSample', { name: m[1] }).catch(() => null)
              if (data && !stop) {
                setHistory([{ id: data.id, label: `Loaded ${data.name}` }])
                setIndex(0)
                setMeta({ name: data.name, info: data.info, original: data.original, resized: data.resized })
              }
            }
          } else if (!stop) setMatlab({ ...base, ready: true, ok: false, error: s.error })
          return
        }
      } catch {
        if (!stop) setMatlab((m) => ({ ...m, error: m.server ? 'Waiting for MATLAB…' : 'Waiting for the Spatia server…' }))
      }
      if (!stop) setTimeout(poll, 1500)
    }
    poll()
    return () => { stop = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const notify = useCallback((text, kind = 'ok') => {
    setToast({ text, kind })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  // ------------------------------------------------------------- MATLAB calls
  // call() shows a busy indicator and a uialert-style dialog on errors.
  const call = useCallback(async (op, params = {}, { label, quiet } = {}) => {
    setBusy((b) => b + 1)
    setBusyLabel(label || op)
    try {
      return await run(op, params)
    } catch (err) {
      if (err.cancelled) notify('Cancelled — MATLAB stopped the computation', 'warn')
      else if (!quiet) setAlertMsg({ title: 'MATLAB says', text: err.message })
      return null
    } finally {
      setBusy((b) => Math.max(0, b - 1))
    }
  }, [notify])

  const refreshProgress = useCallback(async () => {
    try {
      const p = await run('progress', { action: 'get' })
      setProgress(p)
      return p
    } catch {
      return null
    }
  }, [])

  // ------------------------------------------------------------- profiles
  // The class list (signed-in users only). Students see it in the leaderboard.
  const refreshProfiles = useCallback(async () => {
    try {
      const list = asArray(await run('profiles', { action: 'list' }))
      setProfiles(list)
      return list
    } catch {
      return null
    }
  }, [])

  // Teacher: add / rename / delete students. Returns MATLAB's answer (or null).
  const editProfiles = useCallback(async (params, label) => {
    const d = await call('profiles', params, { label })
    if (!d) return null
    const list = asArray(d.students || d)
    if (list.length && list[0].id) setProfiles(list)
    return d
  }, [call])

  // ------------------------------------------------------------- sign-in
  const clearWork = useCallback(() => {
    setHistory([])
    setIndex(-1)
    setMeta(null)
    setProgress(null)
  }, [])

  const begin = useCallback(async (s, remember) => {
    setSession(s, remember)
    setSessionState({ token: s.token, role: s.role, profileId: s.profileId, name: s.name })
    setSessionMessage(null)
    setMustChangePassword(!!s.mustChange)
    clearWork()
    await refreshProfiles()
    if (s.role === 'student') await refreshProgress()
    return s
  }, [clearWork, refreshProfiles, refreshProgress])

  // Each throws MATLAB's message (wrong password, locked, needs a password ...)
  const login = useCallback(async (identifier, password, remember, claim = false) =>
    begin(await run('auth', { action: 'login', identifier, password, claim }), remember), [begin])
  const register = useCallback(async (name, roll, password, remember) =>
    begin(await run('auth', { action: 'register', name, roll, password }), remember), [begin])
  const teacherLogin = useCallback(async (pin) =>
    begin(await run('auth', { action: 'teacherLogin', pin }), false), [begin])

  const changePassword = useCallback(async (oldPassword, newPassword) => {
    await run('auth', { action: 'changePassword', oldPassword, newPassword })
    setMustChangePassword(false)
  }, [])

  const signOut = useCallback((message = null) => {
    if (getSession()) run('auth', { action: 'logout' }).catch(() => {})
    setSession(null)
    setSessionState(null)
    setMustChangePassword(false)
    setSessionMessage(message)
    setProfiles([])
    clearWork()
    window.location.hash = 'start'
  }, [clearWork])

  // MATLAB rejected the token (expired, password reset, MATLAB restarted)
  useEffect(() => {
    setSessionLostHandler((message) => {
      setSessionState(null)
      setMustChangePassword(false)
      setSessionMessage(message)
      clearWork()
      window.location.hash = 'start'
    })
    return () => setSessionLostHandler(null)
  }, [clearWork])

  // XP and level arrive with every answer to a signed-in student (labs, quizzes,
  // Code Lab, live quiz): keep the level chip and the profile menu current
  useEffect(() => {
    setXpHandler(({ xp, level }) => {
      setProgress((p) => (p && (p.xp !== xp || p.level !== level) ? { ...p, xp, level } : p))
      setProfiles((list) => (list.some((x) => x.id === getSession()?.profileId && x.xp !== xp)
        ? list.map((x) => (x.id === getSession()?.profileId ? { ...x, xp, level } : x)) : list))
    })
    return () => setXpHandler(null)
  }, [])

  // ------------------------------------------------------------- image state
  const setNewImage = useCallback((data) => {
    setHistory([{ id: data.id, label: `Loaded ${data.name}` }])
    setIndex(0)
    setMeta({ name: data.name, info: data.info, original: data.original, resized: data.resized })
  }, [])

  const loadSample = useCallback(async (name) => {
    const data = await call('loadSample', { name }, { label: `Loading ${name}` })
    if (data) {
      setNewImage(data)
      notify(`${name} loaded into MATLAB`)
    }
    return data
  }, [call, setNewImage, notify])

  const upload = useCallback(async (file) => {
    setBusy((b) => b + 1)
    setBusyLabel('Uploading image')
    try {
      const data = await uploadImage(file)
      setNewImage(data)
      notify(`${file.name} loaded`)
      return data
    } catch (err) {
      setAlertMsg({ title: 'Could not load image', text: err.message })
      return null
    } finally {
      setBusy((b) => Math.max(0, b - 1))
    }
  }, [setNewImage, notify])

  // Push a processed result as the new working image (enables undo/redo)
  const push = useCallback((id, label) => {
    setHistory((h) => [...h.slice(0, index + 1), { id, label }])
    setIndex((i) => i + 1)
    notify(`Workspace updated: ${label}`)
  }, [index, notify])

  const undo = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])
  const redo = useCallback(() => setIndex((i) => Math.min(history.length - 1, i + 1)), [history.length])
  const reset = useCallback(() => {
    if (history.length) {
      setHistory((h) => [h[0]])
      setIndex(0)
    }
  }, [history.length])

  const value = useMemo(() => ({
    matlab, call, notify, progress, refreshProgress,
    busy: busy > 0, busyLabel,
    alertMsg, setAlertMsg, toast,
    meta, history, index,
    original: history[0]?.id || null,
    current: history[index]?.id || null,
    currentLabel: history[index]?.label || '',
    canUndo: index > 0, canRedo: index < history.length - 1,
    loadSample, upload, push, undo, redo, reset,
    profiles, profileId,
    profile: profiles.find((x) => x.id === profileId) || (profileId ? { id: profileId, name: session.name, level: progress?.level ?? 1, xp: progress?.xp ?? 0 } : null),
    refreshProfiles, editProfiles,
    session, role, login, register, teacherLogin, signOut, changePassword, mustChangePassword, sessionMessage,
    theme, setTheme,
  }), [matlab, call, notify, progress, refreshProgress, busy, busyLabel, alertMsg, toast, meta, history, index,
    loadSample, upload, push, undo, redo, reset, profiles, profileId, refreshProfiles, editProfiles,
    session, role, login, register, teacherLogin, signOut, changePassword, mustChangePassword, sessionMessage, theme, setTheme])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
