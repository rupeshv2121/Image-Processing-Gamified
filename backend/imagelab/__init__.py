"""ImageLab backend (FastAPI).

Layers, from the outside in:

    web/        HTTP: FastAPI routes, static files, classroom-network policy
    rpc/        the {op, params} protocol the React UI speaks: op registry,
                access rules, result cache, activity tracking
    services/   application logic (sign-in, progress, quizzes, live quiz,
                classroom, games, Code Lab orchestration ...)
    storage/    SQLite repositories and the one-time import of the old .mat files
    matlab.py   the only door to MATLAB (MATLAB Engine API for Python)

All image processing happens in MATLAB (api/ilab_dispatch.m and the
algorithm folders). Python never touches pixels.
"""

__version__ = "2.0.0"
