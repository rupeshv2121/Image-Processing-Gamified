import { useEffect, useRef, useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt, imageUrl, run } from '../api'
import { Logo, SITE_NAME, SITE_TAGLINE } from '../components/Brand'
import Icon from '../components/Icon'
import ThemeToggle from '../components/ThemeToggle'
import { MEDALS, UNITS, unitProgress } from '../content/missions'
import { bestPerStudent } from '../leaderboard'
import '../landing.css'

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
    <div className="lp-kanim">
      <div className="lp-kanim-head">
        <span className="lp-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="mono">g = imfilter(f, ones(3)/9)</span>
      </div>
      <div className="lp-kanim-grids">
        <div>
          <div className="lp-kanim-label">Input f</div>
          <div className="lp-kgrid" style={{ gridTemplateColumns: `repeat(${N}, auto)` }}>
            {INPUT.map((v, i) => {
              const r = Math.floor(i / N)
              const c = i % N
              const inWin = !done && r >= pr && r < pr + 3 && c >= pc && c < pc + 3
              const ctr = inWin && r === pr + 1 && c === pc + 1
              return <i key={i} className={ctr ? 'ctr' : inWin ? 'win' : ''} style={{ background: `rgb(${v},${v},${v})` }} />
            })}
          </div>
        </div>
        <Icon name="arrow" size={22} className="lp-kanim-arrow" />
        <div>
          <div className="lp-kanim-label">Output g</div>
          <div className="lp-kgrid" style={{ gridTemplateColumns: `repeat(${OUT}, auto)` }}>
            {Array.from({ length: OUT * OUT }, (_, i) => {
              const filled = done || i <= pos
              const v = filled ? mean(Math.floor(i / OUT), i % OUT) : null
              return <i key={i} className={!done && i === pos ? 'cur' : ''} style={{ background: v == null ? 'rgba(255,255,255,0.06)' : `rgb(${v},${v},${v})` }} />
            })}
          </div>
        </div>
      </div>
      <div className="lp-kanim-caption">
        {done ? 'Salt pixels smeared — a median filter would remove them.' : `g(${pr + 2},${pc + 2}) = Σ f / 9 = ${mean(pr, pc)}`}
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
    <div className="lp-split">
      <div>
        <div className="lp-eyebrow ch-g"><span className="lp-live" /> Live · computed by MATLAB right now</div>
        <h2 className="lp-h2">Drag to see a filter clean an image</h2>
        <p className="lp-text">
          8% of the pixels in this photo were replaced by salt & pepper noise. Choose a filter — MATLAB runs it and
          measures the result. Notice how the non-linear median filter wins.
        </p>
        <div className="segmented" style={{ marginBottom: 24 }}>
          {DEMO_FILTERS.map((d) => (
            <button key={d.name} className={filter === d.name ? 'active' : ''} onClick={() => setFilter(d.name)}>{d.label}</button>
          ))}
        </div>
        <div className="lp-metrics">
          <div><span>Noisy PSNR</span><b className="bad">{base ? `${fmt(base.psnr, 1)} dB` : '—'}</b></div>
          <div><span>{f.label} PSNR</span><b className="good">{res ? `${fmt(res.psnr, 1)} dB` : '…'}</b></div>
          <div><span>MSE</span><b>{res ? fmt(res.mse, 4) : '…'}</b></div>
        </div>
        <p className="small faint" style={{ marginTop: 14 }}>{f.label} is a {f.kind} filter{res ? ` · ${fmt(res.timeMs, 0)} ms in MATLAB` : ''}.</p>
      </div>
      <div
        ref={box} className="lp-compare" style={{ '--pos': `${pos}%` }}
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
          <div className="lp-compare-placeholder">
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
    <div className="lp-teaser">
      <div className="row between">
        <span className="lp-tag">Sample question {i + 1}/{TEASERS.length}</span>
        <span className="row" style={{ gap: 6, fontWeight: 700 }}>
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
          <button className="lp-btn lp-btn-dark" onClick={() => { setI((i + 1) % TEASERS.length); setPick(null) }}>Next →</button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- navbar
// [id, label, colour channel of its accent]
const SECTIONS = [
  ['how', 'How it works', 'r'],
  ['demo', 'Live demo', 'g'],
  ['syllabus', 'Syllabus', 'b'],
  ['features', 'Features', 'r'],
  ['arcade', 'Arcade', 'g'],
]
const CH = ['r', 'g', 'b']

function LandingNav({ scroller, enter, signedIn }) {
  const { matlab } = useApp()
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState(null)
  const [open, setOpen] = useState(false)

  // Raise the bar once the page scrolls, and highlight the section in view
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const onScroll = () => setScrolled(root.scrollTop > 8)
    root.addEventListener('scroll', onScroll, { passive: true })
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id) })
    }, { root, rootMargin: '-45% 0px -50% 0px' })
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el) })
    const onTop = () => { if (root.scrollTop < 200) setActive(null) }
    root.addEventListener('scroll', onTop, { passive: true })
    return () => { root.removeEventListener('scroll', onScroll); root.removeEventListener('scroll', onTop); io.disconnect() }
  }, [scroller])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const go = (e, id) => {
    e.preventDefault()
    setOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }
  const status = matlab.ok ? `MATLAB ${matlab.release}` : matlab.ready ? 'MATLAB unavailable' : 'Starting MATLAB…'

  return (
    <header className={`lp-nav ${scrolled ? 'scrolled' : ''} ${open ? 'open' : ''}`}>
      <div className="lp-nav-bar">
        <a className="lp-brand" href="#home" onClick={(e) => { e.preventDefault(); scroller.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          <Logo />
          <b>{SITE_NAME}</b>
        </a>
        <nav className="lp-nav-links" aria-label="Sections">
          {SECTIONS.map(([id, label, ch]) => (
            <a key={id} href={`#${id}`} className={`ch-${ch} ${active === id ? 'active' : ''}`} aria-current={active === id ? 'true' : undefined} onClick={(e) => go(e, id)}>{label}</a>
          ))}
        </nav>
        <div className="lp-nav-actions">
          <span className="lp-status" title={status} role="status">
            <span className={`dot ${matlab.ok ? 'ok' : matlab.ready ? 'err' : 'wait'}`} aria-hidden="true" />
            <span className="lp-status-text">{status}</span>
          </span>
          <ThemeToggle className="lp-icon-btn" />
          <a className="lp-btn lp-btn-primary lp-nav-cta" href={enter}>{signedIn ? 'Open dashboard' : 'Sign in'} <Icon name="arrow" size={15} /></a>
          <button className="lp-icon-btn lp-menu-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="lp-sheet" aria-label={open ? 'Close menu' : 'Open menu'}>
            <Icon name={open ? 'close' : 'menu'} size={20} />
          </button>
        </div>
      </div>
      {open && (
        <nav className="lp-sheet" id="lp-sheet" aria-label="Sections">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={active === id ? 'active' : ''} onClick={(e) => go(e, id)}>{label}</a>
          ))}
          <a className="lp-btn lp-btn-primary" href={enter}>{signedIn ? 'Open dashboard' : 'Sign in'}</a>
        </nav>
      )}
    </header>
  )
}

// ---------------------------------------------------------------- page
const FEATURES = [
  ['code', 'Toolbox vs manual', 'Every key algorithm twice: medfilt2 next to an explicit sort-and-pick loop — with identical results.'],
  ['conv', 'Step-by-step convolution', 'Watch the kernel flip and slide, with every product and sum shown.'],
  ['kernel', 'Kernel playground', 'Type any 3×3 – 7×7 kernel and see MATLAB apply it as you edit.'],
  ['chart', 'Objective restoration', 'Measure every filter and deblurring method by MSE and PSNR against the original.'],
  ['file', 'Experiments & reports', '13 university-style experiments and one-click lab reports.'],
  ['users', 'Classroom mode', 'Projector-ready live quiz with a big timer for the whole class.'],
]

export default function Landing() {
  const { matlab, progress, meta, role } = useApp()
  const enter = role === 'teacher' ? '#class' : role === 'student' ? '#dashboard' : '#start'
  const scroller = useRef(null)
  const [top, setTop] = useState([])
  useEffect(() => {
    if (matlab.ok) run('leaderboard', { action: 'get' }).then((d) => setTop(bestPerStudent(asArray(d)).slice(0, 3))).catch(() => {})
  }, [matlab.ok])
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  const earned = asArray(progress?.badges).filter((b) => b.earned)

  return (
    <div className="landing" ref={scroller}>
      <LandingNav scroller={scroller} enter={enter} signedIn={!!role} />

      <header className="lp-hero">
        <div className="lp-inner lp-hero-inner">
          <div className="reveal">
            <span className="lp-chip"><span className="rgb-marks" aria-hidden="true"><i /><i /><i /></span> Image Enhancement using Spatial Domain Filters</span>
            <h1>Learn image processing by <em>doing it</em> in MATLAB.</h1>
            <p className="lp-lead">
              {SITE_NAME} is an interactive laboratory where every filter runs in MATLAB — both the toolbox call and a
              hand-written implementation — so you see not just <i>what</i> happens, but <i>how</i>.
            </p>
            <div className="lp-cta-row">
              <a className="lp-btn lp-btn-primary lp-btn-lg" href={enter}>
                <Icon name="play" size={16} /> {meta ? 'Continue learning' : 'Start the lab'}
              </a>
              <button className="lp-btn lp-btn-outline lp-btn-lg" onClick={() => scrollTo('demo')}>See it live</button>
            </div>
          </div>
          <div className="reveal" style={{ animationDelay: '0.12s' }}>
            <KernelAnimation />
          </div>
        </div>
        <div className="lp-inner">
          <dl className="lp-stats">
            <div className="ch-r"><dt>Syllabus units</dt><dd><CountUp to={4} /></dd></div>
            <div className="ch-g"><dt>Experiments</dt><dd><CountUp to={13} /></dd></div>
            <div className="ch-b"><dt>Quiz questions</dt><dd><CountUp to={90} /></dd></div>
            <div><dt>MATLAB functions</dt><dd><CountUp to={60} suffix="+" /></dd></div>
          </dl>
        </div>
      </header>

      <section className="lp-section" id="how">
        <div className="lp-inner">
          <div className="lp-head">
            <div className="lp-eyebrow ch-r">How it works</div>
            <h2 className="lp-h2">Three steps from pixels to understanding</h2>
            <p className="lp-text">No black boxes: every result can be traced back to the MATLAB code that produced it.</p>
          </div>
          <ol className="lp-steps">
            {[
              ['image', 'Load an image', 'Use a sample or your own photo. MATLAB reads it and reports size, class and colour space.'],
              ['sliders', 'Experiment', 'Add noise, filter, equalise, sharpen, detect edges — and compare the toolbox with the manual version.'],
              ['trophy', 'Prove it', 'Run the 13 experiments, generate reports, beat the quiz and climb the leaderboard.'],
            ].map(([ic, t, d], k) => (
              <li className={`lp-step ch-${CH[k]}`} key={t}>
                <div className="lp-step-top">
                  <span className="lp-ic"><Icon name={ic} size={20} /></span>
                  <span className="lp-step-n">0{k + 1}</span>
                </div>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-section lp-alt" id="demo">
        <div className="lp-inner"><LiveDemo /></div>
      </section>

      <section className="lp-section lp-dark" id="syllabus">
        <div className="lp-inner">
          <div className="lp-head">
            <div className="lp-eyebrow ch-b">Your path</div>
            <h2 className="lp-h2">Four units. Four levels. One lab.</h2>
            <p className="lp-text">Each syllabus unit is a level of missions. Complete them to earn XP and unlock badges.</p>
          </div>
          <div className="lp-units">
            {UNITS.map((u, k) => {
              const pr = unitProgress(u, progress, { imageLoaded: !!meta })
              return (
                <a key={u.id} className={`lp-unit ch-${CH[k % 3]}`} href={`#${u.lab}`}>
                  <div className="row between">
                    <span className="lp-unit-num">Unit {u.num}</span>
                    <span className="lp-unit-count">{pr.done}/{pr.total}</span>
                  </div>
                  <h3>{u.title}</h3>
                  <p>{u.subtitle}</p>
                  <div className="lp-unit-bar" aria-label={`${pr.done} of ${pr.total} missions done`}><i style={{ width: `${pr.ratio * 100}%` }} /></div>
                </a>
              )
            })}
          </div>
          <div className="lp-badges">
            {earned.length ? earned.slice(0, 6).map((b) => (
              <span key={b.id} className="lp-chip lp-chip-dark">{MEDALS[b.id]} {b.name}</span>
            )) : ['🧪 Filter Master', '🔍 Edge Detective', '🔄 Convolution Expert', '💯 Perfect Quiz'].map((b) => (
              <span key={b} className="lp-chip lp-chip-dark">{b}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="features">
        <div className="lp-inner">
          <div className="lp-head">
            <div className="lp-eyebrow ch-r">Inside the lab</div>
            <h2 className="lp-h2">Built to make the theory visible</h2>
          </div>
          <div className="lp-features">
            {FEATURES.map(([ic, t, d], k) => (
              <div className={`lp-feature ch-${CH[k % 3]}`} key={t}>
                <span className="lp-ic"><Icon name={ic} size={20} /></span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-alt" id="arcade">
        <div className="lp-inner lp-split">
          <div>
            <div className="lp-eyebrow ch-g">The Arcade</div>
            <h2 className="lp-h2">Ten questions. Ten seconds each.</h2>
            <p className="lp-text">
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
            <a className="lp-btn lp-btn-primary lp-btn-lg" href="#quiz" style={{ marginTop: 28 }}><Icon name="gamepad" size={18} /> Open the Arcade</a>
          </div>
          <Teaser />
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-inner lp-cta-inner">
          <div>
            <span className="rgb-marks bar" aria-hidden="true"><i /><i /><i /></span>
            <h2>Ready to filter some pixels?</h2>
            <p>Everything runs offline in MATLAB on your computer.</p>
          </div>
          <div className="lp-cta-row">
            <a className="lp-btn lp-btn-primary lp-btn-lg" href={enter}>Enter the lab</a>
            <a className="lp-btn lp-btn-ghost-dark lp-btn-lg" href="#learn">Read the theory</a>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-inner lp-foot-inner">
          <span className="lp-brand"><Logo /><b>{SITE_NAME}</b><small>{SITE_TAGLINE}</small></span>
          <span>MATLAB {matlab.release || ''} · runs offline</span>
        </div>
      </footer>
    </div>
  )
}
