import { useEffect, useState } from 'react'
import { asArray } from '../../api'
import { Card, Page, Segmented, Tabs } from '../../components/ui'
import { TeacherError, todayStr, useTeacher } from './TeacherData'

// One row of either table: open / assigned (with due date + note) / locked
function AssignRow({ rowKey, label, title, extra, item, done, total, onSave }) {
  const [due, setDue] = useState(item.due || '')
  const [note, setNote] = useState(item.note || '')
  // Local edits win: take saved values only when the row first appears, so a
  // refresh after saving one field never wipes what is being typed in the other
  useEffect(() => { setDue(item.due || ''); setNote(item.note || '') }, [rowKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = (patch) => onSave({ status: item.status, due, note, ...patch })
  const overdue = item.status === 'assigned' && item.due && item.due < todayStr()
  return (
    <tr className={item.status === 'locked' ? 'muted-row' : item.status === 'assigned' ? 'assigned-row' : ''}>
      <td><b>{label}</b></td>
      <td>{title}{extra}</td>
      <td>
        <Segmented value={item.status} onChange={(status) => save({ status })}
          options={[{ value: 'open', label: 'Open' }, { value: 'assigned', label: 'Assigned' }, { value: 'locked', label: 'Locked' }]} />
      </td>
      <td>
        {item.status === 'assigned' ? (
          <div className="assign-fields">
            <input type="date" value={due} onChange={(ev) => setDue(ev.target.value)} onBlur={() => due !== (item.due || '') && save({ due })} aria-label={`Due date for ${title}`} />
            <input type="text" value={note} maxLength={120} placeholder="Note for students (optional)" onChange={(ev) => setNote(ev.target.value)}
              onBlur={() => note !== (item.note || '') && save({ note })} aria-label={`Note for ${title}`} />
            {overdue && <span className="badge badge-locked">overdue</span>}
          </div>
        ) : <span className="faint small">{item.status === 'locked' ? 'Students cannot run it' : '—'}</span>}
      </td>
      <td>
        <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          <div className="progressbar" style={{ width: 70 }}><div style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
          <span className="small">{done}/{total}</span>
        </div>
      </td>
    </tr>
  )
}

export default function Assignments() {
  const { overview, act } = useTeacher()
  const [tab, setTab] = useState('code')
  const total = overview?.studentCount || 0
  const experiments = asArray(overview?.experiments)
  const tasks = asArray(overview?.codeTasks)

  return (
    <Page eyebrow="Teacher" title="Assignments" subtitle="Choose what students may do. Assigned work is pinned to every student's dashboard with its due date; locked work cannot be run.">
      <TeacherError />
      <Tabs tabs={[{ key: 'code', label: `Code Lab tasks (${tasks.length})` }, { key: 'experiments', label: `Experiments (${experiments.length})` }]} active={tab} onChange={setTab} />
      {!overview ? <p className="muted">Loading…</p> : tab === 'code' ? (
        <Card title="Code Lab tasks" extra={<span className="small faint">Changes apply immediately for every student</span>}>
          <div className="table-scroll">
            <table className="data exp-table">
              <thead><tr><th>Level</th><th>Task</th><th>Status</th><th>Due date & note</th><th>Solved</th></tr></thead>
              <tbody>
                {tasks.map((t) => (
                  <AssignRow key={t.id} rowKey={t.id} label={t.level} title={t.title} item={t} done={t.solvedBy} total={total}
                    extra={<div className="tiny faint">{t.unit} · {t.topic} · <a href={`#code?task=${t.id}`}>preview</a> · tried by {t.triedBy}</div>}
                    onSave={(x) => act({ action: 'setCodeTask', taskId: t.id, ...x })} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted mt-sm">MATLAB refuses to run <b>locked</b> tasks for students. As the teacher you can still open and run every task (your runs are never recorded) and see the model solution.</p>
        </Card>
      ) : (
        <Card title="Experiments" extra={<span className="small faint">Changes apply immediately for every student</span>}>
          <div className="table-scroll">
            <table className="data exp-table">
              <thead><tr><th>#</th><th>Experiment</th><th>Status</th><th>Due date & note</th><th>Completed</th></tr></thead>
              <tbody>
                {experiments.map((e) => (
                  <AssignRow key={e.number} rowKey={e.number} label={e.number} title={e.title} item={e} done={e.completedBy} total={total}
                    onSave={(x) => act({ action: 'setExperiment', number: e.number, ...x })} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted mt-sm"><b>Assigned</b> experiments are pinned to the top of the students’ Experiments page and their dashboard. <b>Locked</b> experiments cannot be run by students.</p>
        </Card>
      )}
    </Page>
  )
}
