import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useApp } from '../../AppContext'
import { asArray, run } from '../../api'
import Icon from '../../components/Icon'
import { Card, ImageView, Modal, Note, Segmented, Select } from '../../components/ui'
import { todayStr, useTeacher } from './TeacherData'

// The class's Code Lab tasks are written here by the teacher (backend
// services/code_tasks.py). Students see a task once it is published (open,
// assigned or locked); MATLAB grades their `out` against the result of the
// teacher's model solution on the same input image (codelab/codeTasks.m).
const MatlabEditor = lazy(() => import('../../components/MatlabEditor'))

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' }, { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' }, { value: 'locked', label: 'Locked' },
]
const PREPS = [
  { value: 'gray', label: 'Grayscale' }, { value: 'color', label: 'Colour (RGB)' },
  { value: 'saltpepper', label: 'Grayscale + salt & pepper noise' }, { value: 'binary', label: 'Binary (logical)' },
]
const COMPARES = [
  { value: 'image', label: 'Image: mean absolute difference ≤ tolerance', tol: 0.001 },
  { value: 'normalized', label: 'Image scaled to its maximum first (gradients, Laplacian …)', tol: 0.01 },
  { value: 'binary', label: 'Binary image: fraction of differing pixels ≤ tolerance', tol: 0.01 },
  { value: 'vector', label: 'Numbers (e.g. histogram counts): every value within tolerance', tol: 0 },
]
const STARTER = `% img : the input image, double values in [0,1]
% Task: store your result in the variable out

out = img;   % <- change this

imshow([img out])
`
const BLANK = {
  title: '', level: 'Easy', topic: '', instructions: '', starter: STARTER, solution: 'out = 1 - img;',
  hints: '', forbidden: '', sample: 'peppers.png', prep: 'gray', compare: 'image', tol: 0.001, border: 0,
  status: 'draft', due: '', note: '',
}
const lines = (v) => asArray(v).join('\n')
const toForm = (t) => ({ ...BLANK, ...t, instructions: lines(t.instructions), hints: lines(t.hints), forbidden: asArray(t.forbidden).join(', ') })

// ------------------------------------------------------------------ list
export default function CodeTasks() {
  const { overview, refresh } = useTeacher()
  const { notify, setAlertMsg } = useApp()
  const [tasks, setTasks] = useState(null)
  const [editing, setEditing] = useState(null)          // form object (with id when editing)
  const [removing, setRemoving] = useState(null)
  const total = overview?.studentCount || 0
  const stats = Object.fromEntries(asArray(overview?.codeTasks).map((t) => [t.id, t]))

  const call = useCallback(async (params) => {
    try {
      return await run('codeTaskEdit', params)
    } catch (err) {
      setAlertMsg({ title: 'Code Lab tasks', text: err.message })
      return null
    }
  }, [setAlertMsg])
  const changed = (list) => {
    if (list) setTasks(asArray(list))
    refresh({ force: true })
  }
  useEffect(() => { call({ action: 'list' }).then((d) => d && setTasks(asArray(d))) }, [call])

  const setState = async (t, patch) => changed(await call({ action: 'setState', id: t.id, status: t.status, due: t.due, note: t.note, ...patch }))
  const remove = async () => {
    const t = removing
    setRemoving(null)
    const d = await call({ action: 'remove', id: t.id })
    if (d) { changed(d); notify(`Deleted "${t.title}"`) }
  }

  return (
    <Card title="Code Lab tasks" extra={<button className="btn btn-primary btn-small" onClick={() => setEditing({ ...BLANK })}><Icon name="code" size={15} /> New task</button>}>
      <p className="small muted">
        Students only see the tasks you write here, once you publish them: <b>Open</b> (anyone may try it), <b>Assigned</b> (pinned
        to their dashboard with a due date) or <b>Locked</b> (visible, but cannot be run). <b>Drafts</b> are hidden. MATLAB checks each
        student’s <code>out</code> against the result of your model solution.
      </p>
      {!tasks ? <p className="muted">Loading…</p> : tasks.length === 0 ? (
        <div className="empty-state">
          <div className="ic"><Icon name="code" size={30} /></div>
          <h3>No Code Lab tasks yet</h3>
          <p className="small" style={{ maxWidth: 460 }}>Write your first task, or start from one of the built-in examples (negative, gamma, histogram, mean filter, Sobel, Otsu …) and adapt it.</p>
          <button className="btn btn-primary mt-sm" onClick={() => setEditing({ ...BLANK })}>New task</button>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data exp-table">
            <thead><tr><th>Task</th><th>Status</th><th>Due date & note</th><th>Solved</th><th /></tr></thead>
            <tbody>
              {tasks.map((t) => (
                <TaskRow key={t.id} t={t} stat={stats[t.id]} total={total} onState={(patch) => setState(t, patch)}
                  onEdit={() => setEditing(toForm(t))} onRemove={() => setRemoving(t)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <TaskEditor initial={editing} call={call} onClose={() => setEditing(null)}
        onSaved={(list, task) => { changed(list); setEditing(null); notify(`Saved "${task.title}"`) }} />}
      {removing && (
        <Modal title="Delete this task?" onClose={() => setRemoving(null)}>
          <p className="alert-text">“{removing.title}” and every student’s submissions for it will be deleted. XP already earned stays.</p>
          <div className="row right"><button className="btn" onClick={() => setRemoving(null)}>Cancel</button><button className="btn btn-primary" onClick={remove}>Delete</button></div>
        </Modal>
      )}
    </Card>
  )
}

function TaskRow({ t, stat, total, onState, onEdit, onRemove }) {
  const [due, setDue] = useState(t.due || '')
  const [note, setNote] = useState(t.note || '')
  useEffect(() => { setDue(t.due || ''); setNote(t.note || '') }, [t.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const overdue = t.status === 'assigned' && t.due && t.due < todayStr()
  const done = stat?.solvedBy || 0
  return (
    <tr className={t.status === 'locked' || t.status === 'draft' ? 'muted-row' : t.status === 'assigned' ? 'assigned-row' : ''}>
      <td>
        <b>{t.title}</b>
        <div className="tiny faint">{t.level}{t.topic ? ` · ${t.topic}` : ''} · <a href={`#code?task=${t.id}`}>preview</a>{stat ? ` · tried by ${stat.triedBy}` : ''}</div>
      </td>
      <td><Segmented value={t.status} onChange={(status) => onState({ status, due, note })} options={STATUS_OPTIONS} /></td>
      <td>
        {t.status === 'assigned' ? (
          <div className="assign-fields">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} onBlur={() => due !== (t.due || '') && onState({ due, note })} aria-label={`Due date for ${t.title}`} />
            <input type="text" value={note} maxLength={120} placeholder="Note for students (optional)" onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== (t.note || '') && onState({ due, note })} aria-label={`Note for ${t.title}`} />
            {overdue && <span className="badge badge-locked">overdue</span>}
          </div>
        ) : <span className="faint small">{t.status === 'draft' ? 'Hidden from students' : t.status === 'locked' ? 'Students cannot run it' : '—'}</span>}
      </td>
      <td>
        {t.status === 'draft' ? <span className="faint small">—</span> : (
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <div className="progressbar" style={{ width: 70 }}><div style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
            <span className="small">{done}/{total}</span>
          </div>
        )}
      </td>
      <td>
        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <button className="btn btn-small" onClick={onEdit}>Edit</button>
          <button className="btn btn-small btn-ghost btn-danger" onClick={onRemove} aria-label={`Delete ${t.title}`}>Delete</button>
        </div>
      </td>
    </tr>
  )
}

// ------------------------------------------------------------------ editor
function TaskEditor({ initial, call, onClose, onSaved }) {
  const [f, setF] = useState(initial)
  const [samples, setSamples] = useState([])
  const [templates, setTemplates] = useState([])
  const [check, setCheck] = useState(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setCheck(null) }
  const field = (k) => (e) => set({ [k]: e.target.value })

  useEffect(() => {
    run('samples').then((d) => setSamples(asArray(d).map((s) => s.name))).catch(() => {})
    if (!initial.id) call({ action: 'templates' }).then((d) => d && setTemplates(asArray(d)))
  }, [call, initial.id])

  const applyTemplate = (id) => {
    const t = templates.find((x) => x.id === id)
    if (t) set({ ...toForm({ ...t, id: undefined, status: f.status, due: f.due, note: f.note }), topic: t.topic })
  }
  const payload = () => ({ ...f, tol: Number(f.tol), border: Number(f.border) })
  const test = async () => {
    setChecking(true)
    setCheck(await call({ action: 'check', task: payload() }))
    setChecking(false)
  }
  const save = async () => {
    setSaving(true)
    const d = await call({ action: 'save', task: payload() })
    setSaving(false)
    if (d) onSaved(d.tasks, d.task)
  }

  return (
    <Modal title={initial.id ? `Edit task: ${initial.title}` : 'New Code Lab task'} onClose={onClose} wide>
      <div className="stack task-editor">
        {!initial.id && templates.length > 0 && (
          <Select label="Start from a built-in example (optional)" value="" onChange={applyTemplate}
            options={[{ value: '', label: '— blank task —' }, ...templates.map((t) => ({ value: t.id, label: `${t.title} (${t.level}, ${t.topic})` }))]} />
        )}
        <div className="grid-2">
          <label className="field"><span className="field-label">Title</span>
            <input type="text" value={f.title} maxLength={80} onChange={field('title')} placeholder="e.g. 3×3 mean filter with loops" /></label>
          <label className="field"><span className="field-label">Topic (optional)</span>
            <input type="text" value={f.topic} maxLength={60} onChange={field('topic')} placeholder="e.g. Spatial filtering" /></label>
        </div>
        <div className="row">
          <span className="field-label" style={{ margin: 0 }}>Level</span>
          <Segmented value={f.level} onChange={(level) => set({ level })} options={['Easy', 'Medium', 'Hard']} />
        </div>
        <label className="field"><span className="field-label">Instructions for the students (one paragraph per line)</span>
          <textarea rows={4} value={f.instructions} onChange={field('instructions')} /></label>

        <div className="grid-2">
          <Select label="Input image img" value={f.sample} onChange={(sample) => set({ sample })}
            options={(samples.length ? samples : [f.sample]).map((s) => ({ value: s, label: s }))} />
          <Select label="Prepared as" value={f.prep} onChange={(prep) => set({ prep })} options={PREPS} />
        </div>
        <p className="tiny faint" style={{ marginTop: -6 }}>The input is at most 256 pixels on a side and the same for every student and every run.</p>

        <div className="grid-2 task-code">
          <div>
            <span className="field-label">Starter code (what students see first)</span>
            <Suspense fallback={<pre className="code">{f.starter}</pre>}>
              <MatlabEditor value={f.starter} onChange={(starter) => setF((x) => ({ ...x, starter }))} height={220} label="Starter code" />
            </Suspense>
          </div>
          <div>
            <span className="field-label">Model solution (stores the expected result in out)</span>
            <Suspense fallback={<pre className="code">{f.solution}</pre>}>
              <MatlabEditor value={f.solution} onChange={(solution) => set({ solution })} onRun={test} height={220} label="Model solution" />
            </Suspense>
          </div>
        </div>

        <div className="grid-2">
          <Select label="How out is checked" value={f.compare} onChange={(compare) => set({ compare, tol: COMPARES.find((c) => c.value === compare).tol })}
            options={COMPARES.map((c) => ({ value: c.value, label: c.label }))} />
          <div className="grid-2" style={{ gap: 10 }}>
            <label className="field"><span className="field-label">Tolerance</span>
              <input type="number" min={0} step="any" value={f.tol} onChange={field('tol')} /></label>
            <label className="field"><span className="field-label">Ignore border (px)</span>
              <input type="number" min={0} max={10} value={f.border} onChange={field('border')} title="Edge pixels left out of the comparison, so any padding choice passes" /></label>
          </div>
        </div>

        <div className="grid-2">
          <label className="field"><span className="field-label">Hints (one per line, shown one at a time)</span>
            <textarea rows={3} value={f.hints} onChange={field('hints')} /></label>
          <label className="field"><span className="field-label">Functions students may not use (comma separated)</span>
            <textarea rows={3} value={f.forbidden} onChange={field('forbidden')} placeholder="e.g. imfilter, conv2, medfilt2" /></label>
        </div>

        <div className="row">
          <span className="field-label" style={{ margin: 0 }}>Status</span>
          <Segmented value={f.status} onChange={(status) => set({ status })} options={STATUS_OPTIONS} />
          {f.status === 'assigned' && (
            <>
              <input type="date" value={f.due} onChange={field('due')} aria-label="Due date" />
              <input type="text" value={f.note} maxLength={120} onChange={field('note')} placeholder="Note for students (optional)" aria-label="Note for students" />
            </>
          )}
        </div>

        {check && (
          <div className="task-check">
            <Note kind={check.ok ? 'ok' : 'error'}>{check.message}{check.size ? ` (out: ${check.size} ${check.class})` : ''}</Note>
            {check.output && <pre className="console">{check.output}</pre>}
            <div className="grid-2">
              <ImageView id={check.inputId} title="img (input)" height={200} />
              {check.expectedId ? <ImageView id={check.expectedId} title="Expected out (model solution)" height={200} /> : <div />}
            </div>
          </div>
        )}

        <div className="row between">
          <button className="btn" onClick={test} disabled={checking || !f.solution.trim()}>{checking ? 'MATLAB is running it…' : '▶ Test the model solution'}</button>
          <div className="row">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || !f.title.trim() || !f.instructions.trim() || !f.solution.trim()}>{saving ? 'Saving…' : 'Save task'}</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
