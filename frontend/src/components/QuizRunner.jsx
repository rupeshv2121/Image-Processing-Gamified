import { useEffect, useRef, useState } from 'react'
import { toMatrix } from '../api'
import { KernelGrid, Note } from './ui'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const MULT = { easy: 1, medium: 1.5, hard: 2 }

// Runs a list of questions (from MATLAB questionBank.m / quizEngine.m).
// timePerQuestion = null disables the timer. Calls onFinish(results).
export default function QuizRunner({ questions, timePerQuestion = 10, classroom = false, onFinish, onQuit }) {
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [timeLeft, setTimeLeft] = useState(timePerQuestion || 0)
  const [results, setResults] = useState([])
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)
  const [score, setScore] = useState(0)
  const started = useRef(Date.now())

  const q = questions[idx]

  // countdown
  useEffect(() => {
    if (!timePerQuestion || revealed) return
    started.current = Date.now()
    setTimeLeft(timePerQuestion)
    const t = setInterval(() => {
      const left = Math.max(0, timePerQuestion - (Date.now() - started.current) / 1000)
      setTimeLeft(left)
      if (left <= 0) clearInterval(t)
    }, 100)
    return () => clearInterval(t)
  }, [idx, timePerQuestion, revealed])

  useEffect(() => {
    if (timePerQuestion && timeLeft <= 0 && !revealed) answer(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft])

  const answer = (choice) => {
    if (revealed) return
    const correct = choice === q.answer
    const left = timePerQuestion ? Math.round(timeLeft * 10) / 10 : 0
    setSelected(choice)
    setRevealed(true)
    const newStreak = correct ? streak + 1 : 0
    setStreak(newStreak)
    setBest((b) => Math.max(b, newStreak))
    if (correct) setScore((s) => s + Math.round(100 * (MULT[q.difficulty] || 1) + 5 * left + 10 * (newStreak - 1)))
    setResults((r) => [...r, { id: q.id, category: q.category, difficulty: q.difficulty, correct, timeLeft: left }])
  }

  const next = () => {
    if (idx + 1 >= questions.length) {
      onFinish(results)
      return
    }
    setIdx(idx + 1)
    setSelected(null)
    setRevealed(false)
  }

  // keyboard: 1-4 / A-D to answer, Enter for next
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      const n = '1234'.indexOf(e.key) >= 0 ? Number(e.key) : 'abcd'.indexOf(e.key.toLowerCase()) + 1
      if (!revealed && n >= 1 && n <= q.options.length) answer(n)
      else if (revealed && e.key === 'Enter') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const correctCount = results.filter((r) => r.correct).length
  const pct = timePerQuestion ? (timeLeft / timePerQuestion) * 100 : 100
  const kernel = q.kernel ? toMatrix(q.kernel) : null
  const options = Array.isArray(q.options) ? q.options : [q.options]

  return (
    <div className={`quiz-card ${classroom ? 'classroom' : ''}`}>
      <div className="quiz-top">
        <span>Question <b>{idx + 1}</b> / {questions.length}</span>
        <span>Score <b>{score}</b></span>
        <span>Streak <b>{streak}{streak >= 3 ? ' 🔥' : ''}</b></span>
        <span>Accuracy <b>{results.length ? Math.round((correctCount / results.length) * 100) : 0}%</b></span>
        <span className="badge badge-navy">{q.category}</span>
        <span className={`badge ${q.difficulty === 'hard' ? 'badge-warn' : ''}`}>{q.difficulty}</span>
        {timePerQuestion ? <span className={`timer ${timeLeft < 3.5 ? 'low' : ''}`}>{Math.ceil(timeLeft)}</span> : null}
      </div>
      <div className="progressbar" style={{ marginBottom: 6 }}>
        <div style={{ width: `${((idx + (revealed ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>
      {timePerQuestion ? (
        <div className={`progressbar ${pct < 35 ? 'danger' : pct < 60 ? 'warn' : ''}`}><div style={{ width: `${pct}%`, transition: 'none' }} /></div>
      ) : null}

      <div className="question">{q.question}</div>
      {kernel && <div style={{ marginBottom: 14 }}><KernelGrid matrix={kernel} /></div>}
      <div className="options">
        {options.map((o, i) => {
          const n = i + 1
          let cls = 'option'
          if (revealed && n === q.answer) cls += ' correct'
          else if (revealed && n === selected) cls += ' wrong'
          return (
            <button key={i} className={cls} disabled={revealed} onClick={() => answer(n)}>
              <span className="letter">{LETTERS[i]}</span>{o}
            </button>
          )
        })}
      </div>

      {revealed && (
        <div className="explanation">
          <Note kind={selected === q.answer ? 'ok' : 'error'}>
            <b>{selected === q.answer ? 'Correct!' : selected == null ? `Time's up! Correct answer: ${LETTERS[q.answer - 1]}` : `Wrong — correct answer: ${LETTERS[q.answer - 1]}`}</b>
            <div style={{ marginTop: 4 }}>{q.explanation}</div>
          </Note>
          <div className="row right" style={{ marginTop: 12 }}>
            {onQuit && <button className="btn" onClick={onQuit}>Quit</button>}
            <button className="btn btn-primary" onClick={next} autoFocus>{idx + 1 >= questions.length ? 'Finish' : 'Next question →'}</button>
          </div>
        </div>
      )}
      {!revealed && classroom && (
        <div className="row right" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => answer(null)}>Reveal answer now</button>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 10 }}>Keyboard: 1–4 or A–D to answer, Enter for the next question. Best streak: {best}</p>
    </div>
  )
}
