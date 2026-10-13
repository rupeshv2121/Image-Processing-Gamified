import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt, run } from '../api'
import Icon from '../components/Icon'
import { initials, StudentsModal } from '../components/Profiles'
import { Card, Metrics, Note, Page, Segmented, Tabs } from '../components/ui'

const PIN_KEY = 'imagelab.teacherPin'
const readPin = () => { try { return sessionStorage.getItem(PIN_KEY) || '' } catch { return '' } }
const storePin = (p) => { try { sessionStorage.setItem(PIN_KEY, p) } catch { /* storage unavailable */ } }

// Accuracy → cell colour: red below 60 %, amber below 80 %, green above
const heat = (acc) => {
  if (acc == null || Number.isNaN(acc)) return null
  const hue = Math.max(0, Math.min(120, ((acc - 30) / 60) * 120))
  return `hsl(${hue} 70% 45%)`
}

function Unlock({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    try {
      await run('classroom', { action: 'unlock', pin })
      storePin(pin)
      onUnlock(pin)
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <Card className="unlock">
      <div className="ic"><Icon name="lock" size={28} /></div>
      <h2>Teacher area</h2>
      <p className="muted small">Enter the teacher PIN to see the class results and manage experiments.</p>
      <form className="row center mt-sm" onSubmit={submit}>
        <input type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)}
          aria-label="Teacher PIN" placeholder="PIN" style={{ width: 180 }} autoFocus />
        <button className="btn btn-primary" type="submit" disabled={!pin}>Unlock</button>
      </form>
      {error && <Note kind="error">{error}</Note>}
    </Card>
  )
}

function Heatmap({ report }) {
  const cats = asArray(report.categories)
  const students = asArray(report.students)
  return (
    <div className="table-scroll">
      <table className="heatmap">
        <thead>
          <tr><th>Student</th>{cats.map((c) => <th key={c}><span>{c}</span></th>)}</tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <th><span className="avatar sm">{initials(s.name)}</span> {s.name}</th>
              {asArray(s.topicAccuracy).map((a, i) => (
                <td key={cats[i]} style={heat(a) ? { background: heat(a) } : undefined} title={`${s.name} · ${cats[i]}: ${a == null ? 'not tried' : `${fmt(a, 0)}%`}`}>
                  {a == null ? '' : Math.round(a)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tiny faint mt-sm">Quiz accuracy (%) per topic. Empty = not tried yet. Red &lt; 60 % · amber &lt; 80 % · green ≥ 80 %.</p>
    </div>
  )
}

function ExperimentRow({ e, total, onSave }) {
  const [due, setDue] = useState(e.due || '')
  const [note, setNote] = useState(e.note || '')
  // Local edits win: the row only takes the saved values when it first appears, so a
  // reload triggered by saving one field never wipes what is being typed in the other
  useEffect(() => { setDue(e.due || ''); setNote(e.note || '') }, [e.number]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = (patch) => onSave({ number: e.number, status: e.status, due, note, ...patch })
  return (
    <tr className={e.status === 'locked' ? 'muted-row' : e.status === 'assigned' ? 'assigned-row' : ''}>
      <td><b>{e.number}</b></td>
      <td>{e.title}</td>
      <td>
        <Segmented value={e.status} onChange={(status) => save({ status })}
          options={[{ value: 'open', label: 'Open' }, { value: 'assigned', label: 'Assigned' }, { value: 'locked', label: 'Locked' }]} />
      </td>
      <td>
        {e.status === 'assigned' ? (
          <div className="assign-fields">
            <input type="date" value={due} onChange={(ev) => setDue(ev.target.value)} onBlur={() => due !== (e.due || '') && save({ due })} aria-label={`Due date for experiment ${e.number}`} />
            <input type="text" value={note} maxLength={120} placeholder="Note for students (optional)" onChange={(ev) => setNote(ev.target.value)}
              onBlur={() => note !== (e.note || '') && save({ note })} aria-label={`Note for experiment ${e.number}`} />
          </div>
        ) : <span className="faint small">{e.status === 'locked' ? 'Students cannot run it' : '—'}</span>}
      </td>
      <td>
        <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          <div className="progressbar" style={{ width: 70 }}><div style={{ width: `${total ? (e.completedBy / total) * 100 : 0}%` }} /></div>
          <span className="small">{e.completedBy}/{total}</span>
        </div>
      </td>
    </tr>
  )
}

export default function Teacher() {
  const { call, matlab, refreshProfiles } = useApp()
  const [settings, setSettings] = useState(null)
  const [pin, setPin] = useState(readPin)
  const [unlocked, setUnlocked] = useState(false)
  const [report, setReport] = useState(null)
  const [tab, setTab] = useState('overview')
  const [files, setFiles] = useState(null)
  const [manage, setManage] = useState(false)
  const [pinForm, setPinForm] = useState({ next: '', confirm: '' })
  const [pinMsg, setPinMsg] = useState(null)

  const load = useCallback(async (p = pin) => {
    const d = await call('classroom', { action: 'report', pin: p }, { label: 'Building the class report', quiet: true })
    if (d) { setReport(d); setUnlocked(true) } else { setUnlocked(false); storePin('') }
  }, [call, pin])

  useEffect(() => {
    if (!matlab.ok) return
    call('classroom', { action: 'get' }, { quiet: true }).then((s) => {
      if (!s) return
      setSettings(s)
      if (!s.hasPin || pin) load(pin)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matlab.ok])

  const saveExperiment = async (x) => {
    const s = await call('classroom', { action: 'setExperiment', pin, ...x }, { label: `Experiment ${x.number}: ${x.status}` })
    if (s) { setSettings(s); load() }
  }
  const exportReport = async () => {
    const f = await call('classroom', { action: 'export', pin }, { label: 'Writing CSV and Excel files' })
    if (f) setFiles(f)
  }
  const changePin = async (e, remove = false) => {
    e?.preventDefault()
    setPinMsg(null)
    const next = remove ? '' : pinForm.next
    if (!remove && next !== pinForm.confirm) { setPinMsg({ kind: 'error', text: 'The two PINs do not match.' }); return }
    const s = await call('classroom', { action: 'setPin', pin, newPin: next }, { label: 'Saving the PIN' })
    if (s) {
      setSettings(s)
      setPin(next)
      storePin(next)
      setPinForm({ next: '', confirm: '' })
      setPinMsg({ kind: 'ok', text: remove ? 'PIN removed — anyone can open the teacher area.' : 'PIN saved. It is asked again when this browser tab is closed.' })
    }
  }
  const lock = () => { storePin(''); setPin(''); setUnlocked(false); setReport(null) }

  if (!settings) return <Page eyebrow="Classroom" title="Teacher"><p className="muted">Waiting for MATLAB…</p></Page>
  if (settings.hasPin && !unlocked) {
    return <Page eyebrow="Classroom" title="Teacher"><Unlock onUnlock={(p) => { setPin(p); load(p) }} /></Page>
  }

  const students = asArray(report?.students)
  const weakest = asArray(report?.weakest)
  const experiments = asArray(report?.experiments)
  const assigned = experiments.filter((e) => e.status === 'assigned')
  const avg = students.filter((s) => s.questions > 0)
  return (
    <Page eyebrow="Classroom" title="Teacher" subtitle="Class results for every student profile on this computer, weak topics, and which experiments students may run."
      actions={<>
        <button className="btn" onClick={() => setManage(true)}><Icon name="users" size={16} /> Students</button>
        <button className="btn" onClick={() => load()}>Refresh</button>
        {settings.hasPin && <button className="btn btn-navy" onClick={lock}><Icon name="lock" size={16} /> Lock</button>}
      </>}>
      {!settings.hasPin && <Note kind="warn">No teacher PIN is set, so students can open this page. Set one under <b>PIN</b>.</Note>}
      {report && (
        <div className="mt-sm">
          <Metrics items={[
            { label: 'Students', value: report.studentCount },
            { label: 'Average quiz accuracy', value: avg.length ? `${fmt(avg.reduce((a, s) => a + s.accuracy, 0) / avg.length, 1)} %` : '—' },
            { label: 'Quizzes played', value: students.reduce((a, s) => a + s.quizzes, 0) },
            { label: 'Weakest topic', value: weakest[0]?.category || '—' },
            { label: 'Assigned experiments', value: assigned.length },
          ]} />
        </div>
      )}
      <div className="mt">
        <Tabs tabs={[{ key: 'overview', label: 'Overview' }, { key: 'topics', label: 'Weak topics' }, { key: 'experiments', label: 'Experiments' }, { key: 'export', label: 'Export' }, { key: 'pin', label: 'PIN' }]} active={tab} onChange={setTab} />

        {tab === 'overview' && report && (
          <div className="stack">
            <Card title="Students">
              <div className="table-scroll">
                <table className="data">
                  <thead><tr><th>Student</th><th>Roll</th><th>Level</th><th>XP</th><th>Badges</th><th>Quizzes</th><th>Accuracy</th><th>Daily streak</th><th>Experiments</th><th>Assigned done</th><th>Last quiz</th></tr></thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td><span className="avatar sm">{initials(s.name)}</span> <b>{s.name}</b></td>
                        <td>{s.roll || <span className="faint">—</span>}</td>
                        <td>{s.level}</td><td>{s.xp}</td><td>{s.badges}</td><td>{s.quizzes}</td>
                        <td>{s.questions ? `${fmt(s.accuracy, 0)}%` : '—'}</td>
                        <td>{s.dailyStreak ? `${s.dailyStreak} 🔥` : '—'}</td>
                        <td>{asArray(s.experimentsDone).length} / 13</td>
                        <td>{s.assignedTotal ? <span className={`badge ${s.assignedDone === s.assignedTotal ? '' : 'badge-warn'}`}>{s.assignedDone} / {s.assignedTotal}</span> : '—'}</td>
                        <td className="small muted">{s.lastQuiz || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card title="Topic accuracy per student"><Heatmap report={report} /></Card>
          </div>
        )}

        {tab === 'topics' && report && (
          <Card title="Weakest topics of the class" extra={<span className="small faint">from {students.reduce((a, s) => a + s.questions, 0)} quiz answers</span>}>
            {weakest.length ? (
              <div className="weak-list">
                {weakest.map((t, i) => (
                  <div key={t.category} className="weak-row">
                    <span className="weak-rank">{i + 1}</span>
                    <div className="grow">
                      <div className="row between"><b>{t.category}</b><span className="small">{fmt(t.accuracy, 0)}% · {t.correct}/{t.answered} correct</span></div>
                      <div className={`progressbar ${t.accuracy < 60 ? 'danger' : t.accuracy < 80 ? 'warn' : ''}`} style={{ marginTop: 6 }}><div style={{ width: `${t.accuracy}%` }} /></div>
                      {t.struggling > 0 && <div className="tiny" style={{ marginTop: 4, color: 'var(--red-500)' }}>{t.struggling} student{t.struggling > 1 ? 's' : ''} below 60 %</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="muted">No quiz answers yet. Results appear once students play quizzes under their own profile.</p>}
            <p className="small muted mt-sm">Tip: students can practise their own weak topics in <b>Arcade → Weak-Topic Practice</b>; revisit the weakest topics in class with <b>Classroom Mode</b>.</p>
          </Card>
        )}

        {tab === 'experiments' && report && (
          <Card title="Experiments" extra={<span className="small faint">Changes apply immediately for every student</span>}>
            <div className="table-scroll">
              <table className="data exp-table">
                <thead><tr><th>#</th><th>Experiment</th><th>Status</th><th>Due date & note</th><th>Completed</th></tr></thead>
                <tbody>{experiments.map((e) => <ExperimentRow key={e.number} e={e} total={report.studentCount} onSave={saveExperiment} />)}</tbody>
              </table>
            </div>
            <p className="small muted mt-sm"><b>Assigned</b> experiments are pinned to the top of the students’ Experiments page and their dashboard. <b>Locked</b> experiments cannot be run (MATLAB refuses the request).</p>
          </Card>
        )}

        {tab === 'export' && (
          <Card title="Export the class report">
            <p className="small">MATLAB writes the student table (one column per quiz topic) as <b>CSV</b>, and an <b>Excel</b> workbook with two sheets: <i>Students</i> and <i>Topics</i> (sorted from weakest to strongest).</p>
            <div className="row mt-sm">
              <button className="btn btn-primary" onClick={exportReport}><Icon name="download" size={16} /> Create CSV & Excel files</button>
              {files && <a className="btn btn-navy" href={`/reports/${files.xlsx}`} download>Download Excel (.xlsx)</a>}
              {files && <a className="btn" href={`/reports/${files.csv}`} download>Download CSV</a>}
            </div>
            {files && <p className="small muted mt-sm">Saved in reports/output/{files.xlsx}</p>}
          </Card>
        )}

        {tab === 'pin' && (
          <Card title={settings.hasPin ? 'Change the teacher PIN' : 'Set a teacher PIN'}>
            <form className="pin-form" onSubmit={changePin}>
              <label className="field"><span className="field-label">New PIN (4–32 characters)</span>
                <input type="password" autoComplete="new-password" value={pinForm.next} onChange={(e) => setPinForm({ ...pinForm, next: e.target.value })} /></label>
              <label className="field"><span className="field-label">Repeat the PIN</span>
                <input type="password" autoComplete="new-password" value={pinForm.confirm} onChange={(e) => setPinForm({ ...pinForm, confirm: e.target.value })} /></label>
              <div className="row">
                <button className="btn btn-primary" type="submit" disabled={pinForm.next.length < 4}>Save PIN</button>
                {settings.hasPin && <button className="btn btn-danger" type="button" onClick={(e) => changePin(e, true)}>Remove PIN</button>}
              </div>
            </form>
            {pinMsg && <Note kind={pinMsg.kind}>{pinMsg.text}</Note>}
            <p className="small muted mt-sm">MATLAB stores only a salted SHA-256 hash of the PIN in data/classroom.mat. It protects the class results, the export and the experiment settings.</p>
          </Card>
        )}
      </div>
      {manage && <StudentsModal onClose={() => { setManage(false); refreshProfiles(); load() }} />}
    </Page>
  )
}
