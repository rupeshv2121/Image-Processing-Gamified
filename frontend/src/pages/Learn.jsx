import { useState } from 'react'
import { useApp } from '../AppContext'
import { asArray } from '../api'
import { Card, Note, Page } from '../components/ui'
import { TOPICS, UNITS } from '../content/topics'

const LAB_NAMES = {
  workspace: 'Image Workspace', histogram: 'Histogram Lab', color: 'Color Processing', fundamentals: 'Pixels & Sampling',
  docs: 'Documentation', kernel: 'Kernel Playground', correlation: 'Correlation & Convolution', filters: 'Spatial Filters',
  sharpening: 'Sharpening Lab', noise: 'Noise Lab', compare: 'Filter Comparison', edges: 'Edge Detection', segmentation: 'Segmentation',
}

const UNIT_TITLES = {
  'Unit I': 'Fundamentals of Image Processing',
  'Unit II': 'Image Enhancement',
  'Unit III': 'Degradation, Restoration & Colour',
  'Unit IV': 'Segmentation & Representation',
}

export default function Learn() {
  const { progress, call, refreshProgress, notify } = useApp()
  const [active, setActive] = useState(TOPICS[0].id)
  const done = asArray(progress?.topicsCompleted)
  const topic = TOPICS.find((t) => t.id === active)
  const idx = TOPICS.indexOf(topic)
  const labName = LAB_NAMES[topic.lab]

  const complete = async () => {
    const p = await call('progress', { action: 'topic', value: topic.title }, { label: 'Saving progress' })
    if (p) {
      await refreshProgress()
      notify(asArray(p.newBadges).length ? `Badge earned: ${asArray(p.newBadges).join(', ')}` : '+20 XP — topic completed')
    }
  }

  return (
    <Page eyebrow="Study" title="Learn" subtitle={`Theory notes following the syllabus · ${done.length} of ${TOPICS.length} topics completed`}>
      <div className="lab">
        <Card>
          <div className="topic-list">
            {UNITS.map((u) => (
              <div key={u}>
                <div className="unit-label">{u} · {UNIT_TITLES[u]}</div>
                {TOPICS.filter((t) => t.unit === u).map((t) => (
                  <button key={t.id} className={`topic-item ${t.id === active ? 'active' : ''}`} onClick={() => setActive(t.id)}>
                    <span className={`done ${done.includes(t.title) ? 'yes' : ''}`}>✓</span> {t.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Card>
        <Card title={topic.title} extra={<span className="badge badge-navy">{topic.unit}</span>}>
          <p className="muted">{topic.summary}</p>
          <div className="prose reading" style={{ marginTop: 16 }}>
            {topic.body.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {topic.formula && <div className="formula">{topic.formula}</div>}
          <div className="row" style={{ marginTop: 16 }}>
            <a className="btn btn-navy" href={`#${topic.lab}`}>Try it: {labName} →</a>
            <a className="btn" href="#quiz">Quiz on {topic.category}</a>
            <span className="spacer" />
            {done.includes(topic.title)
              ? <span className="badge">Completed</span>
              : <button className="btn btn-primary" onClick={complete}>Mark as completed (+20 XP)</button>}
          </div>
          <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
            <button className="btn btn-small" disabled={idx === 0} onClick={() => setActive(TOPICS[idx - 1].id)}>← Previous</button>
            <button className="btn btn-small" disabled={idx === TOPICS.length - 1} onClick={() => setActive(TOPICS[idx + 1].id)}>Next →</button>
          </div>
          {topic.unit === 'Unit II' && (
            <Note>Frequency-domain filtering (FFT, ideal/Butterworth/Gaussian low- and high-pass) is outside the scope of this project — ImageLab focuses on spatial-domain processing.</Note>
          )}
        </Card>
      </div>
    </Page>
  )
}
