import { useState } from 'react'
import { useApp } from '../AppContext'
import { fmt, fmtPsnr, toMatrix } from '../api'
import LabPage from '../components/LabPage'
import { Card, ImageView, KernelGrid, Metrics, Note, Segmented, Slider, Tabs, UseButton } from '../components/ui'

export const FILTERS = {
  mean: { group: 'linear', label: 'Mean', fn: ['meanFilter', 'meanFilterManual'], text: 'Every output pixel is the average of its k×k neighbourhood. Linear smoothing: reduces Gaussian noise, blurs edges, smears impulses.', code: "h = fspecial('average', [k k]);\nJ = imfilter(I, h, 'replicate');" },
  weighted: { group: 'linear', label: 'Weighted mean', fn: ['weightedMeanFilter', 'weightedMeanKernel', 'manualFilterLoop'], text: 'Binomial weights (1 2 1 / 2 4 2 / 1 2 1)/16 — the centre counts most, so it blurs less than the box filter.', code: "h = [1 2 1; 2 4 2; 1 2 1] / 16;\nJ = imfilter(I, h, 'replicate');" },
  gaussian: { group: 'linear', label: 'Gaussian', fn: ['gaussianFilter', 'gaussianKernel', 'gaussianFilterManual'], text: 'Bell-shaped weights exp(−(x²+y²)/2σ²). σ controls the amount of smoothing; size ≈ 6σ.', code: "h = fspecial('gaussian', k, sigma);\nJ = imfilter(I, h, 'replicate');" },
  laplacian: { group: 'linear', label: 'Laplacian', fn: ['filter2D', 'manualFilterLoop', 'laplacianKernel'], text: 'Second derivative. Zero in flat regions, strong positive/negative response at edges. Shown rescaled: grey = 0.', code: "h = fspecial('laplacian', 0);\nL = imfilter(I, h, 'replicate');\nimshow(L, [])" },
  sobel: { group: 'linear', label: 'Sobel', fn: ['sobelManual', 'gradientOperatorManual'], text: 'First-derivative edge operator: gradient magnitude √(gx² + gy²) with 1-2-1 weights (built-in smoothing).', code: "gx = imfilter(G, fspecial('sobel')');\ngy = imfilter(G, fspecial('sobel'));\nmag = hypot(gx, gy);" },
  prewitt: { group: 'linear', label: 'Prewitt', fn: ['prewittManual', 'gradientOperatorManual'], text: 'Like Sobel but with equal weights 1-1-1: slightly more sensitive to noise.', code: "gx = imfilter(G, fspecial('prewitt')');\ngy = imfilter(G, fspecial('prewitt'));\nmag = hypot(gx, gy);" },
  median: { group: 'nonlinear', label: 'Median', fn: ['medianFilter', 'medianFilterManual'], text: 'Sorts the neighbourhood and takes the middle value. Impulses (0/255) end up at the ends of the sorted list and are ignored — ideal for salt & pepper noise, and edges stay sharp.', code: 'J = medfilt2(I, [k k]);' },
  min: { group: 'nonlinear', label: 'Min', fn: ['minFilter', 'orderStatisticFilter', 'orderStatisticFilterManual'], text: 'Rank 1 of the sorted window: the darkest neighbour. Removes salt (white) noise, darkens/erodes bright objects.', code: 'J = ordfilt2(I, 1, true(k));' },
  max: { group: 'nonlinear', label: 'Max', fn: ['maxFilter', 'orderStatisticFilter', 'orderStatisticFilterManual'], text: 'Rank N: the brightest neighbour. Removes pepper (black) noise, brightens/dilates bright objects.', code: 'J = ordfilt2(I, k*k, true(k));' },
  midpoint: { group: 'nonlinear', label: 'Midpoint', fn: ['midpointFilter'], text: '(min + max) / 2 — combines order statistics with averaging. Good for Gaussian/uniform noise, bad for impulses.', code: 'J = (ordfilt2(I,1,true(k)) + ordfilt2(I,k*k,true(k))) / 2;' },
  order: { group: 'nonlinear', label: 'Rank', fn: ['orderStatisticFilter', 'orderStatisticFilterManual'], text: 'General rank filter: sort the window and pick any position. Rank 1 = min, ⌈N/2⌉ = median, N = max.', code: 'J = ordfilt2(I, rank, true(k));' },
  alphatrimmed: { group: 'nonlinear', label: 'Alpha-trimmed', fn: ['alphaTrimmedMeanFilter'], text: 'Drops the d/2 lowest and highest values, averages the rest. Between mean (d = 0) and median (d = N−1): good for mixed noise.', code: "S = sort(window(:));\nJ(i,j) = mean(S(d/2+1 : end-d/2));" },
}

export default function SpatialFilters() {
  const { current, original, call, currentLabel } = useApp()
  const [group, setGroup] = useState('linear')
  const [name, setName] = useState('mean')
  const [k, setK] = useState(3)
  const [sigma, setSigma] = useState(1)
  const [rank, setRank] = useState(5)
  const [d, setD] = useState(2)
  const [impl, setImpl] = useState('toolbox')
  const [res, setRes] = useState(null)
  const [tab, setTab] = useState('result')
  const f = FILTERS[name]
  const N = k * k
  const fixed3 = ['laplacian', 'sobel', 'prewitt'].includes(name)
  const kk = fixed3 ? 3 : k

  const chooseGroup = (g) => {
    setGroup(g)
    setName(g === 'linear' ? 'mean' : 'median')
  }
  const apply = async () => {
    const params = { id: current, name, k: kk, sigma, rank: Math.min(rank, kk * kk), d, impl, refId: original !== current ? original : '' }
    const r = await call('filter', params, { label: `${f.label} filter (${impl})` })
    if (r) {
      setRes({ ...r, name, k: kk, input: current, inputLabel: currentLabel })
      setTab(r.runs.length > 1 ? 'compare' : 'result')
    }
  }

  const rankName = rank === 1 ? 'minimum' : rank === N ? 'maximum' : rank === Math.ceil(N / 2) ? 'median' : `rank ${rank}`
  const runs = res?.runs || []
  const kernel = res ? toMatrix(res.kernel) : null

  const theory = (
    <>
      <p><b>Linear filters</b> compute a weighted sum of the neighbourhood (a correlation with a kernel). They obey superposition and are ideal for zero-mean Gaussian noise.</p>
      <div className="formula">g(x,y) = Σ_s Σ_t w(s,t) · f(x+s, y+t)</div>
      <p><b>Non-linear (order-statistic) filters</b> sort the neighbourhood and pick a value by rank — the median removes impulse noise because the extremes are never selected.</p>
      <div className="formula">median: sort(window(:)) → element ⌈N/2⌉</div>
      <h4>{f.label}</h4>
      <p>{f.text}</p>
      <p className="small">The <b>manual</b> implementation visits every pixel with two for-loops; the <b>toolbox</b> version uses compiled MATLAB functions. Use “Compare both” to prove they give identical results.</p>
    </>
  )

  const controls = (
    <>
      <Segmented value={group} onChange={chooseGroup} options={[{ value: 'linear', label: 'Linear' }, { value: 'nonlinear', label: 'Non-linear' }]} />
      <div className="choice-list">
        {Object.entries(FILTERS).filter(([, v]) => v.group === group).map(([key, v]) => (
          <button key={key} className={`choice ${name === key ? 'active' : ''}`} onClick={() => setName(key)}>{v.label}</button>
        ))}
      </div>
      {!fixed3 && <Slider label="Kernel size" value={k} min={3} max={15} step={2} format={(v) => `${v}×${v}`} onChange={(v) => { setK(v); setRank(Math.ceil((v * v) / 2)) }} />}
      {name === 'gaussian' && <Slider label="Sigma σ" value={sigma} min={0.3} max={5} step={0.1} onChange={setSigma} />}
      {name === 'order' && (
        <>
          <Slider label={`Rank (${rankName})`} value={Math.min(rank, N)} min={1} max={N} onChange={setRank} format={(v) => `${v} / ${N}`} />
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-small" onClick={() => setRank(1)}>Min</button>
            <button className="btn btn-small" onClick={() => setRank(Math.ceil(N / 2))}>Median</button>
            <button className="btn btn-small" onClick={() => setRank(N)}>Max</button>
          </div>
        </>
      )}
      {name === 'alphatrimmed' && <Slider label="Trim d" value={d} min={0} max={N - 1 - ((N - 1) % 2)} step={2} onChange={setD} />}
      <div className="divider" />
      <span className="field-label">Implementation</span>
      <Segmented value={impl} onChange={setImpl} options={[{ value: 'toolbox', label: 'Toolbox' }, { value: 'manual', label: 'Manual' }, { value: 'both', label: 'Both' }]} />
      <button className="btn btn-primary btn-block" onClick={apply}>Apply {f.label}</button>
      {impl !== 'toolbox' && <p className="tiny faint">Manual loops take a few seconds on a colour image.</p>}
    </>
  )

  return (
    <LabPage unit="Unit II · Enhancement" title="Spatial Filters" subtitle="Smooth an image with linear and non-linear filters, using the MATLAB toolbox or a hand-written loop."
      theory={theory} controls={controls} panelTitle="Filter"
      code={{ functions: f.fn, snippets: [{ title: 'Toolbox call', code: f.code }] }}>
      {!res ? (
        <div className="grid-2">
          <ImageView id={current} title={`Input · ${currentLabel}`} height={420} />
          <ImageView id={null} title="Output" height={420} emptyText="Pick a filter and press Apply" />
        </div>
      ) : (
        <>
          <Tabs tabs={[{ key: 'result', label: 'Result' }, ...(runs[1] ? [{ key: 'compare', label: 'Toolbox vs manual' }] : []), { key: 'details', label: 'Kernel & metrics' }]} active={tab} onChange={setTab} />
          {tab === 'result' && (
            <div className="grid-2">
              <ImageView id={res.input} title={`Input · ${res.inputLabel}`} height={420} />
              <ImageView id={runs[0].id} title={`${FILTERS[res.name].label} ${res.k}×${res.k}`} height={420}
                badge={runs[0].psnr != null ? fmtPsnr(runs[0].psnr) : null}
                actions={<UseButton id={runs[0].id} label={`${FILTERS[res.name].label} ${res.k}×${res.k}`} />} />
            </div>
          )}
          {tab === 'compare' && runs[1] && (
            <div className="stack">
              <div className="grid-2">
                <ImageView id={runs[0].id} title="MATLAB toolbox / vectorised" height={360} caption={`${runs[0].functionName}.m · ${fmt(runs[0].timeMs, 1)} ms`} />
                <ImageView id={runs[1].id} title="Manual loops" height={360} caption={`${runs[1].functionName}.m · ${fmt(runs[1].timeMs, 1)} ms`} />
              </div>
              <Note kind={res.maxDifference < 1e-6 ? 'ok' : 'warn'}>
                {res.maxDifference < 1e-6
                  ? <>Identical results (max difference {fmt(res.maxDifference)}). The manual version is {fmt(runs[1].timeMs / Math.max(runs[0].timeMs, 0.01), 0)}× slower because every pixel is processed in an interpreted loop.</>
                  : <>The results differ slightly (max {fmt(res.maxDifference)}) because of border handling.</>}
              </Note>
            </div>
          )}
          {tab === 'details' && (
            <div className="grid-2">
              <Card title={res.linear ? 'Kernel' : 'No kernel (non-linear)'}>
                {kernel && kernel.length <= 9
                  ? <KernelGrid matrix={kernel} small={kernel.length > 5} />
                  : <p className="muted small">{res.linear ? 'Kernel too large to display.' : 'The output is chosen by sorting the neighbourhood, not by a weighted sum.'}</p>}
              </Card>
              <Card title="Measurements">
                <Metrics items={[
                  { label: 'Time', value: `${fmt(runs[0].timeMs, 1)} ms` },
                  runs[0].mse != null ? { label: 'PSNR vs original', value: fmtPsnr(runs[0].psnr) } : null,
                  runs[0].ssim != null ? { label: 'SSIM vs original', value: runs[0].ssim } : null,
                ]} />
                <p className="small muted mt-sm">{runs[0].implementation}</p>
                {runs[0].mse == null && <p className="small faint mt-sm">Add noise first (Noise Lab → Workspace) to measure PSNR against the clean original.</p>}
              </Card>
            </div>
          )}
        </>
      )}
    </LabPage>
  )
}
