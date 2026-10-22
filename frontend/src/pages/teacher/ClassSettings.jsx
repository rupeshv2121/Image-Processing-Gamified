import { useEffect, useState } from 'react'
import { useApp } from '../../AppContext'
import { run } from '../../api'
import Icon from '../../components/Icon'
import { StudentsModal, useSelfRegister } from '../../components/Profiles'
import { Card, Note, Page } from '../../components/ui'
import { useTeacher } from './TeacherData'

export default function ClassSettings() {
  const { call, matlab, refreshProfiles, profiles } = useApp()
  const { refresh, overview } = useTeacher()
  const [hasPin, setHasPin] = useState(null)
  const [manage, setManage] = useState(false)
  const [files, setFiles] = useState(null)
  const [pinForm, setPinForm] = useState({ current: '', next: '', confirm: '' })
  const [selfRegister, setSelfRegister] = useSelfRegister()
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
    // The current PIN is asked again, so nobody can change it at an unattended computer
    const s = await call('classroom', { action: 'setPin', pin: pinForm.current, newPin: next }, { label: 'Saving the PIN' })
    if (s) {
      setHasPin(!!s.hasPin)
      setPinForm({ current: '', next: '', confirm: '' })
      setPinMsg({ kind: 'ok', text: remove ? 'PIN removed — anyone can sign in as the teacher.' : 'PIN saved. Use it the next time you sign in as the teacher.' })
    }
  }

  return (
    <Page eyebrow="Teacher" title="Class settings" subtitle="Students on this computer, the teacher PIN and report exports.">
      {hasPin === false && <Note kind="warn">No teacher PIN is set, so students can open the teacher side. Set one below.</Note>}
      <div className="grid-2 mt-sm" style={{ alignItems: 'start' }}>
        <Card title="Students" extra={<span className="small faint">{profiles.length} on this computer</span>}>
          <p className="small">Add students (each gets a first password), reset forgotten passwords, rename or delete students. Deleting removes the account, progress and Code Lab work.</p>
          <button className="btn btn-primary mt-sm" onClick={() => setManage(true)}><Icon name="users" size={16} /> Manage students & passwords</button>
          <label className="check mt">
            <input type="checkbox" checked={!!selfRegister} disabled={selfRegister === null} onChange={(e) => setSelfRegister(e.target.checked)} />
            Students may create their own account on the sign-in page
          </label>
          <p className="tiny faint">Off: only you create accounts. Students added before passwords existed choose one at their first sign-in.</p>
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
            {hasPin && (
              <label className="field"><span className="field-label">Current PIN</span>
                <input type="password" autoComplete="current-password" value={pinForm.current} onChange={(e) => setPinForm({ ...pinForm, current: e.target.value })} /></label>
            )}
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
          <p className="small muted mt-sm">Spatia stores only a salted hash of the PIN and of every student password (PBKDF2, data/imagelab.db). Five wrong attempts lock sign-in for five minutes.</p>
        </Card>
      </div>
      {manage && <StudentsModal onClose={() => { setManage(false); refreshProfiles(); refresh({ force: true }) }} />}
    </Page>
  )
}
