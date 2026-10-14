import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../AppContext'
import { asArray, fmt, run } from '../../api'
import { initials } from '../../components/Profiles'
import { Card, Note, Page } from '../../components/ui'
import SubmissionModal from './SubmissionModal'
import { studentHref, timeAgo } from './TeacherData'

// Code Lab matrix: one row per student, one column per task.
export default function Submissions() {
  const { matlab } = useApp()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')       // all | stuck | none
  const [open, setOpen] = useState(null)            // { studentId, taskId }

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await run('classroom', { action: 'submissions' })); setError(null) } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { if (matlab.ok) load() }, [matlab.ok, load])

  const tasks = asArray(data?.tasks)
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return asArray(data?.students).filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !(s.roll || '').toLowerCase().includes(q)) return false
      const cells = asArray(s.cells)
      if (filter === 'stuck') return cells.some((c) => !c.passed && c.attempts >= 3)
      if (filter === 'none') return cells.every((c) => c.attempts === 0)
      return true
    })
  }, [data, query, filter])
  const solvedBy = tasks.map((_, j) => asArray(data?.students).filter((s) => asArray(s.cells)[j]?.passed).length)

  return (
    <Page eyebrow="Teacher" title="Code submissions" subtitle="Every student's Code Lab work. Click a cell to read the code they wrote."
      actions={<button className="btn" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>}>
      {error && <Note kind="error">{error}</Note>}
      {!data ? <p className="muted">Loading…</p> : (
        <Card title={`${rows.length} student${rows.length === 1 ? '' : 's'}`} extra={
          <span className="row" style={{ gap: 8 }}>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter students" style={{ width: "auto" }}>
              <option value="all">Everyone</option>
              <option value="stuck">Stuck (3+ runs, not solved)</option>
              <option value="none">Not started</option>
            </select>
            <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search students" style={{ width: 180 }} />
          </span>}>
          <div className="table-scroll">
            <table className="data sub-matrix">
              <thead>
                <tr>
                  <th className="sticky-col">Student</th>
                  {tasks.map((t) => (
                    <th key={t.id} title={`${t.title} (${t.level}${t.status !== 'open' ? `, ${t.status}` : ''})`}>
                      <span className="sub-task">{t.title}</span>
                      {t.status === 'assigned' && <span className="badge badge-warn">assigned</span>}
                      {t.status === 'locked' && <span className="badge badge-navy">locked</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <th className="sticky-col"><a href={studentHref(s.id)} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><span className="avatar sm">{initials(s.name)}</span> {s.name}</a></th>
                    {asArray(s.cells).map((c, j) => (
                      <td key={tasks[j].id}>
                        {c.attempts === 0 ? <span className="faint">·</span> : (
                          <button className={`sub-cell ${c.passed ? 'ok' : c.attempts >= 3 ? 'stuck' : 'try'}`} onClick={() => setOpen({ studentId: s.id, taskId: tasks[j].id })}
                            title={`${c.passed ? 'Solved' : 'Not solved'} · ${c.attempts} run(s) · best ${fmt(c.bestMatch, 1)}% · ${timeAgo(c.lastRun)}`}>
                            {c.passed ? '✓' : `${Math.round(c.bestMatch)}%`}<small>{c.attempts}×</small>
                          </button>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><th className="sticky-col">Solved by</th>{solvedBy.map((n, j) => <td key={tasks[j].id}><b>{n}</b></td>)}</tr>
              </tfoot>
            </table>
          </div>
          <p className="tiny faint mt-sm">✓ solved · % = best pixel match so far · n× = number of runs · red = 3+ runs without solving.</p>
        </Card>
      )}
      {open && <SubmissionModal {...open} onClose={() => setOpen(null)} />}
    </Page>
  )
}
