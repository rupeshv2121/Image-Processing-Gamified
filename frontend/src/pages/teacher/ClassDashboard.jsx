import { useState } from 'react'
import { useApp } from '../../AppContext'
import { asArray, fmt } from '../../api'
import Icon from '../../components/Icon'
import { initials } from '../../components/Profiles'
import { Card, Metrics, Modal, Page } from '../../components/ui'
import { studentHref, TeacherError, timeAgo, todayStr, useTeacher } from './TeacherData'

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
  ['code', 'Code Lab: write a mean filter live in MATLAB'],
  ['quiz', 'Rapid Fire Quiz / Classroom Mode'],
]
const FEED_ICON = { quiz: 'zap', experiment: 'file', code: 'code', badge: 'award', daily: 'calendar', topic: 'book' }

export default function ClassDashboard() {
  const { matlab, loadSample } = useApp()
  const { overview, dashboard: d, students, loading, refresh } = useTeacher()
  const [tour, setTour] = useState(false)

  const startDemo = async () => {
    setTour(false)
    if (await loadSample('peppers.png')) window.location.hash = 'workspace'
  }

  const quizzers = students.filter((s) => s.questions > 0)
  const avgAcc = quizzers.length ? quizzers.reduce((a, s) => a + s.accuracy, 0) / quizzers.length : null
  const assignedExp = asArray(overview?.experiments).filter((e) => e.status === 'assigned')
  const assignedCode = asArray(overview?.codeTasks).filter((t) => t.status === 'assigned')
  const n = overview?.studentCount || 0
  const today = todayStr()

  return (
    <Page eyebrow="Teacher" title="Class dashboard" subtitle="How the class is doing, who needs help and what happened recently."
      actions={<>
        <button className="btn" onClick={() => setTour(true)}><Icon name="play" size={16} /> Demo tour</button>
        <button className="btn" onClick={() => refresh({ force: true })} disabled={loading}><Icon name="reset" size={16} /> {loading ? 'Refreshing…' : 'Refresh'}</button>
      </>}>
      <TeacherError />
      {!overview ? <p className="muted">{matlab.ok ? 'Building the class overview in MATLAB…' : 'Waiting for MATLAB…'}</p> : (
        <div className="stack">
          <Metrics items={[
            { label: 'Students', value: n },
            { label: 'Active this week', value: `${d.activeThisWeek} / ${n}` },
            { label: 'Average XP', value: Math.round(d.averageXp) },
            { label: 'Quiz accuracy', value: avgAcc == null ? '—' : `${fmt(avgAcc, 0)} %` },
            { label: 'Code tasks solved', value: `${d.codeSolved}`, },
            { label: 'Assigned work done', value: d.assignedCount ? `${fmt(d.assignedCompletion, 0)} %` : '—' },
          ]} />

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <Card title="Needs attention" extra={<a className="small" href="#students">All students →</a>}>
              {asArray(d.attention).length === 0 ? (
                <p className="muted small">Nobody is behind right now. 🎉</p>
              ) : (
                <ul className="attention">
                  {asArray(d.attention).map((a) => (
                    <li key={a.id}>
                      <a href={studentHref(a.id)} className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                        <span className="avatar sm">{initials(a.name)}</span>
                        <b className="grow">{a.name}</b>
                      </a>
                      <div className="attention-issues">{asArray(a.issues).map((t) => <span key={t} className="badge badge-warn">{t}</span>)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Recent activity">
              {asArray(d.feed).length === 0 ? <p className="muted small">No activity yet. It appears here as students solve tasks, finish quizzes and experiments.</p> : (
                <ul className="feed">
                  {asArray(d.feed).map((f, i) => (
                    <li key={`${f.studentId}-${f.time}-${i}`}>
                      <span className="feed-ic"><Icon name={FEED_ICON[f.type] || 'sparkles'} size={15} /></span>
                      <span className="grow"><a href={studentHref(f.studentId)}><b>{f.student}</b></a> · {f.text}</span>
                      <span className="tiny faint" title={f.time}>{timeAgo(f.time)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <Card title="Assigned work" extra={<a className="small" href="#assign">Manage →</a>}>
              {assignedExp.length + assignedCode.length === 0 ? (
                <p className="muted small">Nothing is assigned. Assign experiments or Code Lab tasks under <a href="#assign">Assignments</a>.</p>
              ) : (
                <div className="stack-sm">
                  {[...assignedExp.map((e) => ({ key: `e${e.number}`, title: `Experiment ${e.number}: ${e.title}`, done: e.completedBy, due: e.due })),
                    ...assignedCode.map((t) => ({ key: `c${t.id}`, title: `Code Lab: ${t.title}`, done: t.solvedBy, due: t.due }))].map((w) => (
                    <div key={w.key}>
                      <div className="row between small"><span>{w.title}</span>
                        <span>{w.due && <span className={`badge ${w.due < today ? 'badge-locked' : 'badge-warn'}`}>{w.due < today ? 'overdue' : `due ${w.due}`}</span>} {w.done}/{n}</span>
                      </div>
                      <div className="progressbar" style={{ marginTop: 6 }}><div style={{ width: `${n ? (w.done / n) * 100 : 0}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Weakest quiz topics" extra={<a className="small" href="#students?tab=topics">Details →</a>}>
              {asArray(overview.weakest).length === 0 ? <p className="muted small">No quiz answers yet.</p> : (
                <div className="stack-sm">
                  {asArray(overview.weakest).slice(0, 5).map((t) => (
                    <div key={t.category}>
                      <div className="row between small"><b>{t.category}</b><span>{fmt(t.accuracy, 0)}% · {t.answered} answers</span></div>
                      <div className={`progressbar ${t.accuracy < 60 ? 'danger' : t.accuracy < 80 ? 'warn' : ''}`} style={{ marginTop: 6 }}><div style={{ width: `${t.accuracy}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          <p className="tiny faint">Built by MATLAB at {overview.generated}.</p>
        </div>
      )}

      {tour && (
        <Modal title="Professor demonstration tour" onClose={() => setTour(false)}>
          <p className="muted small" style={{ marginBottom: 14 }}>The recommended order for a classroom demonstration. Each step opens the right lab. Nothing you do as the teacher is recorded as student progress.</p>
          <ol style={{ paddingLeft: 22, margin: 0, lineHeight: 2 }}>
            {DEMO_FLOW.map(([k, t], i) => <li key={i}><a href={`#${k}`} onClick={() => setTour(false)}>{t}</a></li>)}
          </ol>
          <div className="row right" style={{ marginTop: 18 }}>
            <button className="btn btn-primary" onClick={startDemo} disabled={!matlab.ok}>Start: load peppers.png</button>
          </div>
        </Modal>
      )}
    </Page>
  )
}
