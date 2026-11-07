import { useEffect, useState } from 'react'
import { useApp } from '../../AppContext'
import { run } from '../../api'
import Icon from '../../components/Icon'
import { StudentsModal, useSelfRegister } from '../../components/Profiles'
import RecoveryCode from '../../components/RecoveryCode'
import { Card, Modal, Note, Page } from '../../components/ui'
import { useTeacher } from './TeacherData'

export default function ClassSettings() {
  const { call, matlab, refreshProfiles, profiles } = useApp()
  const { refresh, overview } = useTeacher()
  const [pinInfo, setPinInfo] = useState(null)       // {hasPin, hasRecovery}
  const [code, setCode] = useState(null)             // a new recovery code, shown once
  const [recoveryPin, setRecoveryPin] = useState('')
  const [manage, setManage] = useState(false)
  const [files, setFiles] = useState(null)
  const [pinForm, setPinForm] = useState({ current: '', next: '', confirm: '' })
  const [selfRegister, setSelfRegister] = useSelfRegister()
  const [pinMsg, setPinMsg] = useState(null)

  useEffect(() => {
    if (matlab.server) run('classroom', { action: 'get' }).then(setPinInfo).catch(() => {})
  }, [matlab.server])

  const exportReport = async () => {
    const f = await call('classroom', { action: 'export' }, { label: 'Writing CSV and Excel files' })
    if (f) setFiles(f)
  }
  // The current PIN is asked again, so nobody can change it at an unattended computer.
  // The PIN can only be changed, never removed; every change issues a new recovery code.
  const changePin = async (e) => {
    e.preventDefault()
    setPinMsg(null)
    if (pinForm.next !== pinForm.confirm) { setPinMsg({ kind: 'error', text: 'The two PINs do not match.' }); return }
    const s = await call('classroom', { action: 'setPin', pin: pinForm.current, newPin: pinForm.next }, { label: 'Saving the PIN' })
    if (s) {
      setPinInfo(s)
      setPinForm({ current: '', next: '', confirm: '' })
      setPinMsg({ kind: 'ok', text: 'PIN changed. Use it the next time you sign in as the teacher.' })
      setCode(s.recoveryCode)
    }
  }
  const newRecovery = async (e) => {
    e.preventDefault()
    const s = await call('classroom', { action: 'newRecovery', pin: recoveryPin }, { label: 'Creating a recovery code' })
    if (s) {
      setPinInfo(s)
      setRecoveryPin('')
      setCode(s.recoveryCode)
    }
  }

  return (
    <Page eyebrow="Teacher" title="Class settings" subtitle="Students on this computer, the teacher PIN and report exports.">
      {pinInfo && !pinInfo.hasRecovery && (
        <Note kind="warn">There is no recovery code for the teacher PIN yet. Create one below, so a forgotten PIN can be reset without help.</Note>
      )}
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

        <Card title="Change the teacher PIN">
          <form className="pin-form" onSubmit={changePin}>
            <label className="field"><span className="field-label">Current PIN</span>
              <input type="password" autoComplete="current-password" value={pinForm.current} onChange={(e) => setPinForm({ ...pinForm, current: e.target.value })} /></label>
            <label className="field"><span className="field-label">New PIN (6–32 characters)</span>
              <input type="password" autoComplete="new-password" value={pinForm.next} onChange={(e) => setPinForm({ ...pinForm, next: e.target.value })} /></label>
            <label className="field"><span className="field-label">Repeat the PIN</span>
              <input type="password" autoComplete="new-password" value={pinForm.confirm} onChange={(e) => setPinForm({ ...pinForm, confirm: e.target.value })} /></label>
            <div className="row">
              <button className="btn btn-primary" type="submit" disabled={!pinForm.current || pinForm.next.length < 6}>Change PIN</button>
            </div>
          </form>
          {pinMsg && <Note kind={pinMsg.kind}>{pinMsg.text}</Note>}
          <p className="small muted mt-sm">The teacher side always needs a PIN — it can be changed but not removed.</p>
        </Card>

        <Card title="Recovery code">
          <p className="small">If you forget the PIN, the recovery code sets a new one under <b>Forgot PIN?</b> on the sign-in page. A new code makes the old one stop working.</p>
          <form className="row mt-sm" onSubmit={newRecovery}>
            <input type="password" autoComplete="current-password" placeholder="Current PIN" aria-label="Current PIN" value={recoveryPin} onChange={(e) => setRecoveryPin(e.target.value)} style={{ maxWidth: 200 }} />
            <button className="btn" type="submit" disabled={!recoveryPin}>{pinInfo?.hasRecovery ? 'Create a new recovery code' : 'Create a recovery code'}</button>
          </form>
          <p className="small muted mt-sm">Lost both? On this computer run <code>reset_teacher_pin.bat</code> in the ImageLab folder; the next teacher sign-in creates a new PIN. Students and scores are kept.</p>
          <p className="small muted mt-sm">Spatia stores only a salted hash of the PIN and of every student password (PBKDF2, data/imagelab.db). Five wrong attempts lock sign-in for five minutes.</p>
        </Card>
      </div>
      {code && (
        <Modal title="Your new recovery code" onClose={() => {}}>
          <RecoveryCode code={code} onDone={() => setCode(null)} doneLabel="Done" />
        </Modal>
      )}
      {manage && <StudentsModal onClose={() => { setManage(false); refreshProfiles(); refresh({ force: true }) }} />}
    </Page>
  )
}
