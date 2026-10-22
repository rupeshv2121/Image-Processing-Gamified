import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray } from '../api'
import Icon from '../components/Icon'
import Ring from '../components/Ring'
import { Card } from '../components/ui'
import { TOPICS } from '../content/topics'
import { nextMission, UNITS, unitProgress } from '../content/missions'

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Dashboard() {
  const { progress, refreshProgress, matlab, meta, call, profile } = useApp()
  const [assignedList, setAssignedList] = useState([])
  const [codeTasks, setCodeTasks] = useState({ tasks: [], solved: [] })
  useEffect(() => { if (matlab.ok) refreshProgress() }, [matlab.ok, refreshProgress])
  useEffect(() => {
    if (!matlab.ok) return
    call('experiments', {}, { quiet: true }).then((d) => d && setAssignedList(asArray(d).filter((e) => e.status === 'assigned')))
    call('codeTasks', {}, { quiet: true }).then((d) => d && setCodeTasks({ tasks: asArray(d.tasks), solved: asArray(d.solved) }))
  }, [call, matlab.ok])

  const p = progress || {}
  const state = { imageLoaded: !!meta }
  const all = UNITS.flatMap((u) => u.missions)
  const doneCount = all.filter((m) => m.done(p, state)).length
  const next = nextMission(p, state)
  const homework = [
    ...assignedList.filter((e) => !asArray(p.experimentsCompleted).includes(e.number))
      .map((e) => ({ key: `e${e.number}`, tick: e.number, title: e.title, note: e.teacherNote, due: e.due, href: '#experiments' })),
    ...codeTasks.tasks.filter((t) => t.status === 'assigned' && !codeTasks.solved.includes(t.id))
      .map((t) => ({ key: `c${t.id}`, tick: <Icon name="code" size={14} />, title: `Code Lab: ${t.title}`, note: t.teacherNote, due: t.due, href: `#code?task=${t.id}` })),
  ].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))

  return (
    <div className="page">
      <section className="welcome">
        <div>
          <h1>{doneCount ? `Welcome back, ${profile?.name?.split(' ')[0] || 'to the lab'}` : `Welcome to Spatia${profile ? `, ${profile.name.split(' ')[0]}` : ''}`}</h1>
          <p>
            {doneCount === all.length
              ? 'Every mission complete — try the Arcade challenges or generate your reports.'
              : `You have completed ${doneCount} of ${all.length} missions across the four syllabus units.`}
          </p>
          <div className="row" style={{ marginTop: 22 }}>
            <a className="btn btn-primary" href="#code"><Icon name="code" size={16} /> Open the Code Lab</a>
            <a className="btn" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }} href="#labs">Browse labs</a>
          </div>
        </div>
        <Ring value={doneCount / all.length} size={150} stroke={12} track="rgba(255,255,255,0.12)" color="var(--green-400)"
          label={`${Math.round((doneCount / all.length) * 100)}%`} sub="quest complete" />
      </section>

      <a className="next-mission daily-card" href="#quiz?game=daily" style={{ marginBottom: 16, color: 'inherit', textDecoration: 'none' }}>
        <div className="ic amber"><Icon name="calendar" size={26} /></div>
        <div style={{ flex: 1 }}>
          <div className="tiny faint" style={{ fontWeight: 700, letterSpacing: 1 }}>DAILY CHALLENGE</div>
          <h3 style={{ marginTop: 2 }}>
            {asArray(p.dailyHistory).some((h) => h.solved && h.date === todayStr()) ? 'Solved today — come back tomorrow!' : 'Today’s “match the target” puzzle is waiting'}
          </h3>
        </div>
        <span className="badge badge-warn">{p.dailyStreak || 0} day streak 🔥</span>
        <Icon name="arrow" />
      </a>

      {homework.length > 0 && (
        <Card title={<><Icon name="file" size={18} /> Assigned by your teacher</>} className="homework">
          <div className="stack-sm" style={{ gap: 8 }}>
            {homework.map((e) => (
              <a key={e.key} className="mission" href={e.href}>
                <span className="tick">{e.tick}</span>
                <span className="t small"><b>{e.title}</b>{e.note ? ` — ${e.note}` : ''}</span>
                {e.due && <span className={`badge ${e.due < todayStr() ? 'badge-locked' : 'badge-warn'}`}>{e.due < todayStr() ? 'overdue' : `due ${e.due}`}</span>}
              </a>
            ))}
          </div>
        </Card>
      )}

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
        <div className="stat"><div className="ic violet"><Icon name="code" /></div><div><div className="v">{codeTasks.solved.length}<span className="faint" style={{ fontSize: 15 }}> / {codeTasks.tasks.length || 11}</span></div><div className="l">Code tasks solved</div></div></div>
        <div className="stat"><div className="ic"><Icon name="book" /></div><div><div className="v">{asArray(p.topicsCompleted).length}<span className="faint" style={{ fontSize: 15 }}> / {TOPICS.length}</span></div><div className="l">Topics read</div></div></div>
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
              ['target', 'Practise weak topics', '#quiz?game=weak'],
              ['sparkles', 'Restoration Lab', '#restoration'],
              ['edges', 'Link edges (Hough)', '#edges'],
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

    </div>
  )
}
