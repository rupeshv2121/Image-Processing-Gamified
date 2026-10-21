import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { asArray, getSession, run, serverStatus, setSession, setSessionLostHandler, uploadImage } from './api'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

export function AppProvider({ children }) {
  // remote: this browser is a student device on the classroom network (live quiz only)
  // lan: the addresses students open to join (classroom network mode, start_imagelab_lan.bat)
  const [matlab, setMatlab] = useState({ ready: false, ok: false, error: null, ipt: false, release: '', remote: false, lan: [] })
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
    const poll = async () => {
      try {
        const s = await serverStatus()
        if (s.ready) {
          if (s.matlab) {
            const ping = await run('ping')
            if (!stop) setMatlab({ ready: true, ok: true, error: null, ipt: ping.ipt, iptLicensed: ping.iptLicensed, release: ping.release, remote: !!s.remote, lan: s.lan || [] })
            // A remembered session is only valid while MATLAB still knows its token
            if (getSession()) {
              const me = await run('auth', { action: 'me' }).catch(() => null)
              if (me && !stop) {
                await refreshProfiles()
                refreshProgress()
              }
            }
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
          } else if (!stop) setMatlab({ ready: true, ok: false, error: s.error, remote: !!s.remote, lan: s.lan || [] })
          return
        }
      } catch {
        if (!stop) setMatlab((m) => ({ ...m, error: 'Waiting for the ImageLab server…' }))
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
