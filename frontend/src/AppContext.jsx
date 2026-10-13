import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { asArray, getProfileId, run, serverStatus, setProfileId, uploadImage } from './api'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

export function AppProvider({ children }) {
  const [matlab, setMatlab] = useState({ ready: false, ok: false, error: null, ipt: false, release: '' })
  const [history, setHistory] = useState([]) // [{id, label}]
  const [index, setIndex] = useState(-1)
  const [meta, setMeta] = useState(null) // {name, info, original, resized}
  const [progress, setProgress] = useState(null)
  const [busy, setBusy] = useState(0)
  const [busyLabel, setBusyLabel] = useState('')
  const [alertMsg, setAlertMsg] = useState(null)
  const [toast, setToast] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [profileId, setProfileState] = useState(getProfileId)
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
            if (!stop) setMatlab({ ready: true, ok: true, error: null, ipt: ping.ipt, iptLicensed: ping.iptLicensed, release: ping.release })
            await refreshProfiles()
            refreshProgress()
            // Deep link for demos: #filters?sample=peppers.png loads a sample image
            const m = window.location.hash.match(/[?&]sample=([\w.-]+)/)
            if (m && !stop) {
              const data = await run('loadSample', { name: m[1] }).catch(() => null)
              if (data && !stop) {
                setHistory([{ id: data.id, label: `Loaded ${data.name}` }])
                setIndex(0)
                setMeta({ name: data.name, info: data.info, original: data.original, resized: data.resized })
              }
            }
          } else if (!stop) setMatlab({ ready: true, ok: false, error: s.error })
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
      if (!quiet) setAlertMsg({ title: 'MATLAB says', text: err.message })
      return null
    } finally {
      setBusy((b) => Math.max(0, b - 1))
    }
  }, [])

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
  const refreshProfiles = useCallback(async () => {
    try {
      const list = asArray(await run('profiles', { action: 'list' }))
      setProfiles(list)
      if (!list.some((x) => x.id === getProfileId())) {   // deleted elsewhere
        setProfileId('default')
        setProfileState('default')
      }
      return list
    } catch {
      return null
    }
  }, [])

  const switchProfile = useCallback(async (id) => {
    setProfileId(id)
    setProfileState(id)
    const p = await refreshProgress()
    const who = profiles.find((x) => x.id === id)
    if (p && who) notify(`Signed in as ${who.name}`)
  }, [refreshProgress, profiles, notify])

  // Add / rename / delete a student. Returns the new list (or null on error).
  const editProfiles = useCallback(async (params, label) => {
    const list = await call('profiles', params, { label })
    if (!list) return null
    const arr = asArray(list)
    setProfiles(arr)
    if (!arr.some((x) => x.id === getProfileId())) {
      setProfileId('default')
      setProfileState('default')
      refreshProgress()
    }
    return arr
  }, [call, refreshProgress])

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

  const value = {
    matlab, call, notify, progress, refreshProgress,
    busy: busy > 0, busyLabel,
    alertMsg, setAlertMsg, toast,
    meta, history, index,
    original: history[0]?.id || null,
    current: history[index]?.id || null,
    currentLabel: history[index]?.label || '',
    canUndo: index > 0, canRedo: index < history.length - 1,
    loadSample, upload, push, undo, redo, reset,
    profiles, profileId, profile: profiles.find((x) => x.id === profileId) || null,
    refreshProfiles, switchProfile, editProfiles,
    theme, setTheme,
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
