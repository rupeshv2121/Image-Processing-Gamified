# ImageLab — Project Architecture

## Principle

> **MATLAB is the image-processing engine.** Every pixel operation happens in a MATLAB `.m` function.
> The React interface only sends requests and displays the PNG images MATLAB produces. A Python backend
> (FastAPI) does everything that needs no MATLAB — sign-in, progress, quizzes, the live quiz and the
> classroom — so `.m` files contain only MATLAB work and the frontend only UI code.

```
┌──────────────────────┐   POST /api/run {op, params}   ┌──────────────────────┐  MATLAB Engine API  ┌─────────────────────────┐
│  React UI (browser)  │ ─────────────────────────────▶ │ backend/ (FastAPI)   │ ──────────────────▶ │ api/ilab_dispatch.m      │
│  frontend/src        │ ◀───────────────────────────── │ sign-in, progress,   │ ◀────────────────── │  -> api/handlers/*Ops.m  │
│                      │   JSON {ok, data}              │ quizzes, classroom   │   JSON (image ops)  │  -> algorithms/ …        │
│  <img src=/api/image>│ ◀── PNG files ──────────────── │ SQLite data/imagelab │ ◀── imwrite ─────── │  ilab_store('save', I)   │
└──────────────────────┘                                └──────────────────────┘                     └─────────────────────────┘
```

### Layers

| Layer | Folder | Responsibility |
|---|---|---|
| Algorithms | `algorithms/ noise/ histogram/ metrics/ segmentation/ color/ fundamentals/` | Pure MATLAB functions: image in, image out. Reusable from the command line, tests and the Live Script. |
| Core helpers | `core/` | Type conversion, padding, neighbourhood stacks, fast/loop filtering, toolbox detection (`hasIPT`). |
| MATLAB content | `experiments/ codelab/ games/ reports/` | Experiment catalogue and runner, the Code Lab runner and grader (the teacher writes the tasks; `codeTasks.m` grades against the teacher's model solution and holds built-in examples as templates), image degradations for the games, report generator. |
| MATLAB API | `api/` | `ilab_dispatch.m` decodes a JSON request and routes it through one table to a handler file in `api/handlers/` (`imageOps`, `filterOps`, `analysisOps`, `gameOps`, `codeLabOps`, `experimentOps`), which calls the algorithms, stores result images (`ilab_store.m`) and returns JSON. Shared helpers: `ilab_param`, `ilab_img`, `ilab_put`, `ilab_limitSize` … |
| Backend | `backend/imagelab/` | Python + FastAPI, see below. **No image processing.** |
| UI | `frontend/` | React (Vite). Pages for every lab; no pixel processing in JavaScript. |

### Backend (`backend/imagelab/`)

| Package | Responsibility |
|---|---|
| `web/app.py` | FastAPI routes: `/api/status`, `/api/run`, `/api/cancel`, `/api/upload`, result images, reports, the built UI. Classroom-network policy (`rpc/access.py`): other devices may sign in; signed-in students then get the student side of the app except the Code Lab (it runs arbitrary MATLAB code); no teacher mode |
| `rpc/` | The `{op, params}` protocol: an operation registry (`handlers/`), access rules in one place (`access.py`), the LRU result cache for deterministic image operations (`cache.py`), the XP rules per operation (`activity.py`) and the dispatcher that builds the `{ok, data}` envelope |
| `services/` | Application logic: `auth` (PBKDF2 passwords, sessions, lock-out), `profiles`, `progress` (XP, badges), `classroom`, `analytics` (teacher views), `quiz`, `live_quiz`, `games`, `code_tasks` (the teacher's Code Lab tasks), `labs` (Code Lab / experiment rules), `records` (leaderboard, kernels, submissions), `exports` (CSV / Excel), `catalog` (catalogues MATLAB owns, read once) |
| `storage/` | SQLite (`data/imagelab.db`, WAL, one transaction per change) behind repositories; `legacy.py` imports the 1.x `.mat` files once via `migration/exportLegacyData.m` |
| `matlab.py` | The only module that talks to MATLAB: starts or attaches to the engine, one call at a time, cancel |
| `container.py` | Composition root: builds every service once and wires them |

Only image operations wait for MATLAB. Sign-in, quizzes, progress and the live quiz (polled every second
by every student) are answered by Python directly, and repeated image operations come from the result
cache without calling MATLAB.

### Toolbox vs manual

`core/hasIPT.m` detects the Image Processing Toolbox. Each public function (`meanFilter`,
`medianFilter`, `histogramEqualization`, `edgeDetect`, `calculatePSNR` …) calls the toolbox when it is
present and falls back to the equivalent base-MATLAB implementation otherwise. The `*Manual`
functions (`meanFilterManual`, `medianFilterManual`, `manualCorrelation`, `sobelManual`,
`cannyManual` …) always use explicit loops / matrix operations for teaching.
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
→ backend (access rules, result cache) → `ilab_dispatch` → `filterOps` → `ilab_runFilter` →
`medianFilter` / `medianFilterManual` → two PNGs, times, MSE/PSNR and the maximum difference; the
backend then records the "median filter tried" XP for a signed-in student.

### Error handling

MATLAB errors with identifiers `ImageLab:*` (no image, bad format, invalid kernel or kernel size,
invalid parameter, missing sample, invalid quiz state, not colour …) are returned as readable
messages. The UI shows them in a modal dialog (the web equivalent of `uialert`). Other MATLAB errors are
prefixed with "MATLAB error:". The backend raises its own errors with the same identifiers
(`ImageLab:auth`, `ImageLab:forbidden`, `ImageLab:invalidQuizState` …).

### Starting modes

* `ImageLab.m` — `matlab.engine.shareEngine('ImageLab')`, then starts `python -m imagelab --connect ImageLab`.
  The backend attaches to that MATLAB session; if attaching fails it starts its own engine.
* `start_imagelab.bat` — the backend starts a hidden MATLAB engine (`start_imagelab_lan.bat`: classroom network).

### Offline

No internet access is needed at run time: no CDN, no external fonts, no cloud API.
