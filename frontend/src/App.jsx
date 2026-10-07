import { useEffect, useState } from 'react'
import { useApp } from './AppContext'
import { imageUrl } from './api'
import Icon from './components/Icon'
import { Modal } from './components/ui'
import { LABS, UNITS } from './content/missions'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Achievements from './pages/Achievements'
import LabsHub from './pages/LabsHub'
import Learn from './pages/Learn'
import Workspace from './pages/Workspace'
import NoiseLab from './pages/NoiseLab'
import SpatialFilters from './pages/SpatialFilters'
import HistogramLab from './pages/HistogramLab'
import SharpeningLab from './pages/SharpeningLab'
import CorrelationLab from './pages/CorrelationLab'
import KernelPlayground from './pages/KernelPlayground'
import EdgeLab from './pages/EdgeLab'
import SegmentationLab from './pages/SegmentationLab'
import ColorLab from './pages/ColorLab'
import Fundamentals from './pages/Fundamentals'
import FilterComparison from './pages/FilterComparison'
import Experiments from './pages/Experiments'
import QuizHub from './pages/QuizHub'
import Leaderboard from './pages/Leaderboard'
import Reports from './pages/Reports'
import Documentation from './pages/Documentation'
import About from './pages/About'

const PAGES = {
  dashboard: Dashboard, achievements: Achievements, labs: LabsHub, learn: Learn, workspace: Workspace,
  noise: NoiseLab, filters: SpatialFilters, histogram: HistogramLab, sharpening: SharpeningLab,
  correlation: CorrelationLab, kernel: KernelPlayground, edges: EdgeLab, segmentation: SegmentationLab,
  color: ColorLab, fundamentals: Fundamentals, compare: FilterComparison, experiments: Experiments,
  quiz: QuizHub, leaderboard: Leaderboard, reports: Reports, docs: Documentation, about: About,
}

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

function NavLink({ to, icon, label, route }) {
  return (
    <a href={`#${to}`} className={`nav-link ${route === to ? 'active' : ''}`}>
      <Icon name={icon} size={18} /> {label}
    </a>
  )
}

function Sidebar({ route }) {
  const inLab = LAB_KEYS.includes(route) || route === 'labs'
  const [labsOpen, setLabsOpen] = useState(inLab)
  useEffect(() => { if (inLab) setLabsOpen(true) }, [inLab])
  const unitLabs = [
    ['Unit I', ['fundamentals']],
    ['Unit II', ['histogram', 'filters', 'correlation', 'kernel', 'sharpening', 'compare']],
    ['Unit III', ['noise', 'color']],
    ['Unit IV', ['edges', 'segmentation']],
  ]
  return (
    <aside className="sidebar">
      <a className="brand" href="#home">
        <span className="logo"><i /><i /><i /><i /></span>
        <span><b>ImageLab</b><small>Image Processing Laboratory</small></span>
      </a>
      <nav>
        <NavLink to="dashboard" icon="dashboard" label="Dashboard" route={route} />
        <NavLink to="workspace" icon="image" label="Workspace" route={route} />

        <div className="nav-section">Study</div>
        <NavLink to="learn" icon="book" label="Learn" route={route} />
        <button className={`nav-link ${labsOpen ? 'open' : ''} ${route === 'labs' ? 'active' : ''}`} onClick={() => setLabsOpen((o) => !o)}>
          <Icon name="flask" size={18} /> Labs <span className="chev"><Icon name="chevron" size={15} /></span>
        </button>
        {labsOpen && (
          <div className="nav-sub">
            <a href="#labs" className={`nav-link ${route === 'labs' ? 'active' : ''}`}>All labs</a>
            {unitLabs.map(([unit, keys]) => (
              <div key={unit}>
                <div className="nav-unit">{unit}</div>
                {keys.map((k) => (
                  <a key={k} href={`#${k}`} className={`nav-link ${route === k ? 'active' : ''}`}>{LABS[k].label}</a>
                ))}
              </div>
            ))}
          </div>
        )}
        <NavLink to="experiments" icon="file" label="Experiments" route={route} />

        <div className="nav-section">Play</div>
        <NavLink to="quiz" icon="gamepad" label="Arcade" route={route} />
        <NavLink to="leaderboard" icon="trophy" label="Leaderboard" route={route} />
        <NavLink to="achievements" icon="award" label="Achievements" route={route} />

        <div className="nav-section">More</div>
        <NavLink to="reports" icon="download" label="Reports" route={route} />
        <NavLink to="docs" icon="help" label="Documentation" route={route} />
        <NavLink to="about" icon="info" label="About" route={route} />
      </nav>
      <div className="sidebar-foot">Spatial-domain image processing · MATLAB</div>
    </aside>
  )
}

function TopBar({ onMenu }) {
  const { matlab, meta, current, progress } = useApp()
  const xp = progress?.xp || 0
  const level = progress?.level || 1
  const lo = (level - 1) ** 2 * 100
  const hi = level ** 2 * 100
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Menu"><Icon name="menu" /></button>
      <span className="pill" title={matlab.ok ? (matlab.ipt ? 'Image Processing Toolbox functions are used' : 'Toolbox not installed — ImageLab uses its manual MATLAB implementations') : ''}>
        <span className={`dot ${matlab.ok ? 'ok' : matlab.ready ? 'err' : 'wait'}`} />
        {matlab.ok ? <>MATLAB <b>{matlab.release}</b>{!matlab.ipt && <span className="faint">· manual mode</span>}</> : matlab.ready ? <span style={{ color: 'var(--red-500)' }}>MATLAB unavailable</span> : 'Starting MATLAB…'}
      </span>
      {meta && (
        <a className="pill" href="#workspace" title="Current workspace image">
          <img src={imageUrl(current)} alt="" /> <b>{meta.name}</b>
        </a>
      )}
      <span className="spacer" />
      <a className="level-chip" href="#achievements" title={`${xp} XP`}>
        <span className="lv">{level}</span>
        <span>Level {level}</span>
        <span className="xpbar"><i style={{ width: `${Math.min(100, ((xp - lo) / (hi - lo)) * 100)}%` }} /></span>
      </a>
    </header>
  )
}

export default function App() {
  const route = useHashRoute()
  const { busy, busyLabel, alertMsg, setAlertMsg, toast } = useApp()
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => setNavOpen(false), [route])

  const overlays = (
    <>
      {busy && <div className="busy"><span className="spinner" /> MATLAB · {busyLabel}…</div>}
      {toast && <div className="toast">{toast.text}</div>}
      {alertMsg && (
        <Modal title={alertMsg.title} onClose={() => setAlertMsg(null)}>
          <p className="alert-text">{alertMsg.text}</p>
          <div className="row right"><button className="btn btn-primary" onClick={() => setAlertMsg(null)}>OK</button></div>
        </Modal>
      )}
    </>
  )

  if (route === 'home' || !PAGES[route]) {
    return <><Landing />{overlays}</>
  }
  const PageComponent = PAGES[route]
  return (
    <div className={`app ${navOpen ? 'nav-open' : ''}`}>
      <Sidebar route={route} />
      <div className="main-col">
        <TopBar onMenu={() => setNavOpen((o) => !o)} />
        <main className="main"><PageComponent key={route} /></main>
      </div>
      {overlays}
    </div>
  )
}
