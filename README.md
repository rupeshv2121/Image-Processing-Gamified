# ImageLab — Interactive Image Processing Laboratory

> **Assignment:** Image Enhancement using Different Spatial Domain Filters
> An interactive, MATLAB-based image processing and learning laboratory.

ImageLab is an offline laboratory for an Image Processing course (Units I–IV). Load an image, apply
spatial-domain operations (noise, filtering, histogram processing, sharpening, restoration, colour
processing, edge detection and linking, segmentation, representation and description) and compare the
results visually and numerically (MSE, PSNR, execution time). Experiments, a MATLAB Code Lab, quizzes, games and a live classroom
quiz reinforce the theory, and a teacher side tracks the whole class.

**All image processing is written in MATLAB.** Most algorithms exist twice: the Image Processing
Toolbox call and a hand-written manual implementation (loops / matrix operations), so both can be
compared side by side. The web interface only displays results, and the Python backend handles
everything that is not image processing.

| Layer | Technology | Does |
|---|---|---|
| Image processing | **MATLAB** (`.m` files) | Every pixel operation, the experiments, Code Lab grading, reports |
| Backend | **Python + FastAPI** | Sign-in, progress and badges, quizzes, live quiz, classroom, data storage — no image processing |
| User interface | **React + Vite** | Display and interaction only — no pixel processing in JavaScript |

Frequency-domain filtering is intentionally **not** included (out of scope).

---

## Contents

- [Quick start](#quick-start)
- [Features](#features)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Installation](#installation)
- [Running](#running)
- [Using the MATLAB functions directly](#using-the-matlab-functions-directly)
- [Configuration](#configuration)
- [HTTP API](#http-api)
- [Security](#security)
- [Development](#development)
- [Tests](#tests)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

---

## Quick start

On Windows, with MATLAB, Python 3.9–3.12 and Node.js 18+ installed:

```bat
setup_imagelab.bat      :: once: Python environment, MATLAB Engine API, backend packages, UI build
start_imagelab.bat      :: starts MATLAB in the background and opens http://localhost:8765
```

Or, from an open MATLAB session in the project folder:

```matlab
ImageLab
```

Sign in as the **teacher** (no PIN is set on a fresh install — set one under *Class settings*) or as a
**student** (the teacher creates accounts, or students sign up themselves).

---

## Features

### Image labs

| Lab | What you can do |
|---|---|
| Image Workspace | Load a sample, upload a file or **capture from the webcam**; undo / redo (Ctrl+Z / Ctrl+Y), zoom, grayscale, image information, histogram |
| Pixels & Sampling | N4 / ND / N8 / m-adjacency, De / D4 / D8 distances, sampling, quantisation; **visual perception** (Mach bands, simultaneous contrast, Weber ratio) and the **electromagnetic spectrum** |
| Histogram | Histogram, equalisation (toolbox + manual), histogram matching, stretching, piecewise-linear, gray-level slicing, bit-plane slicing, gamma, log, negative, statistics |
| Spatial Filters | Mean, weighted mean, Gaussian, Laplacian, Sobel, Prewitt, median, min, max, midpoint, rank, alpha-trimmed, geometric, harmonic, contraharmonic, adaptive median, adaptive local (Wiener) — **toolbox vs manual, side by side** |
| Correlation & Convolution | Step-by-step kernel movement, products and sums, kernel flipping, checked against `filter2` / `conv2` |
| Kernel Playground | Editable 3×3 / 5×5 / 7×7 kernels, presets, live update, a saved kernel library |
| Sharpening | Laplacian, Sobel, Prewitt, unsharp masking, high-boost |
| Noise | Gaussian, salt & pepper, Rayleigh, Erlang, exponential, uniform; the noise PDF of each model; MSE / PSNR; restore with adaptive median, adaptive local, median, mean, geometric, harmonic and contraharmonic filters |
| Restoration | Linear, position-invariant degradations: motion, turbulence, out-of-focus and box PSFs plus noise; inverse, Wiener, constrained least squares and Richardson–Lucy restoration, solved in the spatial domain; PSNR per iteration |
| Edge Detection | Roberts, Prewitt, Sobel, LoG, Canny; manual gradient images; edge count, density and time; **edge linking** with the Hough transform and by local processing |
| Segmentation | Global (live slider), iterative, Otsu, adaptive, point & line detection, region growing, split & merge, region properties |
| Region Analysis | Freeman chain codes, first difference, shape number, area, perimeter, centroid, circularity; signature, polygonal approximation, skeleton, Fourier descriptors, Hu moments, texture |
| Colour | RGB, CMY(K), HSV, HSI channels; per-channel enhancement; pseudocolour (intensity slicing, grey-to-colour transformation) |

Every lab shows input and result **side by side, with a before/after slider or as an error heat map**
(|result − input| with MSE / PSNR), and a pixel inspector (value + 3×3 neighbourhood) on every image.

### Learning

| Area | What you can do |
|---|---|
| Learn | 24 theory topics following the syllabus, each linked to a lab |
| Animations | Step-by-step playback of the median filter, histogram equalisation and region growing — every step computed by MATLAB |
| Experiments | 13 experiments with aim, theory, algorithm, MATLAB code (toolbox and manual), run, observation, conclusion and quiz |
| Code Lab | A **MATLAB editor in the browser** (syntax highlighting, Ctrl+Enter to run): MATLAB runs the code and returns the Command Window, figures and the workspace. 10 graded tasks (negative, gamma, contrast stretch, histogram, equalisation, mean / median filters with loops, Laplacian, Sobel, Otsu) with hints, a "write it yourself" function blacklist, automatic checking against MATLAB's reference result and a model solution after solving |
| Reports | A4 PDF (base MATLAB), HTML, and DOCX when MATLAB Report Generator is installed |

### Quizzes and games

| Mode | Description |
|---|---|
| Rapid Fire | 5 / 10 / 15 questions from a bank of 103, 10 s timer, streaks |
| Weak-Topic Practice | Questions weighted by your own error rate per topic |
| Kernel Quiz | Identify a displayed kernel (mean, Sobel, Prewitt, Laplacian, sharpening …) |
| Guess the Filter | MATLAB applies a random filter — which one was it? |
| Build the Pipeline | Repair a degraded image with the right sequence of blocks (6 problems) |
| Daily Challenge | The same puzzle for everybody each day, with streaks |
| Challenge Mode | Timed restoration; score = 40·ΔPSNR + 600·ΔSSIM + time bonus |
| Live Quiz | Kahoot-style: the teacher hosts on the projector, students join with a 6-digit code on their own phones or laptops; speed scoring, live leaderboard, Excel export |

Students earn **XP, levels and 17 badges**; scores go to the leaderboard.

### Teacher side

- **Class dashboard** — active students, average XP, code tasks solved, assigned-work completion, who
  needs attention, recent activity feed
- **Students** — searchable roster, topic heatmap, weakest topics, a detail page per student
- **Assignments** — open, assign (with due date and note) or lock each experiment and Code Lab task
- **Code submissions** — students × tasks matrix; read any student's latest and passing code
- **Class settings** — manage students and passwords, teacher PIN, self sign-up, CSV / Excel export

### Interface

Responsive (phone to desktop), light / dark / system theme, keyboard shortcuts (press `?`), accessible
focus outlines and labels, works offline once loaded. A **Cancel** button interrupts slow manual-loop
runs; repeated operations return instantly from a result cache.

---

## How it works

```
┌──────────────────────┐  POST /api/run {op, params}  ┌──────────────────────┐  MATLAB Engine API  ┌──────────────────────────┐
│  React UI (browser)  │ ───────────────────────────▶ │ backend/ (FastAPI)   │ ──────────────────▶ │ api/ilab_dispatch.m       │
│  frontend/src        │ ◀─────────────────────────── │ sign-in, progress,   │ ◀────────────────── │  -> api/handlers/*Ops.m   │
│                      │  JSON {ok, data}             │ quizzes, classroom   │  JSON (image ops)   │  -> algorithms/, noise/ … │
│ <img src=/api/image> │ ◀── PNG files ────────────── │ SQLite data/imagelab │ ◀── imwrite ─────── │  ilab_store('save', I)    │
└──────────────────────┘                              └──────────────────────┘                     └──────────────────────────┘
```

Every UI action is one request, `POST /api/run {op, params}`. The backend checks who is asking (from the
session token, never from what the browser claims) and whether they may do it. Then:

- **Image operations** (filters, histograms, edges …) go to MATLAB. `ilab_dispatch.m` routes each one to
  a handler in `api/handlers/`, which loads the image by id, runs the algorithm, saves the result as a
  new PNG and returns its id with the metrics. Deterministic results are cached, so repeating an
  operation does not call MATLAB again.
- **Everything else** (sign-in, progress, quizzes, live quiz, classroom) is answered by Python
  directly. It never waits for MATLAB — sign-in works while MATLAB is still starting, and 40 students
  polling the live quiz do not queue behind an image filter.

### What lives where

| Part | Folder | Responsibility |
|---|---|---|
| Algorithms | `algorithms/ noise/ histogram/ metrics/ restoration/ segmentation/ color/ fundamentals/ steps/` | Pure MATLAB functions: image in, image out. Usable from the command line, the tests and the Live Script |
| Core helpers | `core/` | Type conversion, padding, neighbourhood stacks, fast / loop filtering, toolbox detection (`hasIPT`) |
| MATLAB content | `experiments/ codelab/ games/ reports/` | Experiment catalogue and runner, Code Lab tasks with their graders, image degradations for the games, report generator |
| MATLAB API | `api/` | `ilab_dispatch.m` and one handler per area (`imageOps`, `filterOps`, `analysisOps`, `restorationOps`, `gameOps`, `codeLabOps`, `experimentOps`); the image store `ilab_store.m` |
| Backend | `backend/imagelab/` | `web/` HTTP routes · `rpc/` operation registry, access rules, result cache, XP rules · `services/` application logic · `storage/` SQLite repositories · `matlab.py` the only module that talks to MATLAB · `container.py` wires everything together |
| User interface | `frontend/` | React 18 + Vite, one page per lab |

### Toolbox vs manual

`core/hasIPT.m` detects the Image Processing Toolbox. Public functions such as `meanFilter`,
`medianFilter`, `histogramEqualization`, `edgeDetect` and `filter2D` call the toolbox when it is
available and fall back to equivalent base-MATLAB code otherwise, so **every lab works on a plain MATLAB
installation**. The `*Manual` functions (`meanFilterManual`, `medianFilterManual`, `manualCorrelation`,
`sobelManual`, `cannyManual` …) always use explicit loops for teaching.

### Life of an uploaded image

1. **Browser** — reads the file and sends it base64-encoded to `POST /api/upload`.
2. **Backend** — checks the type and size (≤ 25 MB), writes a temporary file to `runtime/uploads/` and
   asks MATLAB to import it; the temporary file is deleted afterwards.
3. **MATLAB** (`importImage` in `api/handlers/imageOps.m`) — reads it with `imread`, converts indexed
   images to RGB, drops any alpha channel, converts to `double` in [0, 1], resizes the longest side to
   at most **640 px** (keeps the manual loops interactive) and saves it as `runtime/images/orig_<id>.png`.
4. **Every later operation** sends the image id:
   ```matlab
   I  = ilab_img(p);            % PNG -> double [0,1]
   J  = medianFilter(I, 3);     % any algorithm
   id = ilab_put(J, 'median');  % result -> new PNG, new id
   ```
5. **Display** — the UI shows `GET /api/image/<id>.png`. Signed results (for example the Laplacian) are
   rescaled to [0, 1] first. Results are 8-bit PNGs, so each step of a chain is quantised to 8 bits.

---

## Requirements

| Software | Version | Notes |
|---|---|---|
| MATLAB | R2023b or newer (tested with **R2026a**) | Required |
| Image Processing Toolbox | any | **Optional** — manual implementations are used without it |
| Python | 3.9 – 3.12 | For the backend (`backend/requirements.txt`: FastAPI, uvicorn, openpyxl) |
| MATLAB Engine API for Python (`matlabengine`) | must match your MATLAB release | Installed by `setup_imagelab.bat` |
| Node.js | 18+ | Only needed to build the UI |

`matlabengine` per MATLAB release: R2026a = `26.1.*`, R2025b = `25.2.*`, R2025a = `25.1.*`,
R2024b = `24.2.*`, R2023b = `23.2.*`. The setup script picks the right one.

---

## Installation

Run once (Windows):

```bat
setup_imagelab.bat              :: add -CheckOnly to only report what is installed
```

The script finds MATLAB and a matching Python, then:

1. creates a Python virtual environment in `.venv`;
2. installs the `matlabengine` version that matches your MATLAB, and the backend packages;
3. runs `npm install` and `npm run build` in `frontend/` (output in `frontend/dist`).

<details>
<summary>Manual installation (other platforms, or if the script fails)</summary>

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r backend/requirements.txt   # Linux/macOS: .venv/bin/python
.venv/Scripts/python -m pip install "matlabengine==26.1.*"       # match your MATLAB release

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

### From MATLAB (recommended for demonstrations)

```matlab
cd 'path\to\ImageLab'
ImageLab            % or ImageLab('lan') for classroom network mode
```

`ImageLab.m` adds the project folders to the path, shares the current MATLAB session and starts the
backend, which connects back to it — all processing runs in *your* MATLAB session. The browser opens at
**http://localhost:8765**. Close the "ImageLab server" window to stop.

### Without opening MATLAB

```bat
start_imagelab.bat
```

The backend starts its own MATLAB engine in the background (10–60 s). Sign-in and the quizzes work
immediately; image operations wait until MATLAB is ready.

### Classroom network (live quiz on students' devices)

```bat
start_imagelab_lan.bat
```

The server also listens on the local network and prints the address students open (for example
`http://192.168.1.20:8765/#live`). Other devices can **only** sign in and play the live quiz. If Windows
Firewall asks, allow Python on *private* networks.

### Where data is kept

Everything ImageLab remembers — students, password hashes, progress, Code Lab submissions, teacher
settings, leaderboard, live quizzes, the kernel library — is in one SQLite file, **`data/imagelab.db`**.
Back up that file to back up the class.

**Upgrading from ImageLab 1.x:** on the first start, the old `.mat` files in `data/` and
`quizzes/leaderboard.mat` are imported once through MATLAB (`migration/exportLegacyData.m`), so that
start takes as long as MATLAB needs to start. Existing passwords and the teacher PIN keep working.
The `.mat` files are only read, never changed.

---

## Using the MATLAB functions directly

Every algorithm can be used without the UI:

```matlab
ilab_setup                                   % add the project folders to the path
I = imread('peppers.png');
N = addSaltPepperNoise(I, 0.05);
J = medianFilterManual(N, 3);
psnr_value = calculatePSNR(J, I)

R = runExperiment(4, I);                     % Experiment 4: median filter
struct2table(R.metrics)
```

The MATLAB side of the API can be called directly too (image operations only):

```matlab
ilab_dispatch('{"op":"loadSample","params":{"name":"peppers.png"}}')
```

The Live Script `ImageLab_Demonstration.mlx` (source: `ImageLab_Demonstration.m`) walks through the
whole project.

---

## Configuration

| Setting | Type | Effect |
|---|---|---|
| `IMAGELAB_PORT` | environment variable | HTTP port (default `8765`; the Vite dev proxy assumes 8765) |
| `IMAGELAB_LAN=1` / `--lan` | environment variable / argument | Classroom network mode |
| `IMAGELAB_NO_BROWSER=1` / `--no-browser` | environment variable / argument | Do not open the browser |
| `--connect <name>` | argument | Attach to a shared MATLAB session instead of starting one (used by `ImageLab.m`) |
| `IMAGELAB_DATA_DIR` | environment variable | Folder of `imagelab.db` (default `data/`) |
| `IMAGELAB_RUNTIME_DIR` | environment variable | Folder for result images and uploads (default `runtime/`) |
| `IMAGELAB_REPORT_DIR` | environment variable | Folder for teacher exports (default `reports/output/`) |
| `IMAGELAB_KEEP_HOURS` | environment variable | Delete result images older than this many hours, at start-up and hourly (default `24`, `0` = keep all) |
| `ILAB_FORCE_MANUAL=1` | environment variable (MATLAB) | Simulate a missing Image Processing Toolbox |

Arguments go to `python -m imagelab` (run from `backend/`) or to `start_imagelab.bat`.

---

## HTTP API

| Method & path | Purpose |
|---|---|
| `GET /api/status` | `{ready, matlab, error, remote, lan}` — is MATLAB running, is this browser another device, the classroom-network addresses |
| `POST /api/run` | `{op, params}` → `{ok, op, data, elapsedMs, cached}` or `{ok: false, error, errorId}` |
| `POST /api/upload` | `{name, data (base64)}` → imports the image, returns `{id, info, original, resized}` |
| `POST /api/cancel` | Interrupts the MATLAB computation that is running |
| `GET /api/image/<id>.png` | A result image (`/api/download/<id>.png` as a file download) |
| `GET /reports/<file>` | A generated report or export |

Example:

```json
POST /api/run
{"op": "filter", "params": {"id": "orig_1f75cc35a755", "name": "median", "k": 3, "impl": "both", "refId": "orig_1f75cc35a755", "token": "…"}}
```

**Operations answered by MATLAB:** `ping`, `samples`, `loadSample`, `imageInfo`, `grayscale`,
`histogramOf`, `errorMap`, `noise`, `filter`, `gaussianKernel`, `kernelPreset`, `applyKernel`,
`correlation`, `histogram`, `bitPlanes`, `sharpen`, `edges`, `edgeLink`, `segment`, `regions`, `describeRegion`,
`color`, `colorEnhance`, `pseudocolor`, `lpiDegrade`, `deconvolve`, `perception`, `spectrum`, `neighborhood`,
`sampling`, `quantize`, `steps`, `guessFilter`,
`codeWarmup`, `codeTaskStart`, `report`.

**Operations answered by the backend** (some call MATLAB for the image part): `auth`, `profiles`,
`progress`, `classroom`, `leaderboard`, `quizCategories`, `quizQuestions`, `quizSubmit`, `live`,
`pipelineProblems`, `pipelineStart`, `pipelineRun`, `dailyStart`, `challengeStart`, `challengeScore`,
`codeTasks`, `codeTaskSolution`, `runCode`, `experiments`, `runExperiment`, `saveKernel`, `listKernels`,
`source`.

Errors carry an `ImageLab:*` id (for example `ImageLab:auth` signs the user out in the UI) and a readable
message, shown in a dialog.

---

## Security

- **Passwords** are stored only as PBKDF2-HMAC-SHA256 hashes (120 000 iterations, random salt per
  password); the teacher PIN as a salted SHA-256 hash.
- **Sessions** are random 256-bit tokens kept in memory (students 12 h, teacher 8 h, renewed while in
  use). A server restart signs everybody out.
- **Lock-out:** 5 wrong attempts lock sign-in (or the PIN) for 5 minutes; failed sign-ins give one
  generic message, so nobody can find out which roll numbers exist.
- **Identity** always comes from the session token, never from ids the browser sends. Access rules
  (teacher-only, signed-in only) are defined in one place: `backend/imagelab/rpc/access.py`.
- **Network:** the server listens on `127.0.0.1` only. In classroom mode, other devices may only use
  `ping`, sign-in and the live quiz; labs, uploads, images, reports, Code Lab (which runs MATLAB code)
  and teacher sign-in stay on the ImageLab computer.
- **Files:** image ids are validated (`^[A-Za-z0-9_-]+$`), so a request cannot read files outside the
  image store. Code Lab blocks system calls, file access and `eval` in student code.

---

## Development

Run the backend and the Vite dev server together for hot reload:

```bat
:: terminal 1 — backend on :8765
cd backend
..\.venv\Scripts\python.exe -m imagelab --no-browser

:: terminal 2 — UI on :5173 (proxies /api and /reports to :8765)
cd frontend
npm run dev
```

Open http://localhost:5173.

**Adding an image operation**

1. Write the algorithm as a `.m` function in the matching folder.
2. Add a `case '<op>'` to the matching handler in `api/handlers/` and list the op in the routing table in
   `api/ilab_dispatch.m`.
3. Register it in `backend/imagelab/rpc/handlers/labs.py` — in `CACHEABLE` if the result depends only on
   the image and the parameters, otherwise in `COMPUTED`. To award XP for it, add a rule to
   `backend/imagelab/rpc/activity.py`.
4. Call it from the UI with `run('<op>', {...})` (`frontend/src/api.js`).

**Adding anything else** (quiz, classroom …) is plain Python: logic in `backend/imagelab/services/`, the
operation in `backend/imagelab/rpc/handlers/`, wired in `backend/imagelab/container.py`.

Quiz questions are data: add an entry to `backend/imagelab/content/question_bank.json`
(see [Quiz System](docs/QUIZ_SYSTEM.md)).

---

## Tests

**MATLAB**

```matlab
run_tests                       % matlab.unittest suite on both code paths (toolbox and manual)
addpath tests; smokeTestApi     % calls every MATLAB operation once through ilab_dispatch
```

**Backend**

```bat
cd backend
..\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
..\.venv\Scripts\python.exe -m pytest
```

The backend unit tests use a fake MATLAB and finish in a few seconds. The end-to-end test starts a
real MATLAB engine and drives every operation over HTTP on a **copy** of `data/` (the real files are
only read):

```bat
set IMAGELAB_MATLAB_TESTS=1
..\.venv\Scripts\python.exe -m pytest tests\test_integration_matlab.py
```

---

## Project structure

```
ImageLab/
├── ImageLab.m                  start from MATLAB (shares the session, starts the backend)
├── ImageLab_Demonstration.mlx  Live Script walkthrough (+ .m source)
├── ilab_setup.m                adds the project folders to the MATLAB path
├── run_tests.m                 runs the MATLAB unit tests on both code paths
├── setup_imagelab.bat / .ps1   one-click setup
├── start_imagelab.bat          start without opening MATLAB
├── start_imagelab_lan.bat      the same in classroom network mode
│
├── algorithms/    filters (mean … alpha-trimmed, adaptive), correlation, convolution, Laplacian, Sobel,
│                  Prewitt, Roberts, LoG, Canny, unsharp mask, high-boost …
├── noise/         Gaussian, salt & pepper, Rayleigh, Erlang, exponential, uniform
├── histogram/     imhist, equalisation, matching, stretching, piecewise-linear, slicing, bit planes,
│                  gamma, log, negative, statistics (clahe.m is used only by the Pipeline game)
├── metrics/       MSE, PSNR, error heat map (calculateSSIM.m is used only for game scores)
├── restoration/   blur PSFs, LPI degradation, inverse / Wiener / CLS / Richardson–Lucy restoration
├── segmentation/  thresholds (global, iterative, Otsu, adaptive), point & line detection, Hough
│                  transform, local edge linking, region growing, split & merge, boundaries, chain codes,
│                  signatures, polygons, skeleton, Fourier descriptors, moments, texture
├── color/         channels, RGB↔HSI, CMY(K), enhancement, pseudocolour
├── fundamentals/  sampling, quantisation, neighbourhoods, distances, perception demos, spectrum
├── steps/         step-by-step data for the animations
├── core/          toDouble, toGray, padImage, filter2D, neighborhoodStack, resizeImage, hasIPT …
├── games/         degradeImage, applyBlock (image work of the games)
├── experiments/   experimentCatalog, runExperiment
├── codelab/       runStudentCode, codeTasks (tasks + graders), figurePool, shims/
├── reports/       generateReport, generateReportPdf — output in reports/output/
├── api/           ilab_dispatch, handlers/ (one file per area), ilab_store (image store), helpers
├── migration/     exportLegacyData (one-time import of ImageLab 1.x .mat files)
├── tests/         ImageLabTests (matlab.unittest), smokeTestApi
├── sample_images/ peppers.png + generated teaching images
│
├── backend/
│   ├── imagelab/
│   │   ├── web/        FastAPI app and routes, classroom-network policy
│   │   ├── rpc/        operation registry + handlers/, access rules, result cache, XP rules, dispatcher
│   │   ├── services/   auth, profiles, progress, classroom, analytics, quiz, live_quiz, games, labs,
│   │   │               records, exports, catalog
│   │   ├── storage/    SQLite database, repositories, legacy import
│   │   ├── content/    question_bank.json, pipeline_problems.json
│   │   ├── matlab.py   the MATLAB Engine gateway
│   │   └── container.py  builds and wires every service
│   └── tests/          pytest suite (fake MATLAB) + end-to-end test with real MATLAB
│
├── frontend/      React + Vite user interface
├── docs/          documentation
├── data/          imagelab.db — git-ignored
└── runtime/       result images and temporary uploads — git-ignored
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Could not start MATLAB through the MATLAB Engine API" | `matlabengine` is missing or does not match your MATLAB release. Run `setup_imagelab.bat` again, or install it from `<MATLAB root>/extern/engines/python` |
| "The backend packages are missing" (setup) | Run `.venv\Scripts\python.exe -m pip install -r backend\requirements.txt` |
| "Run setup_imagelab.bat first" | `.venv` does not exist; run the setup script |
| Page says "The UI is not built yet" | Run `npm install && npm run build` in `frontend/` |
| Slow first start | Starting MATLAB takes 10–60 s (the very first start after an upgrade also imports the old data). `ImageLab` in MATLAB reuses your open session |
| "The image is no longer available" | Result images older than 24 h are cleaned up; load the image again |
| Port 8765 already in use | Stop the other instance or set `IMAGELAB_PORT` |
| Students cannot open the live quiz | Use `start_imagelab_lan.bat`, check that both devices are on the same network, and allow Python on private networks in Windows Firewall |
| Need to test the toolbox-free code path | Set `ILAB_FORCE_MANUAL=1` before starting MATLAB |

---

## Documentation

- [User Guide](docs/USER_GUIDE.md)
- [Algorithms](docs/ALGORITHMS.md)
- [Experiments](docs/EXPERIMENTS.md)
- [MATLAB Function Reference](docs/MATLAB_FUNCTION_REFERENCE.md)
- [Quiz System](docs/QUIZ_SYSTEM.md)
- [Project Architecture](docs/PROJECT_ARCHITECTURE.md)
- [Project Report Content](docs/PROJECT_REPORT_CONTENT.md)
