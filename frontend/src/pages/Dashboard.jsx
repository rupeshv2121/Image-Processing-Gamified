import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray } from '../api'
import Icon from '../components/Icon'
import Ring from '../components/Ring'
import { Card, Modal } from '../components/ui'
import { TOPICS } from '../content/topics'
import { nextMission, UNITS, unitProgress } from '../content/missions'

const DEMO_FLOW = [
  ['workspace', 'Load peppers.png and show the image information'],
  ['noise', 'Add salt & pepper noise and send it to the workspace'],
  ['filters', 'Apply the mean, median and Gaussian filters'],
  ['compare', 'Compare the filters (PSNR / SSIM / time)'],
  ['learn', 'Explain linear vs non-linear filters'],
  ['histogram', 'Show the histogram and equalise it'],
  ['correlation', 'Correlation: the kernel moving step by step'],
  ['correlation', 'Convolution: the kernel flipping'],
  ['kernel', 'Kernel Playground: change a kernel, see the result'],
  ['edges', 'Edge detection: Sobel vs Prewitt vs Canny'],
  ['quiz', 'Rapid Fire Quiz for the juniors'],
  ['leaderboard', 'Show the leaderboard'],
]

export default function Dashboard() {
  const { progress, refreshProgress, matlab, meta, loadSample } = useApp()
  const [tour, setTour] = useState(false)
  useEffect(() => { if (matlab.ok) refreshProgress() }, [matlab.ok, refreshProgress])

  const p = progress || {}
  const state = { imageLoaded: !!meta }
  const all = UNITS.flatMap((u) => u.missions)
  const doneCount = all.filter((m) => m.done(p, state)).length
  const next = nextMission(p, state)

  const startDemo = async () => {
    setTour(false)
    const d = await loadSample('peppers.png')
    if (d) window.location.hash = 'workspace'
  }

  return (
    <div className="page">
      <section className="welcome">
        <div>
          <div className="eyebrow" style={{ color: 'var(--green-400)' }}>Mission control</div>
          <h1>{doneCount ? 'Welcome back to the lab' : 'Welcome to ImageLab'}</h1>
          <p>
            {doneCount === all.length
              ? 'Every mission complete — try the Arcade challenges or generate your reports.'
              : `You have completed ${doneCount} of ${all.length} missions across the four syllabus units.`}
          </p>
          <div className="row" style={{ marginTop: 22 }}>
            <button className="btn btn-primary" onClick={() => setTour(true)}><Icon name="play" size={16} /> Professor demo tour</button>
            <a className="btn" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }} href="#labs">Browse labs</a>
          </div>
        </div>
        <Ring value={doneCount / all.length} size={150} stroke={12} track="rgba(255,255,255,0.12)" color="var(--green-400)"
          label={`${Math.round((doneCount / all.length) * 100)}%`} sub="quest complete" />
      </section>

      {next && (
        <a className="next-mission" href={`#${next.mission.link}`} style={{ marginBottom: 28, color: 'inherit', textDecoration: 'none' }}>
          <div className="ic"><Icon name="target" size={26} /></div>
          <div style={{ flex: 1 }}>
            <div className="tiny faint" style={{ fontWeight: 700, letterSpacing: 1 }}>NEXT MISSION · UNIT {next.unit.num}</div>
            <h3 style={{ marginTop: 2 }}>{next.mission.text}</h3>
          </div>
          <span className="badge badge-warn">+XP</span>
          <Icon name="arrow" />
        </a>
      )}

      <div className="stat-cards">
        <div className="stat"><div className="ic"><Icon name="file" /></div><div><div className="v">{asArray(p.experimentsCompleted).length}<span className="faint" style={{ fontSize: 15 }}> / 13</span></div><div className="l">Experiments</div></div></div>
        <div className="stat"><div className="ic navy"><Icon name="layers" /></div><div><div className="v">{p.filtersTested || 0}</div><div className="l">Filters tested</div></div></div>
        <div className="stat"><div className="ic amber"><Icon name="trophy" /></div><div><div className="v">{p.bestScore || 0}</div><div className="l">Best quiz score</div></div></div>
        <div className="stat"><div className="ic violet"><Icon name="book" /></div><div><div className="v">{asArray(p.topicsCompleted).length}<span className="faint" style={{ fontSize: 15 }}> / {TOPICS.length}</span></div><div className="l">Topics read</div></div></div>
      </div>

      <div className="grid-2 mt">
        <Card title="Your quest" extra={<a className="small" href="#labs">All labs →</a>}>
          <div className="stack-sm" style={{ gap: 18 }}>
            {UNITS.map((u) => {
              const pr = unitProgress(u, p, state)
              return (
                <a key={u.id} href={`#${u.lab}`} className="row" style={{ gap: 16, color: 'inherit', textDecoration: 'none' }}>
                  <span className="unit-num" style={{ width: 42, height: 42, fontSize: 15 }}>{u.num}</span>
                  <div style={{ flex: 1 }}>
                    <div className="row between"><b style={{ color: 'var(--navy-800)' }}>{u.title}</b><span className="small faint">{pr.done}/{pr.total}</span></div>
                    <div className="progressbar" style={{ marginTop: 8 }}><div style={{ width: `${pr.ratio * 100}%` }} /></div>
                  </div>
                </a>
              )
            })}
          </div>
        </Card>
        <Card title="Quick start">
          <div className="grid-2" style={{ gap: 14 }}>
            {[
              ['image', 'Load an image', '#workspace'],
              ['zap', 'Rapid Fire Quiz', '#quiz'],
              ['compare', 'Compare filters', '#compare'],
              ['file', 'Run an experiment', '#experiments'],
            ].map(([ic, t, href]) => (
              <a key={t} className="tile" href={href} style={{ padding: 18 }}>
                <span className="ic" style={{ width: 40, height: 40 }}><Icon name={ic} /></span>
                <b style={{ fontSize: 15 }}>{t}</b>
              </a>
            ))}
          </div>
        </Card>
      </div>

      {tour && (
        <Modal title="Professor demonstration tour" onClose={() => setTour(false)}>
          <p className="muted small" style={{ marginBottom: 14 }}>The recommended order for the classroom demonstration. Each step opens the right lab.</p>
          <ol style={{ paddingLeft: 22, margin: 0, lineHeight: 2 }}>
            {DEMO_FLOW.map(([k, t], i) => <li key={i}><a href={`#${k}`} onClick={() => setTour(false)}>{t}</a></li>)}
          </ol>
          <div className="row right" style={{ marginTop: 18 }}>
            <button className="btn btn-primary" onClick={startDemo} disabled={!matlab.ok}>Start: load peppers.png</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
