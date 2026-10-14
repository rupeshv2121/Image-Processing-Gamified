import { lazy, Suspense, useEffect, useState } from 'react'
import { fmt, run } from '../../api'
import { Modal, Note, Tabs } from '../../components/ui'
import { timeAgo } from './TeacherData'

// CodeMirror is only downloaded when the teacher opens a submission
const MatlabEditor = lazy(() => import('../../components/MatlabEditor'))

// One student's code for one Code Lab task (read only)
export default function SubmissionModal({ studentId, taskId, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('passed')
  useEffect(() => {
    run('classroom', { action: 'submission', id: studentId, taskId })
      .then((d) => { setData(d); setTab(d.entry.passedCode ? 'passed' : 'last') })
      .catch((e) => setError(e.message))
  }, [studentId, taskId])

  const e = data?.entry
  const code = e ? (tab === 'passed' ? e.passedCode : e.lastCode) : ''
  return (
    <Modal title={data ? `${data.student.name} · ${data.task.title}` : 'Submission'} onClose={onClose} wide>
      {error && <Note kind="error">{error}</Note>}
      {!data && !error && <p className="muted">Loading…</p>}
      {e && (e.attempts === 0 ? <p className="muted">No runs yet for this task.</p> : (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            {e.passed ? <span className="badge">✓ Solved {e.firstSolved && `· ${e.firstSolved}`}</span> : <span className="badge badge-warn">Not solved yet</span>}
            <span className="badge badge-navy">{e.attempts} run{e.attempts === 1 ? '' : 's'}{e.passed && e.attemptsToSolve ? ` · solved on run ${e.attemptsToSolve}` : ''}</span>
            <span className="badge badge-navy">best match {fmt(e.bestMatch, 1)}%</span>
            <span className="small muted">last run {timeAgo(e.lastRun)}</span>
          </div>
          <Tabs tabs={[...(e.passedCode ? [{ key: 'passed', label: 'Passing code' }] : []), { key: 'last', label: 'Latest run' }]} active={tab} onChange={setTab} />
          {tab === 'last' && e.lastError && <Note kind="error">The latest run stopped with an error: {e.lastError}</Note>}
          {tab === 'last' && !e.lastError && <p className="small muted" style={{ margin: '0 0 8px' }}>Latest run matched {fmt(e.lastMatch, 1)}% of the expected pixels.</p>}
          <Suspense fallback={<pre className="code">{code}</pre>}>
            <MatlabEditor key={tab} value={code} readOnly height={420} label={`${data.student.name}'s code`} />
          </Suspense>
        </>
      ))}
    </Modal>
  )
}
