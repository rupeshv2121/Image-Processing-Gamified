import { useEffect, useRef, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt, imageUrl, run } from '../api'
import Icon from '../components/Icon'
import { MEDALS, UNITS, unitProgress } from '../content/missions'

// ---------------------------------------------------------------- hero animation
// A 3x3 averaging kernel slides over an 8x8 "image"; the output fills in as it goes.
const N = 8
const INPUT = Array.from({ length: N * N }, (_, i) => {
  const r = Math.floor(i / N)
  const c = i % N
  let v = 40 + c * 10 + r * 6
  if (r >= 2 && r <= 5 && c >= 3 && c <= 6) v = 220
  if ((r * 7 + c * 3) % 11 === 0) v = 250            // a few "salt" pixels
  return Math.min(255, v)
})
const OUT = N - 2

function KernelAnimation() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % (OUT * OUT + 6)), 420)
    return () => clearInterval(t)
  }, [])
  const pos = Math.min(step, OUT * OUT - 1)
  const pr = Math.floor(pos / OUT)
  const pc = pos % OUT
  const mean = (r, c) => {
    let s = 0
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += INPUT[(r + i) * N + c + j]
    return Math.round(s / 9)
  }
  const done = step >= OUT * OUT
  return (
    <div className="kanim">
      <div className="kanim-grids">
        <div>
          <div className="kanim-label">Input f</div>
          <div className="kgrid" style={{ gridTemplateColumns: `repeat(${N}, auto)` }}>
            {INPUT.map((v, i) => {
              const r = Math.floor(i / N)
              const c = i % N
              const inWin = !done && r >= pr && r < pr + 3 && c >= pc && c < pc + 3
              const ctr = inWin && r === pr + 1 && c === pc + 1
              return <i key={i} className={ctr ? 'ctr' : inWin ? 'win' : ''} style={{ background: `rgb(${v},${v},${v})` }} />
            })}
          </div>
        </div>
        <Icon name="arrow" size={26} className="faint" />
        <div>
          <div className="kanim-label">Output g = mean 3×3</div>
          <div className="kgrid" style={{ gridTemplateColumns: `repeat(${OUT}, auto)` }}>
            {Array.from({ length: OUT * OUT }, (_, i) => {
              const filled = done || i <= pos
              const v = filled ? mean(Math.floor(i / OUT), i % OUT) : null
              return <i key={i} className={!done && i === pos ? 'cur' : ''} style={{ background: v == null ? 'rgba(255,255,255,0.06)' : `rgb(${v},${v},${v})` }} />
            })}
          </div>
        </div>
      </div>
      <div className="kanim-caption">
        {done ? 'Salt pixels smeared — a median filter would remove them. Try it in the lab →' : `g(${pr + 2},${pc + 2}) = Σ f / 9 = ${mean(pr, pc)}`}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- count-up
function CountUp({ to, suffix = '' }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let frame
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 1200)
      setV(Math.round(to * (1 - (1 - p) ** 3)))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [to])
  return <>{v}{suffix}</>
}

// ---------------------------------------------------------------- live MATLAB demo
const DEMO_FILTERS = [
  { name: 'median', label: 'Median', kind: 'non-linear' },
  { name: 'mean', label: 'Mean', kind: 'linear' },
  { name: 'gaussian', label: 'Gaussian', kind: 'linear' },
  { name: 'min', label: 'Min', kind: 'non-linear' },
]

function LiveDemo() {
  const { matlab } = useApp()
  const [base, setBase] = useState(null)
  const [filter, setFilter] = useState('median')
  const [results, setResults] = useState({})
  const [pos, setPos] = useState(50)
  const [error, setError] = useState(null)
  const box = useRef(null)
  const dragging = useRef(false)

  useEffect(() => {
    if (!matlab.ok || base) return
    ;(async () => {
      try {
        const img = await run('loadSample', { name: 'peppers.png', track: false })
        const noisy = await run('noise', { id: img.id, type: 'saltpepper', density: 0.08, seed: 3, track: false })
        setBase({ clean: img.id, noisy: noisy.id, psnr: noisy.psnr })
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [matlab.ok, base])

  useEffect(() => {
    if (!base || results[filter]) return
    run('filter', { id: base.noisy, name: filter, k: 3, sigma: 1, refId: base.clean, track: false })
      .then((d) => setResults((r) => ({ ...r, [filter]: d.runs[0] ?? asArray(d.runs)[0] })))
      .catch((e) => setError(e.message))
  }, [base, filter, results])

  const move = (clientX) => {
    const rect = box.current.getBoundingClientRect()
    setPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)))
  }
  const res = results[filter]
  const f = DEMO_FILTERS.find((x) => x.name === filter)

  return (
    <div className="grid-2" style={{ alignItems: 'center', gap: 56 }}>
      <div>
        <div className="eyebrow">Live · computed by MATLAB right now</div>
        <h2 style={{ fontSize: 34 }}>Drag to see a filter clean an image</h2>
        <p className="muted" style={{ fontSize: 16.5, margin: '14px 0 26px' }}>
          8% of the pixels in this photo were replaced by salt & pepper noise. Choose a filter — MATLAB runs it and
          measures the result. Notice how the non-linear median filter wins.
        </p>
        <div className="segmented" style={{ marginBottom: 24 }}>
          {DEMO_FILTERS.map((d) => (
            <button key={d.name} className={filter === d.name ? 'active' : ''} onClick={() => setFilter(d.name)}>{d.label}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 28 }}>
          <div><div className="faint tiny">NOISY PSNR</div><div style={{ fontSize: 28, fontWeight: 800, color: 'var(--red-500)' }}>{base ? `${fmt(base.psnr, 1)} dB` : '—'}</div></div>
          <Icon name="arrow" className="faint" />
          <div><div className="faint tiny">{f.label.toUpperCase()} PSNR</div><div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green-500)' }}>{res ? `${fmt(res.psnr, 1)} dB` : '…'}</div></div>
          <div><div className="faint tiny">SSIM</div><div style={{ fontSize: 28, fontWeight: 800, color: 'var(--navy-800)' }}>{res ? fmt(res.ssim, 2) : '…'}</div></div>
        </div>
        <p className="small faint" style={{ marginTop: 14 }}>{f.label} is a {f.kind} filter{res ? ` · ${fmt(res.timeMs, 0)} ms in MATLAB` : ''}.</p>
      </div>
      <div
        ref={box} className="compare" style={{ '--pos': `${pos}%` }}
        onMouseDown={(e) => { dragging.current = true; move(e.clientX) }}
        onMouseMove={(e) => dragging.current && move(e.clientX)}
        onMouseUp={() => { dragging.current = false }} onMouseLeave={() => { dragging.current = false }}
        onTouchMove={(e) => move(e.touches[0].clientX)}
      >
        {base ? (
          <>
            <img src={imageUrl(base.noisy)} alt="noisy" draggable={false} />
            {res && <img className="after" src={imageUrl(res.id)} alt="filtered" draggable={false} />}
            <div className="handle" />
            <span className="tagl">Noisy</span>
            <span className="tagr">{f.label} filtered</span>
          </>
        ) : (
          <div className="compare-placeholder">
            {error ? error : matlab.ok ? 'MATLAB is preparing the demo…' : 'Waiting for MATLAB to start… (first start can take a minute)'}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- arcade teaser
const TEASERS = [
  { q: 'Which filter is best suited for salt-and-pepper noise?', o: ['Mean', 'Median', 'Laplacian', 'Sobel'], a: 1, e: 'Impulses land at the ends of the sorted window — the median ignores them.' },
  { q: 'Convolution differs from correlation because the kernel is…', o: ['Normalised', 'Rotated by 180°', 'Squared', 'Inverted'], a: 1, e: 'Flip horizontally and vertically, then slide exactly like correlation.' },
  { q: 'Histogram equalisation maps grey levels using the…', o: ['Mean', 'Median', 'Cumulative distribution (CDF)', 'Gradient'], a: 2, e: 's_k = (L−1) · CDF(r_k) spreads the grey levels across the full range.' },
]

function Teaser() {
  const [i, setI] = useState(0)
  const [pick, setPick] = useState(null)
  const [xp, setXp] = useState(0)
  const t = TEASERS[i]
  const choose = (k) => {
    if (pick != null) return
    setPick(k)
    if (k === t.a) setXp((x) => x + 100)
  }
  return (
    <div className="teaser">
      <div className="row between">
        <span className="badge badge-navy">Sample question {i + 1}/{TEASERS.length}</span>
        <span className="row" style={{ gap: 6, fontWeight: 700, color: 'var(--navy-800)' }}>
          <Icon name="star" size={17} /> {xp} XP {pick === t.a && <span key={i} className="xp-pop">+100</span>}
        </span>
      </div>
      <div className="question" style={{ fontSize: 20 }}>{t.q}</div>
      <div className="options">
        {t.o.map((o, k) => {
          let cls = 'option'
          if (pick != null && k === t.a) cls += ' correct'
          else if (pick === k) cls += ' wrong'
          return <button key={k} className={cls} disabled={pick != null} onClick={() => choose(k)}><span className="letter">{'ABCD'[k]}</span>{o}</button>
        })}
      </div>
      {pick != null && (
        <div className="row between" style={{ marginTop: 18 }}>
          <span className="small muted" style={{ flex: 1 }}>{t.e}</span>
          <button className="btn btn-navy" onClick={() => { setI((i + 1) % TEASERS.length); setPick(null) }}>Next →</button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- page
export default function Landing() {
  const { matlab, progress, meta } = useApp()
  const [top, setTop] = useState([])
  useEffect(() => {
    if (matlab.ok) run('leaderboard', { action: 'get' }).then((d) => setTop(asArray(d).slice(0, 3))).catch(() => {})
  }, [matlab.ok])
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  const earned = asArray(progress?.badges).filter((b) => b.earned)

  return (
    <div className="landing">
      <nav className="l-nav">
        <a className="brand" href="#home">
          <span className="logo"><i /><i /><i /><i /></span>
          <span><b>ImageLab</b></span>
        </a>
        <a className="l-link" href="#home" onClick={(e) => { e.preventDefault(); scrollTo('how') }}>How it works</a>
        <a className="l-link" href="#home" onClick={(e) => { e.preventDefault(); scrollTo('demo') }}>Live demo</a>
        <a className="l-link" href="#home" onClick={(e) => { e.preventDefault(); scrollTo('quest') }}>Quest</a>
        <a className="l-link" href="#home" onClick={(e) => { e.preventDefault(); scrollTo('arcade') }}>Arcade</a>
        <span className="spacer" />
        <span className="pill" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: '#c9d4e5' }}>
          <span className={`dot ${matlab.ok ? 'ok' : matlab.ready ? 'err' : 'wait'}`} /> {matlab.ok ? `MATLAB ${matlab.release}` : matlab.ready ? 'MATLAB unavailable' : 'Starting MATLAB…'}
        </span>
        <a className="btn btn-primary" href="#dashboard">Enter the Lab</a>
      </nav>

      <header className="l-hero">
        <div className="l-hero-inner">
          <div className="reveal">
            <span className="l-chip"><Icon name="sparkles" size={15} /> Image Enhancement using Spatial Domain Filters</span>
            <h1>Learn image processing by <em>doing it</em> in MATLAB.</h1>
            <p className="lead">
              ImageLab is an interactive laboratory where every filter runs in MATLAB — both the toolbox call and a
              hand-written implementation — so you see not just <i>what</i> happens, but <i>how</i>.
            </p>
            <div className="row" style={{ gap: 14 }}>
              <a className="btn btn-primary btn-lg" href={meta ? '#dashboard' : '#workspace'}>
                <Icon name="play" size={17} /> {meta ? 'Continue learning' : 'Start the lab'}
              </a>
              <button className="btn btn-lg" onClick={() => scrollTo('demo')}>See it live</button>
            </div>
            <div className="l-trust">
              <div><b><CountUp to={4} /></b>syllabus units</div>
              <div><b><CountUp to={13} /></b>experiments</div>
              <div><b><CountUp to={90} /></b>quiz questions</div>
              <div><b><CountUp to={60} suffix="+" /></b>MATLAB functions</div>
            </div>
          </div>
          <div className="reveal" style={{ animationDelay: '0.15s' }}>
            <KernelAnimation />
          </div>
        </div>
      </header>

      <section className="l-section" id="how">
        <div className="l-inner">
          <div className="l-head">
            <div className="eyebrow">How it works</div>
            <h2>Three steps from pixels to understanding</h2>
            <p>No black boxes: every result can be traced back to the MATLAB code that produced it.</p>
          </div>
          <div className="l-steps">
            {[
              ['image', 'Load an image', 'Use a sample or your own photo. MATLAB reads it and reports size, class and colour space.'],
              ['sliders', 'Experiment', 'Add noise, filter, equalise, sharpen, detect edges — and compare the toolbox with the manual version.'],
              ['trophy', 'Prove it', 'Run the 13 experiments, generate reports, beat the quiz and climb the leaderboard.'],
            ].map(([ic, t, d], k) => (
              <div className="l-step" key={t}>
                <span className="n">0{k + 1}</span>
                <div className="ic"><Icon name={ic} size={24} /></div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="l-section alt" id="demo">
        <div className="l-inner"><LiveDemo /></div>
      </section>

      <section className="l-section dark" id="quest">
        <div className="l-inner">
          <div className="l-head">
            <div className="eyebrow">Your quest</div>
            <h2>Four units. Four levels. One lab.</h2>
            <p>Each syllabus unit is a level of missions. Complete them to earn XP and unlock badges.</p>
          </div>
          <div className="quest">
            {UNITS.map((u) => {
              const pr = unitProgress(u, progress, { imageLoaded: !!meta })
              const r = 52
              const c = 2 * Math.PI * r
              return (
                <a key={u.id} className="quest-node" href={`#${u.lab}`}>
                  <div className="orb">
                    <svg width="110" height="110" viewBox="0 0 110 110">
                      <circle cx="55" cy="55" r={r} stroke="rgba(255,255,255,0.1)" strokeWidth="5" fill="none" />
                      <circle cx="55" cy="55" r={r} stroke="var(--green-400)" strokeWidth="5" fill="none" strokeLinecap="round"
                        strokeDasharray={c} strokeDashoffset={c * (1 - pr.ratio)} />
                    </svg>
                    {u.num}
                  </div>
                  <h4>{u.title}</h4>
                  <p>{u.subtitle}</p>
                  <span className="lvl">{pr.done}/{pr.total} missions</span>
                </a>
              )
            })}
          </div>
          <div className="row center" style={{ marginTop: 56, gap: 14 }}>
            {earned.length ? earned.slice(0, 6).map((b) => (
              <span key={b.id} className="l-chip" style={{ margin: 0 }}>{MEDALS[b.id]} {b.name}</span>
            )) : ['🧪 Filter Master', '🔍 Edge Detective', '🔄 Convolution Expert', '💯 Perfect Quiz'].map((b) => (
              <span key={b} className="l-chip" style={{ margin: 0, opacity: 0.7 }}>{b}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="l-section">
        <div className="l-inner">
          <div className="l-head">
            <div className="eyebrow">Inside the lab</div>
            <h2>Built to make the theory visible</h2>
          </div>
          <div className="f-grid">
            {[
              ['code', 'var(--navy-100)', 'var(--navy-600)', 'Toolbox vs manual', 'Every key algorithm twice: medfilt2 next to an explicit sort-and-pick loop — with identical results.'],
              ['conv', 'var(--green-100)', 'var(--green-600)', 'Step-by-step convolution', 'Watch the kernel flip and slide, with every product and sum shown.'],
              ['kernel', 'var(--amber-100)', '#b47a0b', 'Kernel playground', 'Type any 3×3 – 7×7 kernel and see MATLAB apply it as you edit.'],
              ['chart', 'var(--violet-100)', 'var(--violet-500)', 'Objective comparison', 'Rank filters by MSE, PSNR, SSIM and time, with MATLAB bar charts.'],
              ['file', 'var(--navy-100)', 'var(--navy-600)', 'Experiments & reports', '13 university-style experiments and one-click lab reports.'],
              ['user', 'var(--green-100)', 'var(--green-600)', 'Classroom mode', 'Projector-ready quiz with a big timer for the whole class.'],
            ].map(([ic, bg, fg, t, d]) => (
              <div className="f-card" key={t}>
                <div className="ic" style={{ background: bg, color: fg }}><Icon name={ic} size={24} /></div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="l-section alt" id="arcade">
        <div className="l-inner grid-2" style={{ alignItems: 'center', gap: 56 }}>
          <div>
            <div className="eyebrow">The Arcade</div>
            <h2 style={{ fontSize: 34 }}>Ten questions. Ten seconds each.</h2>
            <p className="muted" style={{ fontSize: 16.5, margin: '14px 0 28px' }}>
              Rapid Fire, Kernel Quiz, Guess the Filter, Build the Pipeline and a timed restoration challenge.
              Streaks multiply your score — the best make the podium.
            </p>
            <div className="podium" style={{ maxWidth: 420 }}>
              {[1, 0, 2].map((k) => {
                const p = top[k]
                return (
                  <div key={k} className={`p${k + 1}`}>
                    <div className="medal">{['🥇', '🥈', '🥉'][k]}</div>
                    <b>{p ? p.Name : 'Your name?'}</b>
                    <span>{p ? `${p.Score} pts` : '—'}</span>
                  </div>
                )
              })}
            </div>
            <a className="btn btn-primary btn-lg" href="#quiz" style={{ marginTop: 28 }}><Icon name="gamepad" size={18} /> Open the Arcade</a>
          </div>
          <Teaser />
        </div>
      </section>

      <section className="l-cta">
        <h2>Ready to filter some pixels?</h2>
        <p>Everything runs offline in MATLAB on your computer.</p>
        <div className="row center" style={{ gap: 14 }}>
          <a className="btn btn-primary btn-lg" href="#dashboard">Enter the Lab</a>
          <a className="btn btn-lg" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} href="#learn">Read the theory</a>
        </div>
      </section>

      <footer className="l-foot">
        <span>ImageLab — Interactive Image Processing Laboratory</span>
        <span>Spatial-domain processing · MATLAB {matlab.release || ''} · offline</span>
      </footer>
    </div>
  )
}
