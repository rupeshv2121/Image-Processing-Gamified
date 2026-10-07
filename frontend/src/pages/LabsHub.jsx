import { useApp } from '../AppContext'
import Icon from '../components/Icon'
import { Page } from '../components/ui'
import { LABS, UNITS, unitProgress } from '../content/missions'

export default function LabsHub() {
  const { progress, meta } = useApp()
  const state = { imageLoaded: !!meta }
  return (
    <Page eyebrow="Laboratories" title="Choose a lab" subtitle="Labs are grouped by syllabus unit. Complete the missions on the right of each unit to finish the level.">
      {UNITS.map((u) => {
        const pr = unitProgress(u, progress, state)
        return (
          <section key={u.id} className="unit-block">
            <div className="unit-block-head">
              <span className="unit-num">{u.num}</span>
              <div style={{ flex: 1 }}>
                <h2>Unit {u.num} · {u.title}</h2>
                <p className="muted small">{u.subtitle}</p>
              </div>
              <div style={{ width: 180 }}>
                <div className="row between small"><span className="faint">Level progress</span><b>{pr.done}/{pr.total}</b></div>
                <div className="progressbar" style={{ marginTop: 6 }}><div style={{ width: `${pr.ratio * 100}%` }} /></div>
              </div>
            </div>
            <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', alignItems: 'start' }}>
              <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
                {u.labs.map((k) => (
                  <a key={k} className="tile" href={`#${k}`}>
                    <span className="ic"><Icon name={LABS[k].icon} size={22} /></span>
                    <b>{LABS[k].label}</b>
                    <span>{LABS[k].text}</span>
                  </a>
                ))}
              </div>
              <div className="stack-sm" style={{ gap: 8 }}>
                {u.missions.map((m) => {
                  const done = m.done(progress, state)
                  return (
                    <a key={m.text} className={`mission ${done ? 'done' : ''}`} href={`#${m.link}`}>
                      <span className="tick">✓</span>
                      <span className="t small">{m.text}</span>
                      {!done && <span className="xp">+10 XP</span>}
                    </a>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })}
    </Page>
  )
}
