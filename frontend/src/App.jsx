import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useApp } from './AppContext'
import { cancelRun, imageUrl } from './api'
import Icon from './components/Icon'
import { ProfileMenu } from './components/Profiles'
import ThemeToggle from './components/ThemeToggle'
import { Modal } from './components/ui'
import { LABS, UNITS } from './content/missions'
import Landing from './pages/Landing'
import Start from './pages/Start'
import { ForcedPasswordChange } from './components/Account'
import { TeacherProvider } from './pages/teacher/TeacherData'

// Every page except the landing page is loaded on demand (its own JS chunk)
const PAGES = {
  dashboard: lazy(() => import('./pages/Dashboard')),
  achievements: lazy(() => import('./pages/Achievements')),
  labs: lazy(() => import('./pages/LabsHub')),
  learn: lazy(() => import('./pages/Learn')),
  workspace: lazy(() => import('./pages/Workspace')),
  noise: lazy(() => import('./pages/NoiseLab')),
  filters: lazy(() => import('./pages/SpatialFilters')),
  histogram: lazy(() => import('./pages/HistogramLab')),
  sharpening: lazy(() => import('./pages/SharpeningLab')),
  correlation: lazy(() => import('./pages/CorrelationLab')),
  kernel: lazy(() => import('./pages/KernelPlayground')),
  edges: lazy(() => import('./pages/EdgeLab')),
  segmentation: lazy(() => import('./pages/SegmentationLab')),
  morphology: lazy(() => import('./pages/MorphologyLab')),
  regions: lazy(() => import('./pages/RegionLab')),
  color: lazy(() => import('./pages/ColorLab')),
  fundamentals: lazy(() => import('./pages/Fundamentals')),
  compare: lazy(() => import('./pages/FilterComparison')),
  experiments: lazy(() => import('./pages/Experiments')),
  quiz: lazy(() => import('./pages/QuizHub')),
  live: lazy(() => import('./pages/LiveQuiz')),
  leaderboard: lazy(() => import('./pages/Leaderboard')),
  reports: lazy(() => import('./pages/Reports')),
  docs: lazy(() => import('./pages/Documentation')),
  about: lazy(() => import('./pages/About')),
  animate: lazy(() => import('./pages/Animations')),
  code: lazy(() => import('./pages/CodeLab')),
  // teacher mode
  class: lazy(() => import('./pages/teacher/ClassDashboard')),
  students: lazy(() => import('./pages/teacher/Students')),
  student: lazy(() => import('./pages/teacher/StudentDetail')),
  assign: lazy(() => import('./pages/teacher/Assignments')),
  submissions: lazy(() => import('./pages/teacher/Submissions')),
  classroom: lazy(() => import('./pages/teacher/ClassSettings')),
  livehost: lazy(() => import('./pages/teacher/LiveHost')),
}

// Pages that belong to one role only. Everything else (labs, Learn, Code Lab,
// Arcade ...) is open to both: the teacher uses it to demonstrate, and MATLAB
// records nothing in teacher mode.
const TEACHER_ONLY = ['class', 'students', 'student', 'assign', 'submissions', 'classroom', 'livehost']
const STUDENT_ONLY = ['dashboard', 'achievements', 'live']
const HOME = { student: 'dashboard', teacher: 'class' }

const LAB_KEYS = UNITS.flatMap((u) => u.labs).filter((k) => k !== 'workspace')

function useHashRoute() {
  const read = () => window.location.hash.replace('#', '').split(/[/?]/)[0] || 'home'
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onHash = () => {
      setRoute(read())
      document.querySelector('.main')?.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

function NavLink({ to, icon, label, route }) {
  return (
    <a href={`#${to}`} className={`nav-link ${route === to ? 'active' : ''}`} aria-current={route === to ? 'page' : undefined}>
      <Icon name={icon} size={18} /> {label}
    </a>
  )
}

function LabsNav({ route }) {
  const inLab = LAB_KEYS.includes(route) || route === 'labs'
  const [labsOpen, setLabsOpen] = useState(inLab)
  useEffect(() => { if (inLab) setLabsOpen(true) }, [inLab])
  const unitLabs = [
    ['Unit I', ['fundamentals']],
    ['Unit II', ['histogram', 'filters', 'correlation', 'kernel', 'sharpening', 'compare']],
    ['Unit III', ['noise', 'color']],
    ['Unit IV', ['edges', 'segmentation', 'morphology', 'regions']],
  ]
  return (
    <>
      <button className={`nav-link ${labsOpen ? 'open' : ''} ${route === 'labs' ? 'active' : ''}`} onClick={() => setLabsOpen((o) => !o)}
        aria-expanded={labsOpen} aria-controls="nav-labs">
        <Icon name="flask" size={18} /> Labs <span className="chev"><Icon name="chevron" size={15} /></span>
      </button>
      {labsOpen && (
        <div className="nav-sub" id="nav-labs">
          <a href="#labs" className={`nav-link ${route === 'labs' ? 'active' : ''}`} aria-current={route === 'labs' ? 'page' : undefined}>All labs</a>
          {unitLabs.map(([unit, keys]) => (
            <div key={unit} role="group" aria-label={unit}>
              <div className="nav-unit" aria-hidden="true">{unit}</div>
              {keys.map((k) => (
                <a key={k} href={`#${k}`} className={`nav-link ${route === k ? 'active' : ''}`} aria-current={route === k ? 'page' : undefined}>{LABS[k].label}</a>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function StudentNav({ route }) {
  return (
    <>
      <NavLink to="dashboard" icon="dashboard" label="My dashboard" route={route} />
      <NavLink to="workspace" icon="image" label="Workspace" route={route} />

      <div className="nav-section">Study</div>
      <NavLink to="learn" icon="book" label="Learn" route={route} />
      <NavLink to="animate" icon="play" label="Animations" route={route} />
      <LabsNav route={route} />
      <NavLink to="experiments" icon="file" label="Experiments" route={route} />
      <NavLink to="code" icon="code" label="Code Lab" route={route} />

      <div className="nav-section">Play</div>
      <NavLink to="live" icon="zap" label="Live quiz" route={route} />
      <NavLink to="quiz" icon="gamepad" label="Arcade" route={route} />
      <NavLink to="leaderboard" icon="trophy" label="Leaderboard" route={route} />
      <NavLink to="achievements" icon="award" label="Achievements" route={route} />

      <div className="nav-section">More</div>
      <NavLink to="reports" icon="download" label="Reports" route={route} />
      <NavLink to="docs" icon="help" label="Documentation" route={route} />
      <NavLink to="about" icon="info" label="About" route={route} />
    </>
  )
}

function TeacherNav({ route }) {
  return (
    <>
      <NavLink to="class" icon="dashboard" label="Class dashboard" route={route} />
      <NavLink to="students" icon="users" label="Students" route={route === 'student' ? 'students' : route} />
      <NavLink to="assign" icon="calendar" label="Assignments" route={route} />
      <NavLink to="livehost" icon="zap" label="Live quiz" route={route} />
      <NavLink to="submissions" icon="code" label="Code submissions" route={route} />
      <NavLink to="classroom" icon="sliders" label="Class settings" route={route} />

      <div className="nav-section">Teach & demonstrate</div>
      <NavLink to="workspace" icon="image" label="Workspace" route={route} />
      <NavLink to="learn" icon="book" label="Learn" route={route} />
      <NavLink to="animate" icon="play" label="Animations" route={route} />
      <LabsNav route={route} />
      <NavLink to="experiments" icon="file" label="Experiments" route={route} />
      <NavLink to="code" icon="code" label="Code Lab (preview)" route={route} />
      <NavLink to="quiz" icon="gamepad" label="Arcade & Classroom Mode" route={route} />
      <NavLink to="leaderboard" icon="trophy" label="Leaderboard" route={route} />

      <div className="nav-section">More</div>
      <NavLink to="docs" icon="help" label="Documentation" route={route} />
      <NavLink to="about" icon="info" label="About" route={route} />
    </>
  )
}

// A student's own phone / laptop on the classroom network: only the live quiz
function RemoteNav({ route }) {
  return (
    <>
      <NavLink to="live" icon="zap" label="Live quiz" route={route} />
      <p className="nav-note">On this device you can join the live quiz. The labs and everything else are on the ImageLab computer.</p>
    </>
  )
}

function Sidebar({ route, role, remote }) {
  return (
    <aside className={`sidebar ${role === 'teacher' ? 'sidebar-teacher' : ''}`} id="sidebar">
      <a className="brand" href={`#${HOME[role]}`}>
        <span className="logo" aria-hidden="true"><i /><i /><i /><i /></span>
        <span><b>ImageLab</b><small>{role === 'teacher' ? 'Teacher' : 'Image Processing Laboratory'}</small></span>
      </a>
      <nav aria-label="Main">
        {remote ? <RemoteNav route={route} /> : role === 'teacher' ? <TeacherNav route={route} /> : <StudentNav route={route} />}
      </nav>
      <div className="sidebar-foot">Spatial-domain image processing · MATLAB</div>
    </aside>
  )
}

function TopBar({ onMenu, navOpen }) {
  const { matlab, meta, current, progress, role } = useApp()
  const xp = progress?.xp || 0
  const level = progress?.level || 1
  const lo = (level - 1) ** 2 * 100
  const hi = level ** 2 * 100
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label={navOpen ? 'Close menu' : 'Open menu'} aria-expanded={navOpen} aria-controls="sidebar"><Icon name="menu" /></button>
      <span className="pill" role="status" title={matlab.ok ? (matlab.ipt ? 'Image Processing Toolbox functions are used' : 'Toolbox not installed — ImageLab uses its manual MATLAB implementations') : ''}>
        <span className={`dot ${matlab.ok ? 'ok' : matlab.ready ? 'err' : 'wait'}`} aria-hidden="true" />
        {matlab.ok ? <>MATLAB <b>{matlab.release}</b>{!matlab.ipt && <span className="faint">· manual mode</span>}</> : matlab.ready ? <span style={{ color: 'var(--red-500)' }}>MATLAB unavailable</span> : 'Starting MATLAB…'}
      </span>
      {meta && (
        <a className="pill" href="#workspace" title="Current workspace image">
          <img src={imageUrl(current)} alt="" /> <b>{meta.name}</b>
        </a>
      )}
      <span className="spacer" />
      <ThemeToggle />
      <ProfileMenu />
      {role === 'teacher' ? <span className="pill teacher-pill"><Icon name="lock" size={14} /> Teacher mode</span> : matlab.remote ? null : (
      <a className="level-chip" href="#achievements" title={`${xp} XP`} aria-label={`Level ${level}, ${xp} XP — achievements`}>
        <span className="lv">{level}</span>
        <span>Level {level}</span>
        <span className="xpbar" aria-hidden="true"><i style={{ width: `${Math.min(100, ((xp - lo) / (hi - lo)) * 100)}%` }} /></span>
      </a>)}
    </header>
  )
}

function Shortcuts({ onClose }) {
  const rows = [
    ['Ctrl + Z', 'Undo the last workspace step'],
    ['Ctrl + Y  /  Ctrl + Shift + Z', 'Redo'],
    ['1 – 4  or  A – D', 'Answer a quiz question'],
    ['Enter', 'Next quiz question'],
    ['← / →  (Shift = bigger steps)', 'Move a before/after slider'],
    ['Esc', 'Close a dialog, the theory panel or the menu'],
    ['?', 'Show this list'],
  ]
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <table className="data"><tbody>{rows.map(([k, t]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{t}</td></tr>)}</tbody></table>
    </Modal>
  )
}

function PageFallback() {
  return <div className="page page-loading" aria-busy="true"><span className="spinner dark" /> Loading…</div>
}

export default function App() {
  const route = useHashRoute()
  const { busy, busyLabel, alertMsg, setAlertMsg, toast, undo, redo, canUndo, canRedo, history, index, notify, role, mustChangePassword, matlab } = useApp()
  const remote = matlab.remote

  // Keep each role on its own side of the app (a remote device: live quiz only)
  const redirect = !role ? null
    : remote && route !== 'live' ? 'live'
    : route === 'teacher' || route === 'start' ? HOME[role]
      : role === 'student' && TEACHER_ONLY.includes(route) ? HOME.student
        : role === 'teacher' && STUDENT_ONLY.includes(route) ? HOME.teacher
          : null
  useEffect(() => { if (redirect) window.location.replace(`#${redirect}`) }, [redirect])
  const [navOpen, setNavOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [canCancel, setCanCancel] = useState(false)
  const main = useRef(null)
  // Offer "Cancel" once a MATLAB call has been running for more than a second
  useEffect(() => {
    if (!busy) { setCanCancel(false); return }
    const t = setTimeout(() => setCanCancel(true), 1000)
    return () => clearTimeout(t)
  }, [busy])
  useEffect(() => setNavOpen(false), [route])

  // Global keys: Esc closes the mobile menu, Ctrl+Z / Ctrl+Y undo and redo, ? lists shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && navOpen) { setNavOpen(false); return }
      if (isTyping(e.target) || document.querySelector('.modal-backdrop')) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z' && !e.shiftKey) {
        if (canUndo) { e.preventDefault(); undo(); notify(`Undo: ${history[index]?.label}`) }
      } else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
        if (canRedo) { e.preventDefault(); redo(); notify(`Redo: ${history[index + 1]?.label}`) }
      } else if (e.key === '?' && !mod) {
        setHelp(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen, canUndo, canRedo, undo, redo, history, index, notify])

  const overlays = (
    <>
      {busy && (
        <div className="busy" role="status">
          <span className="spinner" aria-hidden="true" /> MATLAB · {busyLabel}…
          {canCancel && <button className="busy-cancel" onClick={() => { setCanCancel(false); cancelRun() }}>Cancel</button>}
        </div>
      )}
      {toast && <div className="toast" role="status" aria-live="polite">{toast.text}</div>}
      {alertMsg && (
        <Modal title={alertMsg.title} onClose={() => setAlertMsg(null)}>
          <p className="alert-text" role="alert">{alertMsg.text}</p>
          <div className="row right"><button className="btn btn-primary" onClick={() => setAlertMsg(null)}>OK</button></div>
        </Modal>
      )}
      {help && <Shortcuts onClose={() => setHelp(false)} />}
    </>
  )

  // A student device on the classroom network skips the landing page (its demo runs image operations)
  if (!remote && (route === 'home' || (!PAGES[route] && route !== 'start' && route !== 'teacher'))) {
    return <><Landing />{overlays}</>
  }
  // Not signed in: the sign-in page. A deep link (#code?task=..., #student?id=...)
  // is opened after signing in.
  if (!role) {
    const hash = window.location.hash.replace('#', '')
    const next = remote ? { student: route === 'live' ? window.location.hash.replace('#', '') : 'live' } : route === 'start' || !PAGES[route] ? {} : {
      student: TEACHER_ONLY.includes(route) ? undefined : hash,
      teacher: STUDENT_ONLY.includes(route) ? undefined : hash,
    }
    return <><Start next={next} />{overlays}</>
  }
  if (mustChangePassword) return <><ForcedPasswordChange />{overlays}</>
  if (redirect) return null
  const PageComponent = PAGES[route]
  const shell = (
    <div className={`app ${navOpen ? 'nav-open' : ''} ${role === 'teacher' ? 'app-teacher' : ''}`}>
      <a className="skip-link" href="#main-content" onClick={(e) => { e.preventDefault(); main.current?.focus() }}>Skip to content</a>
      <Sidebar route={route} role={role} remote={remote} />
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}
      <div className="main-col">
        <TopBar onMenu={() => setNavOpen((o) => !o)} navOpen={navOpen} />
        <main className="main" id="main-content" ref={main} tabIndex={-1}>
          <Suspense fallback={<PageFallback />}>
            <PageComponent key={route} />
          </Suspense>
        </main>
      </div>
      {overlays}
    </div>
  )
  // Teacher pages share one class overview (fetched once, reused while fresh)
  return role === 'teacher' ? <TeacherProvider>{shell}</TeacherProvider> : shell
}
