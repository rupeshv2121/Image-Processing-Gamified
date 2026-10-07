import { useEffect, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt, toMatrix } from '../api'
import { Card, CodeModal, ImageView, KernelGrid, Note, Page, Tabs } from '../components/ui'
import QuizRunner from '../components/QuizRunner'
import ReportForm from '../components/ReportForm'

const TABS = [
  { key: 'theory', label: 'Aim & Theory' }, { key: 'algorithm', label: 'Algorithm' }, { key: 'code', label: 'MATLAB Code' },
  { key: 'run', label: 'Input / Output' }, { key: 'result', label: 'Observation & Conclusion' }, { key: 'quiz', label: 'Quiz' }, { key: 'report', label: 'Report' },
]

function ExperimentDetail({ exp, onBack }) {
  const { call, current, progress, refreshProgress } = useApp()
  const [tab, setTab] = useState('theory')
  const [codeTab, setCodeTab] = useState('toolbox')
  const [showSource, setShowSource] = useState(false)
  const [run, setRun] = useState(null)
  const [useWorkspace, setUseWorkspace] = useState(false)
  const [quiz, setQuiz] = useState(null)
  const [quizScore, setQuizScore] = useState(null)
  const done = asArray(progress?.experimentsCompleted).includes(exp.number)

  const execute = async () => {
    const d = await call('runExperiment', { number: exp.number, id: useWorkspace ? current : '' }, { label: `Running experiment ${exp.number}` })
    if (d) {
      setRun(d)
      refreshProgress()
    }
  }
  const startQuiz = async () => {
    const qs = await call('quizQuestions', { categories: [exp.quizCategory], n: 5 }, { label: 'Loading quiz' })
    if (qs) setQuiz(asArray(qs))
  }
  const howItWorks = asArray(exp.howItWorks)

  return (
    <Page eyebrow="Experiment" title={`Experiment ${exp.number}: ${exp.title}`} subtitle={exp.aim}
      actions={<>{done && <span className="badge">Completed</span>}<button className="btn" onClick={onBack}>← All experiments</button></>}>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'theory' && (
        <Card>
          <h3>Aim</h3><p>{exp.aim}</p>
          <h3 style={{ marginTop: 14 }}>Theory</h3><p className="prose">{exp.theory}</p>
        </Card>
      )}
      {tab === 'algorithm' && (
        <Card title="Algorithm">
          <ol className="prose">{asArray(exp.algorithm).map((s, i) => <li key={i}>{s}</li>)}</ol>
        </Card>
      )}
      {tab === 'code' && (
        <Card title="MATLAB Code" extra={<button className="btn btn-code" onClick={() => setShowSource(true)}>{'</>'} View MATLAB Code (.m files)</button>}>
          <Tabs tabs={[{ key: 'toolbox', label: 'MATLAB Toolbox' }, { key: 'manual', label: 'Manual Implementation' }]} active={codeTab} onChange={setCodeTab} />
          <pre className="code">{codeTab === 'toolbox' ? exp.code : exp.manualCode}</pre>
          <div className="how">
            <h4>How it works</h4>
            <ol>{howItWorks.map((l, i) => <li key={i}>{l}</li>)}</ol>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>ImageLab functions used: {asArray(exp.functions).map((f) => `${f}.m`).join(', ')}</p>
          {showSource && <CodeModal functions={asArray(exp.functions)} onClose={() => setShowSource(false)} />}
        </Card>
      )}
      {tab === 'run' && (
        <div className="stack">
          <Card>
            <div className="row">
              <button className="btn btn-primary" onClick={execute}>▶ Run experiment in MATLAB</button>
              <label className="check"><input type="checkbox" checked={useWorkspace} disabled={!current} onChange={(e) => setUseWorkspace(e.target.checked)} /> Use the workspace image instead of {exp.defaultImage}</label>
            </div>
            {run?.parameters && <p className="small muted" style={{ marginTop: 8 }}>Parameters: {run.parameters}</p>}
          </Card>
          {run && (
            <>
              <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {asArray(run.images).map((im) => <ImageView key={im.id} id={im.id} title={im.label} height={210} />)}
              </div>
              <div className="grid-2">
                <Card title="Measurements">
                  <table className="data"><tbody>
                    {asArray(run.metrics).map((m) => <tr key={m.name}><td>{m.name}</td><td><b>{fmt(m.value, 4)}</b></td></tr>)}
                  </tbody></table>
                </Card>
                <Card title="Observations (generated from the results)">
                  <ul className="prose">{asArray(run.observations).map((o, i) => <li key={i}>{o}</li>)}</ul>
                  {run.kernel && <KernelGrid matrix={toMatrix(run.kernel)} title="Kernel" small />}
                </Card>
              </div>
            </>
          )}
        </div>
      )}
      {tab === 'result' && (
        <Card>
          <h3>Observation</h3><p>{exp.observation}</p>
          {run && <ul className="prose">{asArray(run.observations).map((o, i) => <li key={i}>{o}</li>)}</ul>}
          <h3 style={{ marginTop: 14 }}>Result</h3><p>{exp.title} was performed successfully in MATLAB{run ? ' and the outputs are shown in the Input / Output tab' : ''}.</p>
          <h3 style={{ marginTop: 14 }}>Conclusion</h3><p>{exp.conclusion}</p>
        </Card>
      )}
      {tab === 'quiz' && (
        <Card>
          {quiz ? (
            <QuizRunner questions={quiz} timePerQuestion={null} onFinish={(r) => { setQuizScore(`${r.filter((x) => x.correct).length} / ${r.length}`); setQuiz(null) }} />
          ) : (
            <>
              {quizScore && <Note kind="ok">Quiz score: <b>{quizScore}</b> (included in the report)</Note>}
              <p>Five questions on <b>{exp.quizCategory}</b>, without a timer.</p>
              <button className="btn btn-primary" onClick={startQuiz}>Start quiz</button>
            </>
          )}
        </Card>
      )}
      {tab === 'report' && (
        <Card title="Experiment report">
          <ReportForm experiment={exp} run={run} quizScore={quizScore} />
        </Card>
      )}
    </Page>
  )
}

export default function Experiments() {
  const { call, progress, matlab } = useApp()
  const [list, setList] = useState([])
  const [selected, setSelected] = useState(null)
  useEffect(() => {
    if (matlab.ok) call('experiments', {}, { label: 'Loading experiments' }).then((d) => d && setList(asArray(d)))
  }, [call, matlab.ok])
  const done = asArray(progress?.experimentsCompleted)

  if (selected) return <ExperimentDetail exp={selected} onBack={() => setSelected(null)} />
  return (
    <Page eyebrow="Study" title="Experiments" subtitle={`University-style laboratory experiments · ${done.length} of 13 completed`}>
      <div className="tiles">
        {list.map((e) => (
          <button key={e.number} className="tile" style={{ textAlign: 'left', font: 'inherit', cursor: 'pointer' }} onClick={() => setSelected(e)}>
            <span className="badge badge-navy">Experiment {e.number}</span> {done.includes(e.number) && <span className="badge">✓ done</span>}
            <b style={{ marginTop: 6 }}>{e.title}</b>
            <span>{e.aim}</span>
          </button>
        ))}
      </div>
      {!list.length && <p className="muted">Waiting for MATLAB…</p>}
    </Page>
  )
}
