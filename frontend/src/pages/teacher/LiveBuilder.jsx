import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../AppContext'
import { asArray, run } from '../../api'
import Icon from '../../components/Icon'
import { BOARD_SIZES, LETTERS } from '../../components/LiveParts'
import { Card, Modal, Note, Segmented } from '../../components/ui'

// The teacher's live quiz editor: title, instructions, rules and the question
// list (from the MATLAB question bank and/or the teacher's own questions).
// MATLAB validates everything again when the quiz is opened or saved.

const TIMES = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180]
const DRAFT_KEY = 'imagelab.liveDraft'
export const DEFAULT_SETTINGS = {
  timeLimit: 20, speedPoints: true, leaderboard: 'top5', showLeaderboard: true,
  autoReveal: true, lateJoin: true, shuffleQuestions: false, shuffleOptions: false,
}
export const emptyDraft = () => ({ id: '', title: '', instructions: '', settings: { ...DEFAULT_SETTINGS }, questions: [] })
let uid = 0
const withKey = (q) => ({ ...q, _k: `q${++uid}` })
const opts = (q) => asArray(q.options)

// A saved set / MATLAB item -> editor draft
export function toDraft(set) {
  return {
    id: set.id || '', title: set.title || '', instructions: set.instructions || '',
    settings: { ...DEFAULT_SETTINGS, ...(set.settings || {}) },
    questions: asArray(set.questions).map((q) => withKey({ ...q, options: opts(q) })),
  }
}
// Editor draft -> what MATLAB expects
export function toQuiz(d) {
  return { ...d, questions: d.questions.map(({ _k, ...q }) => q) }
}

// Draft kept in this browser only, so a reload never loses work
export function useDraft() {
  const [draft, setDraft] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return d ? toDraft(d) : emptyDraft() } catch { return emptyDraft() }
  })
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(toQuiz(draft))) } catch { /* storage unavailable */ }
  }, [draft])
  return [draft, setDraft]
}

export default function LiveBuilder({ draft, setDraft, onOpen, opening }) {
  const { call, notify } = useApp()
  const [picker, setPicker] = useState(false)
  const [editing, setEditing] = useState(null)        // {index, question} | {index: -1}
  const [random, setRandom] = useState(false)
  const s = draft.settings
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const setS = (patch) => setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  const setQ = (fn) => setDraft((d) => ({ ...d, questions: fn(d.questions) }))
  const move = (i, by) => setQ((qs) => {
    const j = i + by
    if (j < 0 || j >= qs.length) return qs
    const c = [...qs];
    [c[i], c[j]] = [c[j], c[i]]
    return c
  })
  const addMany = (items) => {
    const have = new Set(draft.questions.map((q) => q.bankId).filter(Boolean))
    const fresh = items.filter((q) => !q.bankId || !have.has(q.bankId))
    setQ((qs) => [...qs, ...fresh.map((q) => withKey({ ...q, options: opts(q), timeLimit: 0 }))])
    notify(fresh.length ? `${fresh.length} question${fresh.length === 1 ? '' : 's'} added` : 'Those questions are already in the quiz', fresh.length ? 'ok' : 'warn')
  }
  const totalTime = draft.questions.reduce((a, q) => a + (q.timeLimit || s.timeLimit), 0)

  const save = async () => {
    const list = await call('live', { action: 'saveSet', set: toQuiz(draft) }, { label: 'Saving the quiz' })
    if (list) {
      const saved = asArray(list)[0]
      set({ id: saved.id })
      notify(`Saved “${saved.title}”`)
    }
  }

  return (
    <div className="stack">
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title="Quiz & instructions">
          <div className="controls">
            <label className="field">
              <span className="field-label">Title</span>
              <input type="text" maxLength={80} value={draft.title} placeholder="e.g. Unit II — spatial filters" onChange={(e) => set({ title: e.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">Instructions for students <span className="faint">{draft.instructions.length}/1500</span></span>
              <textarea className="live-textarea" rows={6} maxLength={1500} value={draft.instructions}
                placeholder={'Shown to students while they wait, e.g.\n• Work on your own — no talking.\n• Keep this page open; questions appear automatically.\n• Read every option before you answer.'}
                onChange={(e) => set({ instructions: e.target.value })} />
            </label>
          </div>
        </Card>
        <Card title="Rules">
          <div className="controls">
            <label className="field">
              <span className="field-label">Time per question <b>{s.timeLimit} s</b></span>
              <Segmented value={s.timeLimit} onChange={(v) => setS({ timeLimit: v })} options={TIMES.map((t) => ({ value: t, label: `${t}s` }))} />
              <span className="tiny faint">Each question can have its own time in the list below.</span>
            </label>
            <div className="field">
              <span className="field-label">Leaderboard shows</span>
              <Segmented value={s.leaderboard} onChange={(v) => setS({ leaderboard: v })} options={BOARD_SIZES} />
            </div>
            <div className="live-checks">
              <Check value={s.speedPoints} onChange={(v) => setS({ speedPoints: v })} label="Speed bonus" hint="Correct answers earn 500–1000 points depending on the answer time (off: always 1000)" />
              <Check value={s.showLeaderboard} onChange={(v) => setS({ showLeaderboard: v })} label="Leaderboard on students’ devices" hint="After every question each student sees the board and their own rank" />
              <Check value={s.autoReveal} onChange={(v) => setS({ autoReveal: v })} label="Reveal when everyone has answered" hint="Otherwise the answer is shown when the timer ends (or when you click Reveal)" />
              <Check value={s.lateJoin} onChange={(v) => setS({ lateJoin: v })} label="Allow late joining" hint="Students may join after the first question" />
              <Check value={s.shuffleQuestions} onChange={(v) => setS({ shuffleQuestions: v })} label="Shuffle the question order" />
              <Check value={s.shuffleOptions} onChange={(v) => setS({ shuffleOptions: v })} label="Shuffle the answer order" hint="Same order for everybody, so the projector matches the devices" />
            </div>
          </div>
        </Card>
      </div>

      <Card title={`Questions (${draft.questions.length})`}
        extra={<span className="small faint">{draft.questions.length ? `≈ ${Math.ceil(totalTime / 60)} min of answering time` : 'Max. 50 questions'}</span>}>
        <div className="row">
          <button className="btn" onClick={() => setPicker(true)}><Icon name="book" size={16} /> From the question bank</button>
          <button className="btn" onClick={() => setRandom(true)}><Icon name="sparkles" size={16} /> Random questions</button>
          <button className="btn" onClick={() => setEditing({ index: -1 })}><Icon name="file" size={16} /> Write a question</button>
          <span className="spacer" />
          {draft.questions.length > 0 && <button className="btn btn-ghost btn-small btn-danger" onClick={() => setQ(() => [])}>Remove all</button>}
        </div>
        {draft.questions.length === 0 ? (
          <p className="muted small mt">No questions yet. Pick them from the ImageLab question bank, draw a random set, or write your own.</p>
        ) : (
          <ol className="live-qlist">
            {draft.questions.map((q, i) => (
              <li key={q._k}>
                <span className="n">{i + 1}</span>
                <div className="grow">
                  <div className="qt">{q.question}</div>
                  <div className="tiny faint">
                    <span className={`badge ${q.bankId ? 'badge-navy' : 'badge-violet'}`}>{q.bankId || 'own question'}</span> {q.category} · {q.difficulty} ·
                    {' '}answer <b>{LETTERS[q.answer - 1]}</b>: {opts(q)[q.answer - 1]}
                  </div>
                </div>
                <select value={q.timeLimit || 0} aria-label={`Time for question ${i + 1}`}
                  onChange={(e) => setQ((qs) => qs.map((x, j) => (j === i ? { ...x, timeLimit: Number(e.target.value) } : x)))}>
                  <option value={0}>Default ({s.timeLimit}s)</option>
                  {TIMES.map((t) => <option key={t} value={t}>{t} s</option>)}
                </select>
                <div className="live-qtools">
                  <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">▲</button>
                  <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === draft.questions.length - 1} aria-label="Move down">▼</button>
                  {!q.bankId && <button className="icon-btn" onClick={() => setEditing({ index: i, question: q })} aria-label="Edit"><Icon name="sliders" size={15} /></button>}
                  <button className="icon-btn" onClick={() => setQ((qs) => qs.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="close" size={15} /></button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="row right live-actions">
        <button className="btn" onClick={() => setDraft(emptyDraft())}>New empty quiz</button>
        <button className="btn btn-navy" onClick={save} disabled={!draft.questions.length || !draft.title.trim()}><Icon name="download" size={16} /> {draft.id ? 'Save changes' : 'Save quiz'}</button>
        <button className="btn btn-primary btn-lg" onClick={onOpen} disabled={!draft.questions.length || opening}><Icon name="play" size={16} /> Open lobby & show join code</button>
      </div>

      {picker && <BankPicker have={draft.questions} onClose={() => setPicker(false)} onAdd={(items) => { addMany(items); setPicker(false) }} />}
      {random && <RandomPicker onClose={() => setRandom(false)} onAdd={(items) => { addMany(items); setRandom(false) }} />}
      {editing && (
        <QuestionEditor initial={editing.question} onClose={() => setEditing(null)}
          onSave={(q) => {
            setQ((qs) => (editing.index < 0 ? [...qs, withKey(q)] : qs.map((x, j) => (j === editing.index ? { ...x, ...q } : x))))
            setEditing(null)
          }} />
      )}
    </div>
  )
}

function Check({ value, onChange, label, hint }) {
  return (
    <label className="check live-check">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      <span><b>{label}</b>{hint && <span className="tiny faint"><br />{hint}</span>}</span>
    </label>
  )
}

function useCategories() {
  const [cats, setCats] = useState([])
  useEffect(() => { run('quizCategories').then((c) => setCats(asArray(c))).catch(() => {}) }, [])
  return cats
}

function BankPicker({ have, onClose, onAdd }) {
  const [bank, setBank] = useState(null)
  const [cat, setCat] = useState('all')
  const [diff, setDiff] = useState('all')
  const [text, setText] = useState('')
  const [chosen, setChosen] = useState(() => new Set())
  const inQuiz = useMemo(() => new Set(have.map((q) => q.bankId).filter(Boolean)), [have])
  useEffect(() => { run('live', { action: 'bank' }).then((b) => setBank(asArray(b))).catch((e) => setBank(e)) }, [])
  const list = Array.isArray(bank) ? bank : []
  const cats = [...new Set(list.map((q) => q.category))]
  const shown = list.filter((q) => (cat === 'all' || q.category === cat) && (diff === 'all' || q.difficulty === diff)
    && (!text || q.question.toLowerCase().includes(text.toLowerCase())))
  const toggle = (id) => setChosen((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n })
  return (
    <Modal title="Pick from the question bank" onClose={onClose} wide>
      <div className="row">
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Topic">
          <option value="all">All topics</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <Segmented value={diff} onChange={setDiff} options={['all', 'easy', 'medium', 'hard']} />
        <input type="search" placeholder="Search questions…" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
      </div>
      {bank instanceof Error && <Note kind="error">{bank.message}</Note>}
      {!bank && <p className="muted mt-sm">Loading the question bank from MATLAB…</p>}
      <div className="live-bank mt-sm">
        {shown.map((q) => {
          const added = inQuiz.has(q.bankId)
          return (
            <label key={q.bankId} className={`live-bankrow ${added ? 'added' : ''}`}>
              <input type="checkbox" disabled={added} checked={added || chosen.has(q.bankId)} onChange={() => toggle(q.bankId)} />
              <div>
                <div>{q.question}</div>
                <div className="tiny faint">{q.bankId} · {q.category} · {q.difficulty} · answer: {opts(q)[q.answer - 1]}{added ? ' · already in the quiz' : ''}</div>
              </div>
            </label>
          )
        })}
        {bank && !shown.length && <p className="muted small">No question matches.</p>}
      </div>
      <div className="row right mt-sm">
        <span className="small muted">{chosen.size} selected</span>
        <button className="btn" onClick={() => setChosen(new Set(shown.filter((q) => !inQuiz.has(q.bankId)).map((q) => q.bankId)))}>Select all shown</button>
        <button className="btn btn-primary" disabled={!chosen.size} onClick={() => onAdd(list.filter((q) => chosen.has(q.bankId)))}>Add {chosen.size || ''} question{chosen.size === 1 ? '' : 's'}</button>
      </div>
    </Modal>
  )
}

function RandomPicker({ onClose, onAdd }) {
  const cats = useCategories()
  const [n, setN] = useState(10)
  const [diff, setDiff] = useState('mixed')
  const [chosen, setChosen] = useState([])
  const [error, setError] = useState(null)
  const pick = async () => {
    setError(null)
    try {
      onAdd(asArray(await run('live', { action: 'pick', n, difficulty: diff, categories: chosen.length ? chosen : 'all' })))
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <Modal title="Random questions" onClose={onClose}>
      <div className="controls">
        <label className="field">
          <span className="field-label">How many <b>{n}</b></span>
          <input type="range" min={1} max={30} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </label>
        <div className="field">
          <span className="field-label">Difficulty</span>
          <Segmented value={diff} onChange={setDiff} options={['mixed', 'easy', 'medium', 'hard']} />
        </div>
        <div className="field">
          <span className="field-label">Topics <span className="faint">{chosen.length ? `${chosen.length} chosen` : 'all topics'}</span></span>
          <div className="live-chips">
            {cats.map((c) => (
              <button key={c} className={`chip ${chosen.includes(c) ? 'on' : ''}`} aria-pressed={chosen.includes(c)}
                onClick={() => setChosen((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}>{c}</button>
            ))}
          </div>
        </div>
        {error && <Note kind="error">{error}</Note>}
        <div className="row right"><button className="btn btn-primary" onClick={pick}><Icon name="sparkles" size={16} /> Draw {n} questions</button></div>
      </div>
    </Modal>
  )
}

function QuestionEditor({ initial, onClose, onSave }) {
  const cats = useCategories()
  const [q, setQ] = useState(() => initial ? { ...initial, options: [...opts(initial)] } : {
    bankId: '', question: '', options: ['', '', '', ''], answer: 1, category: 'General', difficulty: 'medium', explanation: '', timeLimit: 0,
  })
  const [error, setError] = useState(null)
  const setOpt = (i, v) => setQ((x) => ({ ...x, options: x.options.map((o, j) => (j === i ? v : o)) }))
  const removeOpt = (i) => setQ((x) => ({
    ...x, options: x.options.filter((_, j) => j !== i),
    answer: x.answer === i + 1 ? 1 : x.answer > i + 1 ? x.answer - 1 : x.answer,
  }))
  const submit = (e) => {
    e.preventDefault()
    const options = q.options.map((o) => o.trim())
    if (!q.question.trim()) return setError('Write the question.')
    if (options.length < 2 || options.some((o) => !o)) return setError('Fill in every answer (at least 2).')
    onSave({ ...q, question: q.question.trim(), options })
    return null
  }
  return (
    <Modal title={initial ? 'Edit question' : 'Write a question'} onClose={onClose} wide>
      <form className="controls" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Question</span>
          <textarea className="live-textarea" rows={3} maxLength={300} value={q.question} onChange={(e) => setQ({ ...q, question: e.target.value })}
            placeholder="e.g. Which filter removes salt & pepper noise best?" />
        </label>
        <div className="field">
          <span className="field-label">Answers — select the correct one</span>
          {q.options.map((o, i) => (
            <div key={i} className="live-optedit">
              <label className="check" title="Correct answer">
                <input type="radio" name="correct" checked={q.answer === i + 1} onChange={() => setQ({ ...q, answer: i + 1 })} aria-label={`Answer ${LETTERS[i]} is correct`} />
                <span className="letter">{LETTERS[i]}</span>
              </label>
              <input type="text" maxLength={120} value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Answer ${LETTERS[i]}`} />
              <button type="button" className="icon-btn" onClick={() => removeOpt(i)} disabled={q.options.length <= 2} aria-label={`Remove answer ${LETTERS[i]}`}><Icon name="close" size={15} /></button>
            </div>
          ))}
          <div className="row">
            <button type="button" className="btn btn-small" disabled={q.options.length >= 6} onClick={() => setQ({ ...q, options: [...q.options, ''] })}>+ Answer</button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setQ({ ...q, options: ['True', 'False'], answer: 1 })}>Make it True / False</button>
          </div>
        </div>
        <div className="grid-3">
          <label className="field">
            <span className="field-label">Topic</span>
            <select value={q.category} onChange={(e) => setQ({ ...q, category: e.target.value })}>
              <option value="General">General (not a course topic)</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Difficulty</span>
            <select value={q.difficulty} onChange={(e) => setQ({ ...q, difficulty: e.target.value })}>
              {['easy', 'medium', 'hard'].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Time</span>
            <select value={q.timeLimit || 0} onChange={(e) => setQ({ ...q, timeLimit: Number(e.target.value) })}>
              <option value={0}>Quiz default</option>
              {TIMES.map((t) => <option key={t} value={t}>{t} s</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="field-label">Explanation (shown after the answer, optional)</span>
          <textarea className="live-textarea" rows={2} maxLength={400} value={q.explanation} onChange={(e) => setQ({ ...q, explanation: e.target.value })} />
        </label>
        {error && <Note kind="error">{error}</Note>}
        <div className="row right">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{initial ? 'Save question' : 'Add question'}</button>
        </div>
      </form>
    </Modal>
  )
}

// Saved quizzes: load into the editor, start right away, or delete
export function SavedSets({ onLoad, onStart }) {
  const { call } = useApp()
  const [sets, setSets] = useState(null)
  useEffect(() => { run('live', { action: 'sets' }).then((s) => setSets(asArray(s))).catch(() => setSets([])) }, [])
  const remove = async (s) => {
    if (!window.confirm(`Delete the saved quiz “${s.title}”?`)) return
    const list = await call('live', { action: 'deleteSet', id: s.id }, { label: 'Deleting' })
    if (list) setSets(asArray(list))
  }
  if (!sets) return <p className="muted">Loading…</p>
  if (!sets.length) return <Card><p className="muted">No saved quizzes yet. Build one in “New quiz” and click <b>Save quiz</b> to reuse it in every class.</p></Card>
  return (
    <Card>
      <div className="table-scroll">
        <table className="data">
          <thead><tr><th>Quiz</th><th>Questions</th><th>Time / question</th><th>Saved</th><th /></tr></thead>
          <tbody>
            {sets.map((s) => (
              <tr key={s.id}>
                <td><b>{s.title}</b>{s.instructions && <div className="tiny faint live-clip">{s.instructions}</div>}</td>
                <td>{asArray(s.questions).length}</td>
                <td>{s.settings?.timeLimit} s</td>
                <td className="small">{s.updated}</td>
                <td>
                  <div className="row right" style={{ flexWrap: 'nowrap' }}>
                    <button className="btn btn-small" onClick={() => onLoad(s)}>Edit</button>
                    <button className="btn btn-small btn-primary" onClick={() => onStart(s)}><Icon name="play" size={14} /> Start</button>
                    <button className="icon-btn" onClick={() => remove(s)} aria-label={`Delete ${s.title}`}><Icon name="close" size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
