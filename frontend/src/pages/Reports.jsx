import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt } from '../api'
import { Card, ImageGrid, Note, Page, Select } from '../components/ui'
import ReportForm from '../components/ReportForm'

// Step 1 runs the experiment in MATLAB: its input/output images and measurements
// are what the report shows. Step 2 writes the report; without a run it runs the
// experiment first, so a report never comes out without results.
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
    return d
  }
  const images = asArray(run?.images)
  const metrics = asArray(run?.metrics)

  return (
    <Page eyebrow="Deliverables" title="Reports" subtitle="Run an experiment, add your names and let MATLAB write the lab report.">
      <div className="grid-2">
        <Card title="1. Run the experiment">
          <div className="controls">
            <Select label="Experiment" value={num} onChange={(v) => { setNum(v); setRun(null) }} options={list.map((e) => ({ value: String(e.number), label: `${e.number}. ${e.title}` }))} />
            <label className="check"><input type="checkbox" checked={useWorkspace} disabled={!current} onChange={(e) => { setUseWorkspace(e.target.checked); setRun(null) }} /> Use the workspace image</label>
            <p className="small muted">MATLAB runs the experiment's code and collects the input and output images and the measurements — that is what the report's Results section is made of.</p>
            <button className="btn btn-primary" onClick={execute} disabled={!exp}>▶ {run ? 'Run again' : 'Run in MATLAB'}</button>
          </div>
        </Card>
        <Card title="2. Generate the report">
          {exp ? <ReportForm key={num} experiment={exp} run={run} ensureRun={async () => run || execute()} /> : <p className="muted">Waiting for MATLAB…</p>}
        </Card>
      </div>
      {run && (
        <Card title="Results that go into the report" className="mt">
          <Note kind="ok">{images.length} image{images.length === 1 ? '' : 's'} and {metrics.length} measurement{metrics.length === 1 ? '' : 's'} from MATLAB{run.parameters ? ` · ${run.parameters}` : ''}.</Note>
          {images.length > 0 && <div className="mt-sm"><ImageGrid columns={4} height={170} items={images.map((i) => ({ id: i.id, title: i.label }))} /></div>}
          {metrics.length > 0 && (
            <table className="data mt-sm">
              <tbody>{metrics.map((m) => <tr key={m.name}><th>{m.name}</th><td>{typeof m.value === 'number' ? fmt(m.value) : String(m.value)}</td></tr>)}</tbody>
            </table>
          )}
        </Card>
      )}
      <Card title="Report formats" className="mt">
        <ul className="prose small">
          <li><b>PDF (always)</b> — an A4 report laid out by MATLAB itself (generateReportPdf.m: figures + exportgraphics), ready to print or submit.</li>
          <li><b>HTML (always)</b> — self-contained with embedded images; opens in any browser or in Microsoft Word.</li>
          <li><b>DOCX</b> — produced automatically as well when MATLAB Report Generator is installed.</li>
          <li><b>MATLAB Live Script</b> — <code>ImageLab_Demonstration.mlx</code> in the project folder contains theory, code, figures and conclusions for the whole project.</li>
        </ul>
      </Card>
    </Page>
  )
}
