import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray } from '../api'
import { Card, Note, Page, Select } from '../components/ui'
import ReportForm from '../components/ReportForm'

export default function Reports() {
  const { call, current, matlab } = useApp()
  const [list, setList] = useState([])
  const [num, setNum] = useState('1')
  const [run, setRun] = useState(null)
  const [useWorkspace, setUseWorkspace] = useState(false)
  useEffect(() => {
    if (matlab.ok) call('experiments', {}, { quiet: true }).then((d) => d && setList(asArray(d)))
  }, [call, matlab.ok])
  const exp = list.find((e) => String(e.number) === num)

  const execute = async () => {
    const d = await call('runExperiment', { number: Number(num), id: useWorkspace ? current : '' }, { label: `Running experiment ${num}` })
    if (d) setRun(d)
  }

  return (
    <Page eyebrow="Deliverables" title="Reports" subtitle="Run an experiment, add your names and let MATLAB write the lab report.">
      <div className="grid-2">
        <Card title="1. Choose and run the experiment">
          <div className="controls">
            <Select label="Experiment" value={num} onChange={(v) => { setNum(v); setRun(null) }} options={list.map((e) => ({ value: String(e.number), label: `${e.number}. ${e.title}` }))} />
            <label className="check"><input type="checkbox" checked={useWorkspace} disabled={!current} onChange={(e) => setUseWorkspace(e.target.checked)} /> Use the workspace image</label>
            <button className="btn btn-primary" onClick={execute} disabled={!exp}>▶ Run in MATLAB</button>
            {run && <Note kind="ok">Done: {asArray(run.images).length} images and {asArray(run.metrics).length} measurements collected.</Note>}
          </div>
        </Card>
        <Card title="2. Generate the report">
          {exp ? <ReportForm key={num} experiment={exp} run={run} /> : <p className="muted">Waiting for MATLAB…</p>}
        </Card>
      </div>
      <Card title="Report formats" className="mt">
        <ul className="prose small">
          <li><b>HTML (always)</b> — self-contained with embedded images. Open it and use the browser's <i>Print → Save as PDF</i> for a PDF, or open it in Microsoft Word.</li>
          <li><b>DOCX</b> — produced automatically as well when MATLAB Report Generator is installed.</li>
          <li><b>MATLAB Live Script</b> — <code>ImageLab_Demonstration.mlx</code> in the project folder contains theory, code, figures and conclusions for the whole project.</li>
        </ul>
      </Card>
    </Page>
  )
}
