import { useState } from 'react'
import { useApp } from '../AppContext'
import { asArray, fmt, fmtPsnr } from '../api'
import LabPage from '../components/LabPage'
import { BarChart, Card, ImageView, Note, Segmented, Slider, Tabs, UseButton } from '../components/ui'

const ALL = [
  { name: 'mean', label: 'Mean', k: 3 },
  { name: 'median', label: 'Median', k: 3 },
  { name: 'gaussian', label: 'Gaussian', k: 5, sigma: 1 },
  { name: 'min', label: 'Min', k: 3 },
  { name: 'max', label: 'Max', k: 3 },
  { name: 'midpoint', label: 'Midpoint', k: 3 },
  { name: 'weighted', label: 'Weighted mean', k: 3 },
  { name: 'alphatrimmed', label: 'Alpha-trimmed', k: 3, d: 4 },
]

export default function FilterComparison() {
  const { original, call } = useApp()
  const [noise, setNoise] = useState('saltpepper')
  const [density, setDensity] = useState(0.05)
  const [variance, setVariance] = useState(0.01)
  const [chosen, setChosen] = useState({ mean: true, median: true, gaussian: true, min: true })
  const [size, setSize] = useState(3)
  const [res, setRes] = useState(null)
  const [tab, setTab] = useState('ranking')

  const run = async () => {
    const filters = ALL.filter((f) => chosen[f.name]).map((f) => ({ name: f.name, k: f.name === 'gaussian' ? Math.max(size, 5) : size, sigma: f.sigma ?? 1, d: f.d ?? 2 }))
    if (!filters.length) return
    const d = await call('compare', { id: original, noiseType: noise, density, variance, filters, seed: 7 }, { label: `Comparing ${filters.length} filters` })
    if (d) {
      setRes(d)
      setTab('ranking')
    }
  }
  const results = asArray(res?.results)
  const ranked = results.slice().sort((a, b) => (b.psnr ?? 1e9) - (a.psnr ?? 1e9))
  const best = results.find((r) => r.label === res?.best)

  const theory = (
    <>
      <p>All filters start from the same noisy copy of the <b>original</b> image (fixed random seed), so the comparison is fair and reproducible.</p>
      <div className="formula">MSE = mean((g − f)²)     PSNR = 10·log₁₀(1 / MSE)</div>
      <p className="small"><b>SSIM</b> compares local luminance, contrast and structure (1 = identical). It agrees better with human judgement than MSE.</p>
      <p className="small"><b>Expect:</b> non-linear order-statistic filters (median) win on impulse noise; linear averaging filters (mean, Gaussian) win on Gaussian noise.</p>
    </>
  )

  const controls = (
    <>
      <span className="field-label">Noise added to the original</span>
      <Segmented value={noise} onChange={setNoise} options={[{ value: 'saltpepper', label: 'S & P' }, { value: 'gaussian', label: 'Gaussian' }, { value: 'speckle', label: 'Speckle' }, { value: 'poisson', label: 'Poisson' }]} />
      {noise === 'saltpepper' && <Slider label="Density" value={density} min={0.01} max={0.4} step={0.01} onChange={setDensity} />}
      {(noise === 'gaussian' || noise === 'speckle') && <Slider label="Variance" value={variance} min={0.001} max={0.1} step={0.001} onChange={setVariance} />}
      <div className="divider" />
      <span className="field-label">Filters to compare</span>
      <div className="row" style={{ gap: 6 }}>
        {ALL.map((f) => (
          <button key={f.name} className={`btn btn-small ${chosen[f.name] ? 'btn-navy' : ''}`} onClick={() => setChosen((c) => ({ ...c, [f.name]: !c[f.name] }))}>{f.label}</button>
        ))}
      </div>
      <Slider label="Window size" value={size} min={3} max={9} step={2} onChange={setSize} format={(v) => `${v}×${v}`} />
      <button className="btn btn-primary btn-block" onClick={run}>Compare</button>
    </>
  )

  return (
    <LabPage unit="Unit II · Enhancement" title="Filter Comparison" subtitle="Run several filters on the same noisy image and let the numbers decide."
      theory={theory} controls={controls} panelTitle="Setup"
      code={{ functions: ['ilab_runFilter', 'imageQuality', 'ilab_barChart'], snippets: [{ title: 'MATLAB', code: "N = imnoise(I, 'salt & pepper', 0.05);\nJ1 = imfilter(N, fspecial('average', 3));\nJ2 = medfilt2(N, [3 3]);\nJ3 = imfilter(N, fspecial('gaussian', 5, 1));\npsnrValues = [psnr(J1,I) psnr(J2,I) psnr(J3,I)];\nbar(psnrValues)" }] }}>
      {!res ? (
        <div className="grid-2">
          <ImageView id={original} title="Original" height={400} />
          <ImageView id={null} title="Winner" height={400} emptyText="Choose noise and filters, then Compare" />
        </div>
      ) : (
        <>
          <Tabs tabs={[{ key: 'ranking', label: 'Ranking' }, { key: 'images', label: 'All images' }, { key: 'charts', label: 'MATLAB charts' }]} active={tab} onChange={setTab} />
          {tab === 'ranking' && (
            <div className="stack">
              <div className="grid-2">
                <ImageView id={res.noisyId} title="Noisy input" height={340} badge={fmtPsnr(res.noisy.psnr)} />
                <ImageView id={best?.id} title={`🏆 Winner · ${res.best}`} height={340} badge={fmtPsnr(best?.psnr)} actions={best && <UseButton id={best.id} label={`${best.label} (comparison)`} />} />
              </div>
              <Card>
                <table className="data">
                  <thead><tr><th>Rank</th><th>Filter</th><th>Type</th><th>PSNR</th><th>SSIM</th><th>MSE</th><th>Time</th></tr></thead>
                  <tbody>
                    {ranked.map((r, i) => (
                      <tr key={r.id} className={i === 0 ? 'best' : ''}>
                        <td>{i + 1}</td><td>{r.label}</td><td>{r.linear ? 'Linear' : 'Non-linear'}</td><td>{fmtPsnr(r.psnr)}</td><td>{fmt(r.ssim, 3)}</td><td>{fmt(r.mse, 5)}</td><td>{fmt(r.timeMs, 1)} ms</td>
                      </tr>
                    ))}
                    <tr><td>—</td><td className="muted">No filter (noisy)</td><td /><td>{fmtPsnr(res.noisy.psnr)}</td><td>{fmt(res.noisy.ssim, 3)}</td><td>{fmt(res.noisy.mse, 5)}</td><td /></tr>
                  </tbody>
                </table>
              </Card>
              <Note kind="ok">
                {best && !best.linear
                  ? 'A non-linear filter wins: impulse noise consists of extreme values that sorting simply discards, while averaging spreads them.'
                  : 'A linear filter wins: zero-mean noise cancels out when neighbouring pixels are averaged.'}
              </Note>
            </div>
          )}
          {tab === 'images' && (
            <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              <ImageView id={res.cleanId} title="Original" height={250} />
              <ImageView id={res.noisyId} title="Noisy" height={250} badge={fmtPsnr(res.noisy.psnr)} />
              {results.map((r) => <ImageView key={r.id} id={r.id} title={r.label} height={250} badge={fmtPsnr(r.psnr)} />)}
            </div>
          )}
          {tab === 'charts' && (
            <div className="stack">
              <div className="grid-2">
                <Card><BarChart title="PSNR (dB)" values={results.map((r) => r.psnr)} labels={results.map((r) => r.label)} /></Card>
                <Card><BarChart title="SSIM" values={results.map((r) => r.ssim)} labels={results.map((r) => r.label)} /></Card>
              </div>
              <Card title="Drawn by MATLAB — bar(psnrValues)">
                <div className="grid-3">
                  <ImageView id={res.charts.psnr} height={220} />
                  <ImageView id={res.charts.ssim} height={220} />
                  <ImageView id={res.charts.time} height={220} />
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </LabPage>
  )
}
