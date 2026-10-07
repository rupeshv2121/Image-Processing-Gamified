# ImageLab — Project Architecture

## Principle

> **MATLAB is the image-processing engine.** Every pixel operation happens in a MATLAB `.m` function.
> The React interface only sends requests and displays the PNG images MATLAB produces.

```
┌──────────────────────┐   POST /api/run {op, params}   ┌───────────────────┐  MATLAB Engine API  ┌─────────────────────────┐
│  React UI (browser)  │ ─────────────────────────────▶ │ server/server.py  │ ──────────────────▶ │ api/ilab_dispatch.m      │
│  frontend/src        │ ◀───────────────────────────── │ (bridge only)     │ ◀────────────────── │  routes to algorithms/,  │
│                      │   JSON {ok, data}              │                   │   JSON string       │  noise/, histogram/ …    │
│  <img src=/api/image>│ ◀── PNG files ──────────────── │ serves runtime/   │ ◀── imwrite ─────── │  ilab_store('save', I)   │
└──────────────────────┘                                └───────────────────┘                     └─────────────────────────┘
```

### Layers

| Layer | Folder | Responsibility |
|---|---|---|
| Algorithms | `algorithms/ noise/ histogram/ metrics/ segmentation/ color/ fundamentals/` | Pure MATLAB functions: image in, image out. Reusable from the command line, tests and the Live Script. |
| Core helpers | `core/` | Type conversion, padding, neighbourhood stacks, fast/loop filtering, toolbox detection (`hasIPT`). |
| Learning content | `quizzes/ experiments/ reports/` | Question bank, scoring, leaderboard, progress, experiment catalogue and runner, report generator. |
| API | `api/` | `ilab_dispatch.m` decodes a JSON request, calls the algorithms, stores result images (`ilab_store.m`) and returns JSON. It also contains sample-image discovery and MATLAB chart rendering. |
| Bridge | `server/server.py` | Python standard library HTTP server plus `matlab.engine`. Starts or connects to MATLAB, forwards requests, serves PNGs, reports and the built UI. **No image processing.** |
| UI | `frontend/` | React (Vite). Pages for every lab; no pixel processing in JavaScript. |

### Toolbox vs manual

`core/hasIPT.m` detects the Image Processing Toolbox. Each public function (`meanFilter`,
`medianFilter`, `histogramEqualization`, `edgeDetect`, `calculatePSNR` …) calls the toolbox when it is
present and falls back to the equivalent base-MATLAB implementation otherwise. The `*Manual`
functions (`meanFilterManual`, `medianFilterManual`, `manualCorrelation`, `sobelManual`,
`claheManual`, `cannyManual` …) always use explicit loops / matrix operations for teaching.
`run_tests` runs the test suite for both code paths (`ILAB_FORCE_MANUAL=1` simulates a missing toolbox).

### Image store

Images move between MATLAB and the UI as PNG files in `runtime/images/` with ids like
`median_3fa2b8c91d0e`. Ids are validated (`^[A-Za-z0-9_-]+$`), so a request can never read files
outside the store. Images larger than 640 px are resized on import to keep the loop implementations
interactive.

### Request example

```json
POST /api/run
{"op": "filter", "params": {"id": "orig_1f75cc35a755", "name": "median", "k": 3, "impl": "both", "refId": "orig_1f75cc35a755"}}
```
→ `ilab_dispatch` → `ilab_runFilter` → `medianFilter` / `medianFilterManual` → two PNGs, times,
PSNR/SSIM and the maximum difference.

### Error handling

MATLAB errors with identifiers `ImageLab:*` (no image, bad format, invalid kernel or kernel size,
invalid parameter, missing sample, invalid quiz state, not colour …) are returned as readable
messages. The UI shows them in a modal dialog (the web equivalent of `uialert`). Other MATLAB errors are
prefixed with "MATLAB error:". Corrupted MAT files (leaderboard, progress) are replaced with fresh
ones.

### Starting modes

* `ImageLab.m` — `matlab.engine.shareEngine('ImageLab')`, then starts `server.py --connect ImageLab`.
  The bridge attaches to that MATLAB session; if attaching fails it starts its own engine.
* `start_imagelab.bat` — `server.py` starts a hidden MATLAB engine.

### Offline

No internet access is needed at run time: no CDN, no external fonts, no cloud API.
