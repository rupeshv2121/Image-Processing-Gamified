# ImageLab — Interactive Image Processing Laboratory

**Assignment topic:** Image Enhancement using Different Spatial Domain Filters
**Subtitle:** An Interactive MATLAB-Based Image Processing and Learning Laboratory

ImageLab is an offline laboratory for an Image Processing course (Units I–IV). You load an image,
apply spatial-domain operations (noise, filtering, histogram processing, sharpening, edge detection,
segmentation, colour processing) and compare the results visually and numerically (MSE, PSNR, SSIM,
execution time). Built-in experiments, quizzes and games reinforce the theory.

**All image processing is written in MATLAB.** Most algorithms exist in two forms: the
Image Processing Toolbox call and a hand-written manual implementation (loops / matrix operations), so
results can be compared side by side. The React web interface is used **only for display and
interaction**, and the Python server is only a bridge between the two.

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [How an uploaded image is processed](#how-an-uploaded-image-is-processed)
- [Requirements](#requirements)
- [Installation](#installation)
- [Running](#running)
- [Using the MATLAB functions directly](#using-the-matlab-functions-directly)
- [Configuration](#configuration)
- [Limits and supported formats](#limits-and-supported-formats)
- [HTTP API](#http-api)
- [Development](#development)
- [Tests](#tests)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

---

## Features

| Area | What you can do |
|---|---|
| Dashboard | Current image, experiments completed, filters tested, quiz score, topics, XP, badges, demo flow |
| Learn | 20 theory topics following the syllabus, each linked to a lab |
| Image Workspace | Load / save, undo / redo, zoom, grayscale, image information, histogram |
| Pixels & Sampling | N4 / ND / N8 / m-adjacency, De / D4 / D8 distances, sampling, quantisation |
| Histogram Lab | Histogram, equalisation (toolbox + manual), CLAHE, stretching, gamma, log, negative, statistics |
| Spatial Filters | Mean, weighted mean, Gaussian, Laplacian, Sobel, Prewitt, median, min, max, midpoint, rank, alpha-trimmed — **toolbox vs manual, side by side** |
| Correlation & Convolution | Step-by-step kernel movement, products and sums, kernel flipping, verification against `filter2` / `conv2` |
| Kernel Playground | Editable 3×3 / 5×5 / 7×7 kernels, presets, live update, saved kernels |
| Sharpening Lab | Laplacian, Sobel, Prewitt, unsharp masking, high-boost |
| Noise Lab | Gaussian, salt & pepper, speckle, Poisson; MSE / PSNR / SSIM |
| Filter Comparison | Several filters on the same noisy image; metrics table and MATLAB `bar` charts |
| Edge Detection | Roberts, Prewitt, Sobel, LoG, Canny; manual gradient images; edge count / density / time |
| Segmentation | Global (live slider), iterative, Otsu, adaptive, point & line detection, region growing, split & merge, region properties |
| Color Processing | RGB, HSV, YCbCr, L\*a\*b\* channels; per-channel enhancement |
| Experiments | 13 experiments with aim, theory, algorithm, MATLAB code (toolbox / manual), run, observation, conclusion, quiz |
| Quiz & games | Rapid Fire (10 s timer), Kernel Quiz, Guess the Filter, Build the Pipeline, Challenge Mode, Classroom Mode |
| Leaderboard | Stored in `quizzes/leaderboard.mat` (MATLAB table) |
| Reports | HTML report (print to PDF / open in Word), DOCX if MATLAB Report Generator is installed |

Frequency-domain filtering is intentionally **not** included (out of scope).

---

## Architecture

```
┌──────────────────────┐  POST /api/run {op, params}  ┌───────────────────┐  MATLAB Engine API  ┌──────────────────────────┐
│  React UI (browser)  │ ───────────────────────────▶ │ server/server.py  │ ──────────────────▶ │ api/ilab_dispatch.m       │
│  frontend/src        │ ◀─────────────────────────── │ (bridge only)     │ ◀────────────────── │  routes to algorithms/,   │
│                      │  JSON {ok, data}             │                   │  JSON string        │  noise/, histogram/ …     │
│ <img src=/api/image> │ ◀── PNG files ────────────── │ serves runtime/   │ ◀── imwrite ─────── │  ilab_store('save', I)    │
└──────────────────────┘                              └───────────────────┘                     └──────────────────────────┘
```

| Layer | Folder | Responsibility |
|---|---|---|
| Algorithms | `algorithms/ noise/ histogram/ metrics/ segmentation/ color/ fundamentals/` | Pure MATLAB functions: image in, image out. Usable from the command line, tests and the Live Script. |
| Core helpers | `core/` | Type conversion, padding, neighbourhood stacks, fast / loop filtering, toolbox detection (`hasIPT`). |
| Learning content | `quizzes/ experiments/ reports/` | Question bank, scoring, leaderboard, progress, experiment catalogue and runner, report generator. |
| API | `api/` | `ilab_dispatch.m` decodes a JSON request, calls the algorithms, stores result images (`ilab_store.m`) and returns JSON. |
| Bridge | `server/server.py` | Python standard-library HTTP server + `matlab.engine`. Starts or connects to MATLAB, forwards requests, serves PNGs, reports and the built UI. **No image processing.** |
| UI | `frontend/` | React 18 + Vite. One page per lab; no pixel processing in JavaScript. |

### Toolbox vs manual

`core/hasIPT.m` detects the Image Processing Toolbox. Public functions such as `meanFilter`,
`medianFilter`, `histogramEqualization`, `edgeDetect` and `filter2D` call the toolbox when it is
available and fall back to equivalent base-MATLAB code otherwise. Every lab therefore works on a plain
MATLAB installation. The `*Manual` functions (`meanFilterManual`, `medianFilterManual`,
`manualCorrelation`, `sobelManual`, `claheManual`, `cannyManual` …) always use explicit loops for
teaching purposes.

---

## How an uploaded image is processed

1. **Browser.** The file is read, base64-encoded and sent to `POST /api/upload` as `{name, data}`.
2. **Python bridge** (`server/server.py`). Checks the extension and size (≤ 25 MB), writes a temporary
   file to `runtime/uploads/` and calls `ilab_dispatch` with
   `{"op": "importImage", "params": {"path": …, "name": …}}`. The temporary file is deleted afterwards.
3. **MATLAB import** (`importImage` in `api/ilab_dispatch.m`):
   - reads the file with `imread` / `imfinfo`;
   - converts indexed images to RGB and drops any alpha channel;
   - converts to `double` in [0, 1] (`core/toDouble.m`);
   - resizes so the longest side is at most **640 px** to keep the manual loops interactive;
   - saves the image as `runtime/images/orig_<id>.png` (`api/ilab_store.m`) and returns its **id** with
     image information (size, channels, colour type, format, bit depth, min / max / mean).
4. **Every later operation** sends `POST /api/run {op, params: {id, …}}`. MATLAB then:
   ```matlab
   I   = ilab_store('load', id);       % PNG -> double [0,1]
   J   = <algorithm>(I, ...);          % e.g. medianFilter, addNoise, edgeDetect
   out = ilab_store('save', J, tag);   % result -> new PNG, new id
   ```
   and returns the new id(s) along with metrics (PSNR, SSIM, MSE, timings, histograms, kernels …).
5. **Display.** The UI shows results via `GET /api/image/<id>.png`. Signed results (for example the
   Laplacian) are rescaled to [0, 1] before saving so they display correctly.

Results are stored as 8-bit PNGs, so every step in a chain of operations is quantised to 8 bits.

---

## Requirements

| Software | Version | Notes |
|---|---|---|
| MATLAB | R2023b or newer (tested with **R2026a**) | Required |
| Image Processing Toolbox | any | **Optional**: manual implementations are used without it |
| Python | 3.9 – 3.12 | For the bridge server |
| MATLAB Engine API for Python (`matlabengine`) | must match your MATLAB release | See `server/requirements.txt` |
| Node.js | 18+ | Only needed to build the UI |

`matlabengine` versions per MATLAB release: R2026a = `26.1.*`, R2025b = `25.2.*`, R2025a = `25.1.*`,
R2024b = `24.2.*`, R2023b = `23.2.*`. Edit `server/requirements.txt` if your release differs.

---

## Installation

Run once (Windows):

```bat
setup_imagelab.bat
```

This script:

1. creates a Python virtual environment in `.venv`,
2. installs `matlabengine` from `server/requirements.txt`,
3. runs `npm install` and `npm run build` in `frontend/` (output in `frontend/dist`).

<details>
<summary>Manual installation (other platforms or if the script fails)</summary>

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r server/requirements.txt   # Linux/macOS: .venv/bin/python

# If matlabengine cannot be installed from PyPI, install it from your MATLAB folder:
#   cd "<MATLAB root>/extern/engines/python"
#   <path to ImageLab>/.venv/Scripts/python -m pip install .

cd frontend
npm install
npm run build
```
</details>

---

## Running

### Option A — from MATLAB (recommended for demonstrations)

```matlab
cd 'path\to\ImageLab'
ImageLab
```

`ImageLab.m` adds the project folders to the path, shares the current MATLAB session
(`matlab.engine.shareEngine`) and starts the bridge with `--connect <session>`. All processing then
runs in *your* MATLAB session. The browser opens at **http://localhost:8765**. Close the
"ImageLab server" window to stop the interface.

### Option B — without opening MATLAB

```bat
start_imagelab.bat
```

The bridge starts its own MATLAB engine in the background (10–60 s on first start). The UI shows a
loading state until MATLAB is ready.

---

## Using the MATLAB functions directly

Every algorithm can be called without the UI:

```matlab
ilab_setup                                   % add project folders to the path
I = imread('peppers.png');
N = addSaltPepperNoise(I, 0.05);
J = medianFilterManual(N, 3);
psnr_value = calculatePSNR(J, I)

R = runExperiment(4, I);                     % Experiment 4: Median filter
struct2table(R.metrics)
```

You can also call the UI's API from MATLAB:

```matlab
ilab_dispatch('{"op":"loadSample","params":{"name":"peppers.png"}}')
```

The Live Script `ImageLab_Demonstration.mlx` (source: `ImageLab_Demonstration.m`) walks through the
whole project.

---

## Configuration

| Setting | Where | Effect |
|---|---|---|
| `IMAGELAB_PORT` | environment variable | HTTP port (default `8765`) |
| `IMAGELAB_NO_BROWSER` | environment variable | If set, the browser is not opened automatically |
| `--no-browser` | `server.py` argument | Same as above |
| `--connect <name>` | `server.py` argument | Attach to a shared MATLAB session instead of starting one (used by `ImageLab.m`) |
| `ILAB_FORCE_MANUAL=1` | environment variable (MATLAB) | Simulate a missing Image Processing Toolbox |

---

## Limits and supported formats

- **Upload formats:** PNG, JPG/JPEG, TIF/TIFF, BMP, GIF
- **Maximum upload size:** 25 MB
- **Working resolution:** images larger than 640 px on the longest side are resized on import
- **Colour handling:** indexed → RGB; RGBA → RGB (alpha removed); grayscale and RGB kept
- **Server binding:** `127.0.0.1` only, so the app is not reachable from other machines

---

## HTTP API

| Method & path | Purpose |
|---|---|
| `GET /api/status` | `{ready, matlab, error}`: whether the MATLAB engine is running |
| `POST /api/upload` | `{name, data(base64)}` → imports the image, returns `{id, info, original, resized}` |
| `POST /api/run` | `{op, params}` → forwarded to `ilab_dispatch.m`, returns `{ok, op, data, elapsedMs}` or `{ok:false, error}` |
| `GET /api/image/<id>.png` | Result image |
| `GET /api/download/<id>.png` | Result image as a file download |
| `GET /reports/<file>` | Generated report from `reports/output/` |

Main `op` values: `ping`, `samples`, `loadSample`, `importImage`, `imageInfo`, `grayscale`,
`histogramOf`, `noise`, `filter`, `gaussianKernel`, `histogram`, `correlation`, `kernelPreset`,
`applyKernel`, `saveKernel`, `listKernels`, `sharpen`, `edges`, `segment`, `color`, `colorEnhance`,
`neighborhood`, `sampling`, `quantize`, `compare`, quiz / game ops (`quizQuestions`, `quizSubmit`,
`guessFilter`, `pipelineStart`, `pipelineRun`, `challengeStart`, `challengeScore`, `leaderboard`,
`progress`), `experiments`, `runExperiment`, `report`.

Example:

```json
POST /api/run
{"op": "filter", "params": {"id": "orig_1f75cc35a755", "name": "median", "k": 3, "impl": "both", "refId": "orig_1f75cc35a755"}}
```

Image ids are validated (`^[A-Za-z0-9_-]+$`), so a request cannot read files outside the image store.
MATLAB errors with `ImageLab:*` identifiers are returned as readable messages and shown in a dialog.

---

## Development

Run the bridge and the Vite dev server together for hot reload:

```bat
:: terminal 1 — MATLAB bridge on :8765
.venv\Scripts\python.exe server\server.py --no-browser

:: terminal 2 — UI on :5173 (proxies /api and /reports to :8765)
cd frontend
npm run dev
```

Open http://localhost:5173. To add a new operation:

1. write the algorithm as a `.m` function in the appropriate folder;
2. add a `case '<op>'` to `route` in `api/ilab_dispatch.m` that loads the image by id, calls the
   function and returns new ids / metrics;
3. call it from the UI with `POST /api/run {op: '<op>', params: {...}}` (see `frontend/src/api.js`).

---

## Tests

```matlab
run_tests                       % matlab.unittest suite; runs toolbox AND manual code paths
addpath tests; smokeTestApi     % calls every UI operation once through ilab_dispatch
```

---

## Project structure

```
ImageLab/
├── ImageLab.m                  start from MATLAB (shares the session, starts the bridge)
├── ImageLab_Demonstration.mlx  Live Script walkthrough (+ .m source)
├── ilab_setup.m                adds project folders to the MATLAB path
├── run_tests.m                 runs the unit tests on both code paths
├── setup_imagelab.bat          one-time setup (venv, matlabengine, UI build)
├── start_imagelab.bat          start without opening MATLAB
├── core/          toDouble, toGray, padImage, filter2D, neighborhoodStack, resizeImage, hasIPT …
├── algorithms/    mean, weighted, Gaussian, median, min, max, midpoint, order statistic, alpha-trimmed,
│                  correlation, convolution, Laplacian, Sobel, Prewitt, Roberts, LoG, Canny,
│                  unsharp mask, high-boost …
├── noise/         Gaussian, salt & pepper, speckle, Poisson
├── histogram/     imhist, equalisation, CLAHE, stretching, gamma, log, negative, statistics
├── metrics/       MSE, PSNR, SSIM
├── segmentation/  global / iterative / Otsu / adaptive thresholds, point & line detection,
│                  region growing, split & merge, labelling, boundaries, region properties
├── color/         channels, RGB↔YCbCr, RGB↔Lab, enhancement
├── fundamentals/  sampling, quantisation, neighbourhoods, distances
├── quizzes/       question bank, quiz engine, leaderboard, progress, pipeline problems
├── experiments/   experimentCatalog, runExperiment
├── reports/       generateReport (output in reports/output/)
├── api/           ilab_dispatch (single entry point), ilab_store (image store), samples, charts
├── tests/         ImageLabTests (matlab.unittest), smokeTestApi
├── sample_images/ peppers.png + generated teaching images
├── server/        server.py (bridge only), requirements.txt
├── frontend/      React + Vite user interface
├── docs/          documentation
└── runtime/       generated at run time: images/ (results), uploads/ (temporary) — git-ignored
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Could not start MATLAB through the MATLAB Engine API" | `matlabengine` is missing or does not match your MATLAB release. Fix the version in `server/requirements.txt`, or install it from `<MATLAB root>/extern/engines/python`. |
| Page says "The UI is not built yet" | Run `npm install && npm run build` in `frontend/`. |
| "Run setup_imagelab.bat first" | `.venv` does not exist; run the setup script. |
| Slow first start | Starting a MATLAB engine takes 10–60 s. Option A (`ImageLab` in MATLAB) reuses your open session. |
| "The image is no longer available" | `runtime/images/` was cleared; load the image again. |
| Port 8765 already in use | Stop the other instance or set `IMAGELAB_PORT`. (The Vite proxy in `frontend/vite.config.js` assumes 8765.) |
| Need to check the toolbox-free code path | Set `ILAB_FORCE_MANUAL=1` before starting MATLAB. |

---

## Documentation

- [User Guide](docs/USER_GUIDE.md)
- [Algorithms](docs/ALGORITHMS.md)
- [Experiments](docs/EXPERIMENTS.md)
- [MATLAB Function Reference](docs/MATLAB_FUNCTION_REFERENCE.md)
- [Quiz System](docs/QUIZ_SYSTEM.md)
- [Project Architecture](docs/PROJECT_ARCHITECTURE.md)
- [Project Report Content](docs/PROJECT_REPORT_CONTENT.md)
