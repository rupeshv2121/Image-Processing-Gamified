import { useState } from 'react'
import { Card, CodeModal, Page } from '../components/ui'

const FOLDERS = {
  'algorithms/ — spatial filters, correlation, convolution, sharpening, edges': [
    ['meanFilter', 'Mean filter (fspecial + imfilter)'], ['meanFilterManual', 'Mean filter with nested loops'],
    ['weightedMeanFilter', 'Weighted (binomial) mean'], ['gaussianKernel', 'Manual Gaussian kernel'],
    ['gaussianFilter', 'Gaussian filter (toolbox)'], ['gaussianFilterManual', 'Gaussian filter with loops'],
    ['medianFilter', 'Median filter (medfilt2)'], ['medianFilterManual', 'Median filter: extract, sort, pick middle'],
    ['orderStatisticFilter', 'Rank filter (ordfilt2)'], ['orderStatisticFilterManual', 'Rank filter with loops'],
    ['minFilter', 'Min filter'], ['maxFilter', 'Max filter'], ['midpointFilter', 'Midpoint filter'], ['alphaTrimmedMeanFilter', 'Alpha-trimmed mean'],
    ['manualCorrelation', 'Correlation with every step recorded'], ['manualConvolution', 'Convolution = flipped kernel + correlation'],
    ['kernelPresets', 'Kernel library (Sobel, Prewitt, Laplacian …)'], ['laplacianKernel', 'Manual Laplacian kernel'],
    ['laplacianSharpen', 'Laplacian sharpening'], ['unsharpMask', 'Unsharp masking'], ['highBoostFilter', 'High-boost filtering'],
    ['gradientSharpen', 'Sobel / Prewitt sharpening'], ['sobelManual', 'Sobel gradient with loops'], ['prewittManual', 'Prewitt gradient with loops'],
    ['robertsManual', 'Roberts cross'], ['logKernel', 'Laplacian of Gaussian kernel'], ['cannyManual', 'Canny detector step by step'],
    ['logEdgeManual', 'LoG zero crossings'], ['edgeDetect', 'edge() wrapper with manual fallback'],
  ],
  'noise/ — degradation models': [
    ['addGaussianNoise', 'Gaussian noise'], ['addSaltPepperNoise', 'Salt & pepper noise'], ['addSpeckleNoise', 'Speckle noise'], ['addPoissonNoise', 'Poisson noise'], ['addNoise', 'Dispatcher'],
  ],
  'histogram/ — histogram processing and point transforms': [
    ['imhistManual', 'Histogram'], ['histogramEqualizationManual', 'Equalisation from the CDF'], ['histogramEqualization', 'histeq wrapper'],
    ['claheManual', 'CLAHE from scratch'], ['clahe', 'adapthisteq wrapper'], ['contrastStretch', 'Contrast stretching'],
    ['gammaCorrection', 'Gamma'], ['logTransform', 'Log transform'], ['negativeTransform', 'Negative'], ['imageStatistics', 'Mean, variance, std, entropy'],
  ],
  'metrics/ — image quality': [['calculateMSE', 'MSE'], ['calculatePSNR', 'PSNR'], ['calculateSSIM', 'SSIM (Wang et al.)'], ['imageQuality', 'All three']],
  'segmentation/': [
    ['globalThreshold', 'Global threshold'], ['iterativeThreshold', 'Basic global thresholding'], ['otsuThreshold', "Otsu's method"],
    ['adaptiveThreshold', 'Local-mean threshold'], ['pointDetection', 'Point detection'], ['lineDetection', 'Line detection'],
    ['regionGrowing', 'Region growing (BFS)'], ['splitAndMerge', 'Quadtree split & merge'], ['labelComponents', 'Connected components (bwlabel)'],
    ['regionProperties', 'regionprops equivalent'], ['extractBoundary', 'Boundary extraction'],
  ],
  'color/ and fundamentals/': [
    ['colorChannels', 'Channel separation'], ['colorEnhance', 'Channel enhancement'], ['rgbToYCbCr', 'RGB → YCbCr'], ['rgbToLab', 'RGB → L*a*b*'],
    ['quantizeImage', 'Quantisation'], ['sampleImage', 'Sampling'], ['pixelNeighborhood', 'N4 / ND / N8 / m-adjacency'], ['pixelDistances', 'De, D4, D8'],
  ],
  'core/ — shared helpers': [
    ['hasIPT', 'Toolbox detection'], ['toDouble', 'im2double equivalent'], ['toGray', 'rgb2gray equivalent'], ['padImage', 'padarray equivalent'],
    ['neighborhoodStack', 'Vectorised neighbourhoods'], ['filter2D', 'Fast correlation (imfilter / conv2)'], ['manualFilterLoop', 'Generic loop filter'],
  ],
  'quizzes/, experiments/, reports/, api/': [
    ['questionBank', 'All quiz questions'], ['quizEngine', 'Selection and scoring'], ['leaderboardManager', 'leaderboard.mat'],
    ['progressManager', 'XP, badges, userProgress.mat'], ['pipelineProblems', 'Pipeline game problems'], ['experimentCatalog', '13 experiments'],
    ['runExperiment', 'Runs an experiment'], ['generateReport', 'HTML/DOCX report'], ['ilab_dispatch', 'Single entry point for the UI'],
  ],
}

export default function Documentation() {
  const [open, setOpen] = useState(null)
  return (
    <Page eyebrow="Help" title="Documentation" subtitle="How ImageLab is built and a browser for every MATLAB function in the project.">
      <div className="grid-2">
        <Card title="Architecture">
          <div className="prose small">
            <p><b>MATLAB is the image-processing engine.</b> Every algorithm is a MATLAB function (.m file). The browser only displays results.</p>
            <div className="formula" style={{ fontSize: 13 }}>{'React UI  ──JSON──▶  server/server.py  ──MATLAB Engine──▶  api/ilab_dispatch.m\n                                                         │\n            PNG images ◀── runtime/images ◀──────────────┘  algorithms/, noise/, histogram/ …'}</div>
            <p>server.py contains no image processing: it starts MATLAB, forwards each request to <code>ilab_dispatch.m</code>, and serves the PNG files MATLAB writes.</p>
            <p>Each algorithm has a <b>toolbox</b> version (imfilter, medfilt2, histeq, edge …) and a <b>manual</b> version written with loops / matrix operations. Without the Image Processing Toolbox, ImageLab automatically uses the manual base-MATLAB code.</p>
          </div>
        </Card>
        <Card title="User guide (short)">
          <ol className="prose small">
            <li>Start with <code>start_imagelab.bat</code> (or <code>python server/server.py</code>). MATLAB starts in the background (~10 s).</li>
            <li>Load an image in the <a href="#workspace">Workspace</a> (sample or your own file).</li>
            <li>Open any lab. Results can be sent back to the workspace with <b>➜ Workspace</b>, then undone/redone.</li>
            <li>Use <b>{'</>'} View MATLAB Code</b> buttons to show the real implementation.</li>
            <li>Run the <a href="#experiments">Experiments</a> and generate <a href="#reports">Reports</a>.</li>
            <li>Play the <a href="#quiz">quizzes and games</a>; scores go to the <a href="#leaderboard">Leaderboard</a>.</li>
          </ol>
          <p className="small muted">Full documents in the docs/ folder: README, USER_GUIDE, ALGORITHMS, EXPERIMENTS, MATLAB_FUNCTION_REFERENCE, QUIZ_SYSTEM, PROJECT_ARCHITECTURE, PROJECT_REPORT_CONTENT.</p>
        </Card>
      </div>
      <h2 style={{ margin: '20px 0 10px', fontSize: 18 }}>MATLAB function reference — click to view the source</h2>
      <div className="grid-2">
        {Object.entries(FOLDERS).map(([folder, fns]) => (
          <Card key={folder} title={folder}>
            <table className="data"><tbody>
              {fns.map(([fn, desc]) => (
                <tr key={fn}><td><button className="btn btn-small btn-code" onClick={() => setOpen(fn)}>{fn}.m</button></td><td className="small">{desc}</td></tr>
              ))}
            </tbody></table>
          </Card>
        ))}
      </div>
      {open && <CodeModal functions={[open]} onClose={() => setOpen(null)} />}
    </Page>
  )
}
