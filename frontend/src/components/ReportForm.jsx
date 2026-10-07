import { useState } from 'react'
import { useApp } from '../AppContext'
import { asArray } from '../api'
import { Note } from './ui'

// Builds the report payload and asks MATLAB (generateReport.m) to write it.
export default function ReportForm({ experiment, run, quizScore }) {
  const { call } = useApp()
  const [students, setStudents] = useState(() => localStorage.getItem('imagelab.students') || '')
  const [rolls, setRolls] = useState(() => localStorage.getItem('imagelab.rolls') || '')
  const [link, setLink] = useState(null)

  const generate = async () => {
    try {
      localStorage.setItem('imagelab.students', students)
      localStorage.setItem('imagelab.rolls', rolls)
    } catch { /* storage unavailable */ }
    const payload = {
      title: `Experiment ${experiment.number}: ${experiment.title}`,
      students, rollNumbers: rolls, experimentNumber: experiment.number,
      aim: experiment.aim, theory: experiment.theory, algorithm: asArray(experiment.algorithm),
      code: `${experiment.code}\n\n% ---- Manual implementation ----\n${experiment.manualCode}`,
      parameters: run?.parameters || '',
      images: asArray(run?.images).map((i) => ({ label: i.label, id: i.id })),
      metrics: asArray(run?.metrics).map((m) => ({ name: m.name, value: m.value })),
      observations: [...asArray(run?.observations), experiment.observation],
      result: experiment.observation,
      conclusion: experiment.conclusion,
      quizScore: quizScore ?? '',
    }
    if (run?.kernel) {
      const k = run.kernel
      const data = asArray(k.data)
      payload.kernel = Array.from({ length: k.rows }, (_, r) => data.slice(r * k.cols, (r + 1) * k.cols))
    }
    const d = await call('report', payload, { label: 'generateReport.m' })
    if (d) setLink(d)
  }

  return (
    <div className="controls">
      <div className="grid-2">
        <label className="field"><span className="field-label">Student name(s)</span>
          <input type="text" value={students} onChange={(e) => setStudents(e.target.value)} placeholder="e.g. A. Sharma, B. Gupta" /></label>
        <label className="field"><span className="field-label">Roll number(s)</span>
          <input type="text" value={rolls} onChange={(e) => setRolls(e.target.value)} /></label>
      </div>
      {!run && <Note kind="warn">Run the experiment first so the report contains input/output images and metrics.</Note>}
      <div className="row">
        <button className="btn btn-primary" onClick={generate}>⎙ Generate report</button>
        {link && <a className="btn btn-navy" href={`/reports/${link.name}`} target="_blank" rel="noreferrer">Open report (print → Save as PDF)</a>}
        {link?.docx && <a className="btn" href={`/reports/${link.docx}`}>Download .docx</a>}
      </div>
      {link && <p className="small muted">Saved by MATLAB to reports/output/{link.name}</p>}
    </div>
  )
}
