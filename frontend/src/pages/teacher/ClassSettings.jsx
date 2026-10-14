import { useEffect, useState } from 'react'
import { useApp } from '../../AppContext'
import { getTeacherPin, run, setRole } from '../../api'
import Icon from '../../components/Icon'
import { StudentsModal } from '../../components/Profiles'
import { Card, Note, Page } from '../../components/ui'
import { useTeacher } from './TeacherData'

export default function ClassSettings() {
  const { call, matlab, refreshProfiles, profiles } = useApp()
  const { refresh, overview } = useTeacher()
  const [hasPin, setHasPin] = useState(null)
  const [manage, setManage] = useState(false)
  const [files, setFiles] = useState(null)
  const [pinForm, setPinForm] = useState({ next: '', confirm: '' })
  const [pinMsg, setPinMsg] = useState(null)

  useEffect(() => {
    if (matlab.ok) run('classroom', { action: 'get' }).then((s) => setHasPin(!!s.hasPin)).catch(() => {})
  }, [matlab.ok])

  const exportReport = async () => {
    const f = await call('classroom', { action: 'export' }, { label: 'Writing CSV and Excel files' })
    if (f) setFiles(f)
  }
  const changePin = async (e, remove = false) => {
    e?.preventDefault()
    setPinMsg(null)
    const next = remove ? '' : pinForm.next
    if (!remove && next !== pinForm.confirm) { setPinMsg({ kind: 'error', text: 'The two PINs do not match.' }); return }
    const s = await call('classroom', { action: 'setPin', pin: getTeacherPin(), newPin: next }, { label: 'Saving the PIN' })
    if (s) {
      setRole('teacher', next)                  // keep this tab signed in with the new PIN
      setHasPin(!!s.hasPin)
      setPinForm({ next: '', confirm: '' })
      setPinMsg({ kind: 'ok', text: remove ? 'PIN removed — anyone can open the teacher side.' : 'PIN saved. It is asked again when this browser tab is closed.' })
    }
  }

  return (
    <Page eyebrow="Teacher" title="Class settings" subtitle="Students on this computer, the teacher PIN and report exports.">
      {hasPin === false && <Note kind="warn">No teacher PIN is set, so students can open the teacher side. Set one below.</Note>}
      <div className="grid-2 mt-sm" style={{ alignItems: 'start' }}>
        <Card title="Students" extra={<span className="small faint">{profiles.length} on this computer</span>}>
          <p className="small">Add students before the first class, or let them add themselves on the start screen. Renaming and deleting a student needs the teacher PIN; deleting removes their progress and Code Lab work.</p>
          <button className="btn btn-primary mt-sm" onClick={() => setManage(true)}><Icon name="users" size={16} /> Manage students</button>
        </Card>

        <Card title="Export the class report">
          <p className="small">MATLAB writes the student table as <b>CSV</b>, and an <b>Excel</b> workbook with the sheets <i>Students</i>, <i>Topics</i> (weakest first) and <i>Code Lab</i>.</p>
          <div className="row mt-sm">
            <button className="btn btn-primary" onClick={exportReport} disabled={!overview}><Icon name="download" size={16} /> Create CSV & Excel files</button>
            {files && <a className="btn btn-navy" href={`/reports/${files.xlsx}`} download>Download Excel (.xlsx)</a>}
            {files && <a className="btn" href={`/reports/${files.csv}`} download>Download CSV</a>}
          </div>
          {files && <p className="small muted mt-sm">Saved in reports/output/{files.xlsx}</p>}
        </Card>

        <Card title={hasPin ? 'Change the teacher PIN' : 'Set a teacher PIN'}>
          <form className="pin-form" onSubmit={changePin}>
            <label className="field"><span className="field-label">New PIN (4–32 characters)</span>
              <input type="password" autoComplete="new-password" value={pinForm.next} onChange={(e) => setPinForm({ ...pinForm, next: e.target.value })} /></label>
            <label className="field"><span className="field-label">Repeat the PIN</span>
              <input type="password" autoComplete="new-password" value={pinForm.confirm} onChange={(e) => setPinForm({ ...pinForm, confirm: e.target.value })} /></label>
            <div className="row">
              <button className="btn btn-primary" type="submit" disabled={pinForm.next.length < 4}>Save PIN</button>
              {hasPin && <button className="btn btn-danger" type="button" onClick={(e) => changePin(e, true)}>Remove PIN</button>}
            </div>
          </form>
          {pinMsg && <Note kind={pinMsg.kind}>{pinMsg.text}</Note>}
          <p className="small muted mt-sm">MATLAB stores only a salted SHA-256 hash of the PIN in data/classroom.mat. It protects the teacher side, the exports, assignments and student management.</p>
        </Card>
      </div>
      {manage && <StudentsModal onClose={() => { setManage(false); refreshProfiles(); refresh({ force: true }) }} />}
    </Page>
  )
}
