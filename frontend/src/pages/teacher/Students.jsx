import { useMemo, useState } from 'react'
import { asArray, fmt } from '../../api'
import { initials } from '../../components/Profiles'
import { Card, Page, Tabs } from '../../components/ui'
import { studentHref, TeacherError, timeAgo, useTeacher } from './TeacherData'

// Accuracy -> cell colour: red below 60 %, amber below 80 %, green above
const heat = (acc) => {
  if (acc == null || Number.isNaN(acc)) return null
  const hue = Math.max(0, Math.min(120, ((acc - 30) / 60) * 120))
  return `hsl(${hue} 70% 45%)`
}

const COLUMNS = [
  { key: 'name', label: 'Student', get: (s) => s.name.toLowerCase() },
  { key: 'roll', label: 'Roll', get: (s) => s.roll || '' },
  { key: 'level', label: 'Level', get: (s) => s.xp },
  { key: 'xp', label: 'XP', get: (s) => s.xp },
  { key: 'quizzes', label: 'Quizzes', get: (s) => s.quizzes },
  { key: 'accuracy', label: 'Accuracy', get: (s) => (s.questions ? s.accuracy : -1) },
  { key: 'codeSolved', label: 'Code tasks', get: (s) => s.codeSolved },
  { key: 'experiments', label: 'Experiments', get: (s) => asArray(s.experimentsDone).length },
  { key: 'assigned', label: 'Assigned done', get: (s) => (s.assignedDone + s.codeAssignedDone) / Math.max(1, s.assignedTotal + s.codeAssignedTotal) },
  { key: 'lastActive', label: 'Last active', get: (s) => s.lastActive || '' },
]

function Roster({ students, taskCount }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'name', dir: 1 })
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const col = COLUMNS.find((c) => c.key === sort.key)
    return students
      .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.roll || '').toLowerCase().includes(q))
      .slice()
      .sort((a, b) => { const x = col.get(a), y = col.get(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir })
  }, [students, query, sort])
  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : key === 'name' || key === 'roll' ? 1 : -1 }))

  return (
    <Card title={`Students (${students.length})`} extra={
      <input type="search" placeholder="Search name or roll no." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search students" style={{ width: 220 }} />}>
      <div className="table-scroll">
        <table className="data roster">
          <thead>
            <tr>{COLUMNS.map((c) => (
              <th key={c.key} aria-sort={sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                <button className="th-sort" onClick={() => sortBy(c.key)}>{c.label}{sort.key === c.key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</button>
              </th>))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const total = s.assignedTotal + s.codeAssignedTotal
              const done = s.assignedDone + s.codeAssignedDone
              return (
                <tr key={s.id}>
                  <td><a href={studentHref(s.id)} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><span className="avatar sm">{initials(s.name)}</span> <b>{s.name}</b></a></td>
                  <td>{s.roll || <span className="faint">—</span>}</td>
                  <td>{s.level}</td>
                  <td>{s.xp}</td>
                  <td>{s.quizzes}</td>
                  <td>{s.questions ? `${fmt(s.accuracy, 0)}%` : '—'}</td>
                  <td>{s.codeSolved} / {taskCount}</td>
                  <td>{asArray(s.experimentsDone).length} / 13</td>
                  <td>{total ? <span className={`badge ${done === total ? '' : 'badge-warn'}`}>{done} / {total}</span> : '—'}</td>
                  <td className="small muted" title={s.lastActive}>{timeAgo(s.lastActive)}</td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={COLUMNS.length} className="muted small">No student matches “{query}”.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Heatmap({ overview }) {
  const cats = asArray(overview.categories)
  const students = asArray(overview.students)
  return (
    <Card title="Quiz accuracy per student and topic">
      <div className="table-scroll">
        <table className="heatmap">
          <thead><tr><th>Student</th>{cats.map((c) => <th key={c}><span>{c}</span></th>)}</tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <th><a href={studentHref(s.id)}><span className="avatar sm">{initials(s.name)}</span> {s.name}</a></th>
                {asArray(s.topicAccuracy).map((a, i) => (
                  <td key={cats[i]} style={heat(a) ? { background: heat(a) } : undefined} title={`${s.name} · ${cats[i]}: ${a == null ? 'not tried' : `${fmt(a, 0)}%`}`}>
                    {a == null ? '' : Math.round(a)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny faint mt-sm">Quiz accuracy (%) per topic. Empty = not tried yet. Red &lt; 60 % · amber &lt; 80 % · green ≥ 80 %.</p>
    </Card>
  )
}

function WeakTopics({ overview }) {
  const weakest = asArray(overview.weakest)
  const answers = asArray(overview.students).reduce((a, s) => a + s.questions, 0)
  return (
    <Card title="Weakest topics of the class" extra={<span className="small faint">from {answers} quiz answers</span>}>
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
  )
}

export default function Students() {
  const { overview, students, refresh, loading } = useTeacher()
  const [tab, setTab] = useState(() => (window.location.hash.match(/[?&]tab=(\w+)/) || [])[1] || 'roster')
  return (
    <Page eyebrow="Teacher" title="Students" subtitle="Every student's progress. Click a name for the full picture, including their Code Lab work."
      actions={<button className="btn" onClick={() => refresh({ force: true })} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>}>
      <TeacherError />
      <Tabs tabs={[{ key: 'roster', label: 'Roster' }, { key: 'heatmap', label: 'Topic heatmap' }, { key: 'topics', label: 'Weak topics' }]} active={tab} onChange={setTab} />
      {!overview ? <p className="muted">Loading…</p> : (
        <>
          {tab === 'roster' && <Roster students={students} taskCount={asArray(overview.codeTasks).length} />}
          {tab === 'heatmap' && <Heatmap overview={overview} />}
          {tab === 'topics' && <WeakTopics overview={overview} />}
        </>
      )}
    </Page>
  )
}
