import { useState } from 'react'
import { useApp } from '../../AppContext'
import { asArray } from '../../api'
import { Card, ImageView, NeedImage, Note } from '../../components/ui'
import { PlayerFields, Summary } from '../QuizHub'

// A round is 10 images. It is scored like the Rapid Fire Quiz (services/quiz.py:
// 100 x 1.5 per correct guess + 10 x streak bonus) and counts in the topic accuracy.
const ROUND = 10
const CATEGORY = { Mean: 'Linear Filters', Gaussian: 'Linear Filters', Median: 'Non-Linear Filters',
  Laplacian: 'Sharpening', Sobel: 'Edge Detection', Prewitt: 'Edge Detection' }

export default function GuessFilter() {
  const { current, call, profile, refreshProgress } = useApp()
  const [name, setName] = useState(() => profile?.name || '')
  const [round, setRound] = useState(null)
  const [choice, setChoice] = useState(null)
  const [results, setResults] = useState([])
  const [summary, setSummary] = useState(null)

  const next = async () => {
    const d = await call('guessFilter', { id: current }, { label: 'MATLAB is choosing a random filter' })
    if (d) {
      setRound(d)
      setChoice(null)
    }
  }
  const pick = (i) => {
    if (choice != null) return
    setChoice(i)
    const answer = asArray(round.options)[round.answer - 1]
    setResults((r) => [...r, { id: `GF${r.length + 1}`, category: CATEGORY[answer] || 'Spatial Filters', difficulty: 'medium',
      correct: i === round.answer, timeLeft: 0 }])
  }
  const finish = async () => {
    const d = await call('quizSubmit', { results, name, mode: 'Guess the Filter' }, { label: 'Scoring the round' })
    if (d) {
      setSummary(d)
      refreshProgress()
    }
  }
  const again = () => {
    setSummary(null)
    setResults([])
    setRound(null)
    setChoice(null)
  }

  if (summary) return <Summary summary={summary.summary} progress={summary.progress} onAgain={again} />
  const options = asArray(round?.options)
  const correct = results.filter((r) => r.correct).length
  let streak = 0
  for (const r of results) streak = r.correct ? streak + 1 : 0
  const done = results.length >= ROUND
  return (
    <NeedImage>
      <Card title={round ? `Image ${choice == null ? results.length + 1 : results.length} of ${ROUND} · ${correct} correct · streak ${streak}${streak >= 3 ? ' 🔥' : ''}` : `A round of ${ROUND} images`}
        extra={done
          ? <button className="btn btn-primary" onClick={finish}>See my score</button>
          : <button className="btn btn-primary" onClick={next} disabled={round && choice == null}>{round ? 'Next image' : 'Start'}</button>}>
        {!round && (
          <>
            <p className="muted">MATLAB applies a random filter (mean, median, Gaussian, Laplacian, Sobel or Prewitt) to the workspace image. Guess which one! A round is {ROUND} images.</p>
            <PlayerFields name={name} setName={setName} />
          </>
        )}
        {round && (
          <>
            <div className="grid-2">
              <ImageView id={round.inputId} title="Input" height={320} />
              <ImageView id={round.outputId} title="Processed image" height={320} />
            </div>
            <div className="options" style={{ marginTop: 14 }}>
              {options.map((o, i) => {
                const n = i + 1
                let cls = 'option'
                if (choice != null && n === round.answer) cls += ' correct'
                else if (choice === n) cls += ' wrong'
                return <button key={o} className={cls} disabled={choice != null} onClick={() => pick(n)}><span className="letter">{'ABCDEF'[i]}</span>{o}</button>
              })}
            </div>
            {choice != null && (
              <Note kind={choice === round.answer ? 'ok' : 'error'}>
                <b>{choice === round.answer ? 'Correct!' : `It was ${options[round.answer - 1]}.`}</b> {round.explanation}
              </Note>
            )}
          </>
        )}
      </Card>
    </NeedImage>
  )
}
