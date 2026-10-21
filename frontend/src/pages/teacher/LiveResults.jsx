import { useEffect, useState } from 'react'
import { useApp } from '../../AppContext'
import { asArray, run } from '../../api'
import Icon from '../../components/Icon'
import { LETTERS, LeaderboardTable, Podium, fmtTime } from '../../components/LiveParts'
import { Card, Modal } from '../../components/ui'

// Finished live quizzes (saved by the backend): list, details, Excel export

export function ExportButtons({ id = '' }) {
  const { call } = useApp()
  const [files, setFiles] = useState(null)
  const make = async () => {
    const f = await call('live', { action: 'export', id }, { label: 'Writing CSV and Excel files' })
    if (f) setFiles(f)
  }
  return (
    <div className="row">
      {!files && <button className="btn" onClick={make}><Icon name="download" size={16} /> Export results</button>}
      {files && <a className="btn btn-navy" href={`/reports/${files.xlsx}`} download>Download Excel (.xlsx)</a>}
      {files && <a className="btn" href={`/reports/${files.csv}`} download>Download CSV</a>}
    </div>
  )
}

export function QuestionStats({ rows }) {
  const list = asArray(rows)
  if (!list.length) return null
  return (
    <div className="table-scroll">
      <table className="data compact">
        <thead><tr><th>#</th><th>Question</th><th>Correct answer</th><th className="num">Answered</th><th className="num">Correct</th><th className="num">Avg time</th></tr></thead>
        <tbody>
          {list.map((q) => (
            <tr key={q.index}>
              <td>{q.index}</td>
              <td>{q.question}<div className="tiny faint">{q.category} · {q.timeLimit} s</div></td>
              <td className="small">{LETTERS[q.answer - 1]}: {asArray(q.options)[q.answer - 1]}</td>
              <td className="num">{q.answered}</td>
              <td className="num">
                <div className="row" style={{ gap: 8, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                  <div className={`progressbar ${q.correctPct < 40 ? 'danger' : q.correctPct < 70 ? 'warn' : ''}`} style={{ width: 60 }}><div style={{ width: `${q.correctPct || 0}%` }} /></div>
                  <span>{q.correctPct ?? '—'}%</span>
                </div>
              </td>
              <td className="num">{fmtTime(q.avgTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function LiveResults() {
  const { call } = useApp()
  const [list, setList] = useState(null)
  const [open, setOpen] = useState(null)
  useEffect(() => { run('live', { action: 'history' }).then((h) => setList(asArray(h))).catch(() => setList([])) }, [])
  const show = async (r) => {
    const d = await call('live', { action: 'result', id: r.id }, { label: 'Loading the results' })
    if (d) setOpen(d)
  }
  const remove = async (r) => {
    if (!window.confirm(`Delete the results of “${r.title}” (${r.date})?`)) return
    const h = await call('live', { action: 'deleteResult', id: r.id }, { label: 'Deleting' })
    if (h) setList(asArray(h))
  }
  if (!list) return <p className="muted">Loading…</p>
  if (!list.length) return <Card><p className="muted">No live quiz has been played yet. Results are saved here automatically when a quiz ends.</p></Card>
  return (
    <Card>
      <div className="table-scroll">
        <table className="data clickable">
          <thead><tr><th>Date</th><th>Quiz</th><th className="num">Students</th><th className="num">Questions</th><th className="num">Class accuracy</th><th className="num">Avg time</th><th>Winner</th><th /></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} onClick={() => show(r)}>
                <td className="small">{r.date}</td>
                <td><b>{r.title}</b></td>
                <td className="num">{r.playerCount}</td>
                <td className="num">{r.questionCount}{r.questionCount < r.plannedQuestions ? <span className="tiny faint"> / {r.plannedQuestions}</span> : null}</td>
                <td className="num">{r.accuracy ?? '—'}%</td>
                <td className="num">{fmtTime(r.avgTime)}</td>
                <td>{r.winner || '—'}</td>
                <td onClick={(e) => e.stopPropagation()}><button className="icon-btn" onClick={() => remove(r)} aria-label={`Delete ${r.title}`}><Icon name="close" size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title={`${open.title} · ${open.date}`} onClose={() => setOpen(null)} wide>
          <div className="stack">
            <Podium rows={open.leaderboard} />
            <LeaderboardTable rows={open.leaderboard} showLast={false} showMove={false} compact />
            <h4>Questions</h4>
            <QuestionStats rows={open.questions} />
            <ExportButtons id={open.id} />
          </div>
        </Modal>
      )}
    </Card>
  )
}
