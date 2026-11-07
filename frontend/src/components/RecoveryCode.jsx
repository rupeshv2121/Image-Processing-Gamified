import { useState } from 'react'
import { SITE_NAME } from './Brand'
import Icon from './Icon'
import { Note } from './ui'

// The teacher PIN's one-time recovery code. The server keeps only its hash, so
// this is the only time it can be shown: copy it, download it or print it.
export default function RecoveryCode({ code, onDone, doneLabel = 'Continue' }) {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const text = `${SITE_NAME} teacher PIN recovery code\n\n${code}\n\nUse it under "Forgot PIN?" on the teacher sign-in page.\nIt works once; you then get a new code.\nCreated ${new Date().toLocaleString()}\n`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch { /* clipboard blocked (plain http on another device) - the code is selectable */ }
  }
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    a.download = 'spatia-teacher-recovery-code.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <div className="recovery">
      <Note kind="warn"><b>Save this recovery code now.</b> If you forget the PIN, it lets you set a new one. It is shown only this once.</Note>
      <div className="recovery-code" aria-label={`Recovery code ${code.split('').join(' ')}`}>{code}</div>
      <div className="row">
        <button type="button" className="btn" onClick={copy}><Icon name="check" size={16} /> {copied ? 'Copied' : 'Copy'}</button>
        <button type="button" className="btn" onClick={download}><Icon name="download" size={16} /> Download .txt</button>
        <button type="button" className="btn" onClick={() => window.print()}><Icon name="file" size={16} /> Print</button>
      </div>
      <label className="check mt-sm"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I have saved the recovery code somewhere safe</label>
      <button type="button" className="btn btn-primary btn-lg btn-block mt-sm" disabled={!saved} onClick={onDone}>{doneLabel}</button>
    </div>
  )
}
