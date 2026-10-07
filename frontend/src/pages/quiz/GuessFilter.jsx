import { useState } from 'react'
import { useApp } from '../../AppContext'
import { asArray } from '../../api'
import { Card, ImageView, NeedImage, Note } from '../../components/ui'

export default function GuessFilter() {
  const { current, call } = useApp()
  const [round, setRound] = useState(null)
  const [choice, setChoice] = useState(null)
  const [stats, setStats] = useState({ played: 0, correct: 0, streak: 0, best: 0 })

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
    const ok = i === round.answer
    setStats((s) => {
      const streak = ok ? s.streak + 1 : 0
      return { played: s.played + 1, correct: s.correct + (ok ? 1 : 0), streak, best: Math.max(s.best, streak) }
    })
  }
  const options = asArray(round?.options)

  return (
    <NeedImage>
      <Card title={`Score ${stats.correct} / ${stats.played} · streak ${stats.streak}${stats.streak >= 3 ? ' 🔥' : ''} · best ${stats.best}`}
        extra={<button className="btn btn-primary" onClick={next}>{round ? 'Next image' : 'Start'}</button>}>
        {!round && <p className="muted">MATLAB applies a random filter (mean, median, Gaussian, Laplacian, Sobel or Prewitt) to the workspace image. Guess which one!</p>}
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
