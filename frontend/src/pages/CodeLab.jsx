import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, cancelRun, fmt, getProfileId, run } from '../api'
import Icon from '../components/Icon'
import MatlabEditor from '../components/MatlabEditor'
import { Card, ImageGrid, ImageView, Note, Page, UseButton } from '../components/ui'

// MATLAB Code Lab: students write real MATLAB code in the browser; MATLAB runs
// it (codelab/runStudentCode.m) and grades task solutions (codelab/codeTasks.m).

const FREE = 'free'
const FREE_STARTER = `% Free practice - write any MATLAB code and press Run (Ctrl+Enter).
%   img : the current Workspace image (double, values in [0,1])
%   out : store a result image here to send it to the Workspace
%   Figures (imshow, plot, bar, subplot ...) appear below the editor.

if size(img, 3) == 3
    G = rgb2gray(img);
else
    G = img;
end

K = ones(5) / 25;                  % 5x5 averaging kernel
out = imfilter(G, K, 'replicate');

fprintf('Image size: %d x %d\\n', size(G, 1), size(G, 2));
subplot(1, 2, 1); imshow(G);   title('input')
subplot(1, 2, 2); imshow(out); title('smoothed')
`
const LEVEL_BADGE = { Easy: 'badge', Medium: 'badge badge-navy', Hard: 'badge badge-violet' }

const draftKey = (taskId) => `imagelab.code.${getProfileId()}.${taskId}`
const loadDraft = (taskId) => { try { return localStorage.getItem(draftKey(taskId)) } catch { return null } }
const saveDraft = (taskId, code) => { try { localStorage.setItem(draftKey(taskId), code) } catch { /* storage unavailable */ } }
const clearDraft = (taskId) => { try { localStorage.removeItem(draftKey(taskId)) } catch { /* storage unavailable */ } }

const taskFromHash = () => (window.location.hash.match(/[?&]task=([\w-]+)/) || [])[1] || FREE
// MATLAB sends [] for "nothing"
const present = (v) => v && !(Array.isArray(v) && v.length === 0)

export default function CodeLab() {
  const { matlab, current, notify, refreshProgress } = useApp()
  const [tasks, setTasks] = useState([])
  const [solved, setSolved] = useState([])
  const [ipt, setIpt] = useState(true)
  const [teacher, setTeacher] = useState(false)     // teacher preview: nothing is recorded
  const [taskId, setTaskId] = useState(taskFromHash)
  const [code, setCode] = useState('')
  const [inputId, setInputId] = useState(null)
  const [hintsShown, setHintsShown] = useState(0)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [runError, setRunError] = useState(null)
  const [solution, setSolution] = useState(null)
  const saveTimer = useRef(null)
  const results = useRef(null)
  const warmed = useRef(false)
  // MATLAB renders its first figure slowly - do it while the student reads the task
  const warmUp = () => {
    if (warmed.current) return
    warmed.current = true
    run('codeWarmup').catch(() => {})
  }

  const task = useMemo(() => tasks.find((t) => t.id === taskId) || null, [tasks, taskId])
  const isFree = taskId === FREE
  const locked = !teacher && task?.status === 'locked'
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  useEffect(() => {
    if (!matlab.ok) return
    run('codeTasks').then((d) => {
      setTasks(asArray(d.tasks))
      setSolved(asArray(d.solved))
      setIpt(!!d.ipt)
      setTeacher(!!d.teacher)
      if (taskFromHash() === FREE) warmUp()
    }).catch((e) => setRunError({ message: e.message }))
  }, [matlab.ok])

  // Open a task: restore the student's draft (or the starter code) and its input image
  useEffect(() => {
    setResult(null); setRunError(null); setSolution(null); setHintsShown(0); setInputId(null)
    if (isFree) {
      setCode(loadDraft(FREE) ?? FREE_STARTER)
      if (matlab.ok) warmUp()
    } else if (task) {
      setCode(loadDraft(task.id) ?? task.starter)
      run('codeTaskStart', { taskId: task.id }).then((d) => setInputId(d.inputId)).catch(() => {}).finally(warmUp)
    }
    const hash = `#code${isFree ? '' : `?task=${taskId}`}`
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, task, isFree])

  const edit = (text) => {
    setCode(text)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveDraft(taskId, text), 400)
  }

  const runCode = useCallback(async () => {
    if (running || !matlab.ok) return
    setRunning(true); setRunError(null)
    saveDraft(taskId, code)
    try {
      const d = await run('runCode', isFree ? { code, id: current || '' } : { code, taskId })
      setResult(d)
      const g = present(d.grade) ? d.grade : null
      if (g?.passed && !solved.includes(taskId)) {
        setSolved((s) => [...s, taskId])
        notify('Task solved! +40 XP')
        refreshProgress()
      }
      asArray(d.newBadges).forEach((b) => notify(`New badge: ${b}`))
      requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (e) {
      setResult(null)
      setRunError({ message: e.cancelled ? 'Stopped. (Check your loops - an endless loop never finishes.)' : e.message })
    } finally {
      setRunning(false)
    }
  }, [running, matlab.ok, taskId, code, isFree, current, solved, notify, refreshProgress])

  const reset = () => {
    if (!window.confirm('Replace your code with the starter code? Your current code will be lost.')) return
    clearDraft(taskId)
    setCode(isFree ? FREE_STARTER : task.starter)
    setResult(null); setRunError(null)
  }

  const showSolution = async () => {
    try { setSolution((await run('codeTaskSolution', { taskId })).code) } catch (e) { notify(e.message, 'warn') }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `${isFree ? 'imagelab_practice' : `task_${taskId}`}.m` })
    a.click()
    URL.revokeObjectURL(url)
  }

  const err = result && present(result.error) ? result.error : null
  const errorLine = err && typeof err.line === 'number' ? err.line : null
  const grade = result && present(result.grade) ? result.grade : null
  const outVar = result ? asArray(result.variables).find((v) => v.name === 'out') : null
  const hints = asArray(task?.hints)
  const forbidden = asArray(task?.forbidden)

  return (
    <Page eyebrow="Practice" title="MATLAB Code Lab"
      subtitle="Write real MATLAB code in the browser. MATLAB runs it, shows the Command Window, figures and workspace — and checks your task solutions automatically.">
      <div className="code-lab">
        <aside className="code-tasks card" aria-label="Tasks">
          <div className="lab-panel-title">Tasks · {solved.length}/{tasks.length} solved</div>
          <button className={`task-item ${isFree ? 'active' : ''}`} onClick={() => setTaskId(FREE)} aria-current={isFree}>
            <Icon name="code" size={16} /> <span className="task-name">Free practice</span>
          </button>
          {tasks.map((t) => (
            <button key={t.id} className={`task-item ${t.id === taskId ? 'active' : ''} ${t.status === 'locked' ? 'locked' : ''}`} onClick={() => setTaskId(t.id)} aria-current={t.id === taskId}>
              <span className={`task-tick ${solved.includes(t.id) ? 'done' : ''}`} aria-label={solved.includes(t.id) ? 'solved' : t.status === 'locked' ? 'locked' : 'not solved'}>
                {solved.includes(t.id) ? '✓' : t.status === 'locked' ? <Icon name="lock" size={10} /> : ''}
              </span>
              <span className="task-name">{t.title}
                <small>{t.status === 'assigned' ? <b className={t.due && t.due < today && !solved.includes(t.id) ? 'overdue' : 'assigned'}>
                  {t.due ? `Assigned · due ${t.due}` : 'Assigned'}</b> : `${t.unit} · ${t.topic}`}</small>
              </span>
              <span className={LEVEL_BADGE[t.level] || 'badge'}>{t.level}</span>
            </button>
          ))}
        </aside>

        <div className="stack code-main">
          {!matlab.ok && <Note kind="warn">The Code Lab needs MATLAB. {matlab.ready ? 'MATLAB is not available.' : 'MATLAB is starting…'}</Note>}
          {teacher && <Note>Teacher preview: you can run every task (also locked ones) and see each model solution. Your runs are not recorded. Student work is under <a href="#submissions">Code submissions</a>.</Note>}

          {isFree ? (
            <Card title="Free practice">
              <p className="small" style={{ color: 'var(--text-2)' }}>
                <code>img</code> is {current ? 'the current Workspace image' : <>the sample <b>peppers.png</b> (load an image in the Workspace to use your own)</>}.
                Store a result image in <code>out</code> and send it to the Workspace with one click.
              </p>
              {!ipt && <p className="small muted mt-sm">The Image Processing Toolbox is not installed, so <code>imfilter</code>, <code>fspecial</code>, <code>medfilt2</code>, <code>imnoise</code>, <code>imhist</code>, <code>histeq</code>, <code>padarray</code>, <code>graythresh</code> … are Spatia's base-MATLAB stand-ins with the same calling syntax.</p>}
            </Card>
          ) : task && (
            <Card title={task.title} extra={
              <span className="row" style={{ gap: 6 }}>
                {solved.includes(task.id) && <span className="badge">✓ Solved</span>}
                <span className={LEVEL_BADGE[task.level] || 'badge'}>{task.level}</span>
              </span>}>
              <div className="task-brief">
                <div className="stack-sm">
                  <div className="eyebrow" style={{ margin: 0 }}>{task.unit} · {task.topic}</div>
                  {locked && <Note kind="warn">Your teacher has locked this task for now.</Note>}
                  {task.status === 'assigned' && (
                    <Note kind={task.due && task.due < today && !solved.includes(task.id) ? 'error' : 'warn'}>
                      <b>Assigned by your teacher{task.due ? ` · due ${task.due}` : ''}.</b>{task.teacherNote ? ` ${task.teacherNote}` : ''}
                    </Note>
                  )}
                  {asArray(task.instructions).map((line, i) => <p key={i}>{line}</p>)}
                  {forbidden.length > 0 && (
                    <p className="small muted">Not allowed here (write it yourself): {forbidden.map((f) => <code key={f} className="chip-code">{f}</code>)}</p>
                  )}
                  {hints.length > 0 && (
                    <div>
                      {hints.slice(0, hintsShown).map((h, i) => <Note key={i}><b>Hint {i + 1}:</b> {h}</Note>)}
                      {hintsShown < hints.length && (
                        <button className="btn btn-small btn-ghost" onClick={() => setHintsShown((n) => n + 1)}>
                          <Icon name="help" size={15} /> Show hint {hintsShown + 1} of {hints.length}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <ImageView id={inputId} title="img (input)" height={170} inspectable emptyText="Loading…" />
              </div>
            </Card>
          )}

          <Card title="Editor" extra={
            <span className="row" style={{ gap: 8 }}>
              <span className="small muted hide-mobile"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> runs</span>
              <button className="btn btn-small btn-ghost" onClick={download} title="Download as a .m file for MATLAB"><Icon name="download" size={15} /> .m</button>
              <button className="btn btn-small btn-ghost" onClick={reset} disabled={!isFree && !task}><Icon name="reset" size={15} /> Reset</button>
              {!isFree && (teacher || solved.includes(taskId)) && <button className="btn btn-small" onClick={showSolution}>Model solution</button>}
              {running
                ? <button className="btn btn-small" onClick={() => cancelRun()}>■ Stop</button>
                : <button className="btn btn-primary btn-small" onClick={runCode} disabled={!matlab.ok || (!isFree && !task) || locked}><Icon name="play" size={14} /> Run</button>}
            </span>}>
            <MatlabEditor value={code} onChange={edit} onRun={runCode} errorLine={errorLine} />
            {solution && (
              <div className="mt">
                <div className="row between"><h4>Model solution</h4><button className="btn btn-small btn-ghost" onClick={() => setSolution(null)}>Hide</button></div>
                <pre className="code mt-sm">{solution}</pre>
              </div>
            )}
          </Card>

          <div ref={results} className="stack">
            {(running || result || runError) && (
              <Card title="Command Window" extra={result && <span className="small muted">{fmt(result.timeMs, 0)} ms</span>}>
                <pre className="console" aria-live="polite">
                  {running && <span className="muted">Running in MATLAB…</span>}
                  {!running && result?.output}
                  {!running && !result?.output && !err && !runError && <span className="muted">(no output — remove the semicolon after a line, or use disp / fprintf)</span>}
                  {!running && err && <span className="console-error">{`Error${errorLine ? ` in line ${errorLine}` : ''}: ${err.message}`}</span>}
                  {!running && runError && <span className="console-error">{runError.message}</span>}
                </pre>
              </Card>
            )}

            {grade && !running && (
              <Card title="Check" extra={<span className={grade.passed ? 'badge' : 'badge badge-warn'}>{grade.passed ? 'Passed' : `${fmt(grade.match, 1)}% match`}</span>}>
                <Note kind={grade.passed ? 'ok' : 'warn'}>{grade.message}</Note>
                {asArray(grade.checks).length > 0 && (
                  <ul className="checklist">
                    {asArray(grade.checks).map((c) => <li key={c.name} className={c.ok ? 'ok' : 'bad'}>{c.ok ? '✓' : '✗'} {c.name}</li>)}
                  </ul>
                )}
                {present(grade.expectedId) && (
                  <ImageGrid columns={4} height={180} items={[
                    { id: inputId, title: 'img (input)' },
                    { id: outVar?.imageId || null, title: 'Your out', emptyText: 'out is not an image' },
                    { id: grade.expectedId, title: 'Expected' },
                    present(grade.diffId) && { id: grade.diffId, title: 'Difference ×4' },
                  ]} />
                )}
              </Card>
            )}

            {result && !running && asArray(result.figures).length > 0 && (
              <Card title="Figures">
                <ImageGrid columns={2} height={300} items={asArray(result.figures).map((id, i) => ({ id, title: `Figure ${i + 1}` }))} />
              </Card>
            )}

            {result && !running && asArray(result.variables).length > 0 && (
              <Card title="Workspace">
                <div style={{ overflowX: 'auto' }}>
                  <table className="data workspace-table">
                    <thead><tr><th>Name</th><th>Size</th><th>Class</th><th>Value</th></tr></thead>
                    <tbody>
                      {asArray(result.variables).map((v) => (
                        <tr key={v.name}>
                          <td className="mono"><b>{v.name}</b></td>
                          <td className="mono">{v.size}</td>
                          <td className="mono">{v.class}</td>
                          <td>
                            {present(v.imageId) ? (
                              <span className="row" style={{ gap: 10 }}>
                                <img className="ws-thumb" src={`/api/image/${v.imageId}.png`} alt={v.name} />
                                <span className="small muted">{v.preview}{v.clipped && ' · shown clipped to [0,1]'}</span>
                                {isFree && <UseButton id={v.imageId} label={`Code Lab: ${v.name}`} />}
                              </span>
                            ) : <span className="mono small">{v.preview}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Page>
  )
}
