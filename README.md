# ImageLab — Interactive Image Processing Laboratory

**Assignment topic:** Image Enhancement using Different Spatial Domain Filters
**Subtitle:** An Interactive MATLAB-Based Image Processing and Learning Laboratory

ImageLab is a complete, offline laboratory for the Image Processing course (Units I–IV).
**All image processing is implemented in MATLAB** (`.m` files). Every major algorithm exists
twice: as the MATLAB Image Processing Toolbox call *and* as a hand-written manual
implementation (loops / matrix operations). A React web interface is used **only for
display and interaction**.

```
React UI ──JSON──▶ server/server.py ──MATLAB Engine API──▶ api/ilab_dispatch.m ──▶ algorithms/, noise/, histogram/ …
   ▲                                                                                        │
   └────────────────────────── PNG results (runtime/images) ◀──────────────────────────────┘
```

`server/server.py` contains **no image processing**. It forwards each request to MATLAB and
serves the PNG files that MATLAB writes.

## Features

| Area | What you can do |
|---|---|
| Dashboard | Image loaded, experiments completed, filters tested, quiz score, topics, XP, badges, demo flow |
| Learn | 20 theory topics following the syllabus, each linked to a lab |
| Image Workspace | Load / save, undo / redo, zoom, grayscale, image information, histogram |
| Pixels & Sampling | N4 / ND / N8 / m-adjacency, De / D4 / D8 distances, sampling, quantisation |
| Histogram Lab | Histogram, equalisation (toolbox + manual), CLAHE, stretching, gamma, log, negative, statistics |
| Spatial Filters | Mean, weighted mean, Gaussian, Laplacian, Sobel, Prewitt, median, min, max, midpoint, rank, alpha-trimmed — **toolbox vs manual, side by side** |
| Correlation & Convolution | Step-by-step kernel movement, products and sums, kernel flipping, verification against `filter2` / `conv2` |
| Kernel Playground | Editable 3×3 / 5×5 / 7×7 kernels, presets, live update, save kernels |
| Sharpening Lab | Laplacian, Sobel, Prewitt, unsharp masking, high-boost |
| Noise Lab | Gaussian, salt & pepper, speckle, Poisson; MSE / PSNR / SSIM |
| Filter Comparison | Several filters on the same noisy image; metrics table and MATLAB `bar` charts |
| Edge Detection | Roberts, Prewitt, Sobel, LoG, Canny; manual gradient images; edge count / density / time |
| Segmentation | Global (live slider), iterative, Otsu, adaptive, point & line detection, region growing, split & merge, region properties |
| Color Processing | RGB, HSV, YCbCr, L\*a\*b\* channels; per-channel enhancement |
| Experiments | 13 experiments with aim, theory, algorithm, MATLAB code (toolbox / manual), how-it-works, run, observation, conclusion, quiz |
| Quiz & games | Rapid Fire (10 s timer), Kernel Quiz, Guess the Filter, Build the Pipeline, Challenge Mode, Classroom Mode |
| Leaderboard | Stored in `quizzes/leaderboard.mat` (MATLAB table) |
| Reports | HTML report (print to PDF / open in Word), DOCX if MATLAB Report Generator is installed |

Frequency-domain filtering is intentionally **not** included (out of scope).

## Requirements

* MATLAB R2023b or newer (tested with **R2026a**)
* Image Processing Toolbox — *optional*. When it is missing, ImageLab automatically uses its
  own base-MATLAB implementations (the status bar shows which mode is active).
* Python 3.9–3.12 with the **MATLAB Engine API for Python** (`matlabengine`)
* Node.js 18+ (only to build the user interface once)

## Installation (once)

```bat
setup_imagelab.bat
```

This creates `.venv`, installs `matlabengine` (the version must match your MATLAB release —
see `server/requirements.txt`) and builds the UI into `frontend/dist`.

## Running

**Option A — from MATLAB (recommended for the demonstration)**

```matlab
cd 'E:\Project\Image Processing\ImageLab'
ImageLab
```

`ImageLab.m` adds the paths, shares the current MATLAB session and starts the bridge, which
connects back to it, so the processing happens in *your* MATLAB session. The browser opens at
http://localhost:8765.

**Option B — without opening MATLAB**

```bat
start_imagelab.bat
```

The bridge starts its own MATLAB engine in the background (10–60 s on first start).

**Pure MATLAB use** (no UI): every function can be called directly, e.g.

```matlab
ilab_setup
I = imread('peppers.png');
N = addSaltPepperNoise(I, 0.05);
J = medianFilterManual(N, 3);
psnr_value = calculatePSNR(J, I)
```

The Live Script `ImageLab_Demonstration.mlx` walks through the whole project in MATLAB.

## Tests

```matlab
run_tests                 % matlab.unittest suite (toolbox and manual paths)
addpath tests; smokeTestApi   % calls every UI operation once
```

## Project structure

```
ImageLab/
├── ImageLab.m                  start from MATLAB
├── ImageLab_Demonstration.mlx  Live Script for the professor (+ .m source)
├── ilab_setup.m  run_tests.m
├── core/          helpers: toDouble, toGray, padImage, filter2D, neighborhoodStack, hasIPT …
├── algorithms/    mean, median, Gaussian, min, max, midpoint, order statistic, correlation,
│                  convolution, Laplacian, Sobel, Prewitt, Roberts, Canny, LoG, unsharp, high-boost …
├── noise/         Gaussian, salt & pepper, speckle, Poisson
├── histogram/     imhist, equalisation, CLAHE, stretching, gamma, log, statistics
├── metrics/       MSE, PSNR, SSIM
├── segmentation/  thresholds, Otsu, adaptive, point/line detection, region growing, split & merge, labelling
├── color/         YCbCr, Lab, channels, enhancement
├── fundamentals/  sampling, quantisation, neighbourhoods, distances
├── quizzes/       questionBank, quizEngine, leaderboard, progress, pipeline problems
├── experiments/   experimentCatalog, runExperiment
├── reports/       generateReport (output in reports/output)
├── api/           ilab_dispatch (single entry point), image store, sample images, charts
├── tests/         ImageLabTests (matlab.unittest), smokeTestApi
├── sample_images/ peppers.png + generated teaching images
├── server/        server.py (bridge only, no processing)
├── frontend/      React user interface
└── docs/          documentation
```

## Documentation

* [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
* [docs/ALGORITHMS.md](docs/ALGORITHMS.md)
* [docs/EXPERIMENTS.md](docs/EXPERIMENTS.md)
* [docs/MATLAB_FUNCTION_REFERENCE.md](docs/MATLAB_FUNCTION_REFERENCE.md)
* [docs/QUIZ_SYSTEM.md](docs/QUIZ_SYSTEM.md)
* [docs/PROJECT_ARCHITECTURE.md](docs/PROJECT_ARCHITECTURE.md)
* [docs/PROJECT_REPORT_CONTENT.md](docs/PROJECT_REPORT_CONTENT.md)
