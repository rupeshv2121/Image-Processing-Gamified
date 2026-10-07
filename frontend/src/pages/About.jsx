import { useApp } from '../AppContext'
import { Card, Page } from '../components/ui'

export default function About() {
  const { matlab } = useApp()
  return (
    <Page eyebrow="About" title="About ImageLab" subtitle="Interactive Image Processing Laboratory">
      <div className="grid-2">
        <Card title="Project">
          <div className="prose">
            <p><b>Title:</b> ImageLab — Interactive Image Processing Laboratory</p>
            <p><b>Topic:</b> Image Enhancement using Different Spatial Domain Filters</p>
            <p><b>Subtitle:</b> An Interactive MATLAB-Based Image Processing and Learning Laboratory</p>
            <p>ImageLab covers the four syllabus units — fundamentals, image enhancement, degradation/restoration/colour, and segmentation/representation — with hands-on labs, 13 experiments, a quiz system and report generation.</p>
            <p><b>Scope:</b> spatial-domain processing only. Frequency-domain filtering (FFT, ideal / Butterworth / Gaussian low- and high-pass filters) is intentionally not included.</p>
          </div>
        </Card>
        <Card title="Technology">
          <ul className="prose">
            <li><b>MATLAB {matlab.release || ''}</b> — all image processing (algorithms/, noise/, histogram/, metrics/, segmentation/, color/ …)</li>
            <li><b>Image Processing Toolbox</b> — used when installed ({matlab.ipt ? 'installed' : 'not installed: manual implementations are used'})</li>
            <li><b>matlab.unittest</b> — unit tests (tests/ImageLabTests.m)</li>
            <li><b>MATLAB Engine API for Python</b> — thin bridge (server/server.py), no processing</li>
            <li><b>React</b> — user interface only</li>
            <li>Fully offline: no internet, cloud or external API.</li>
          </ul>
        </Card>
      </div>
    </Page>
  )
}
