"""Composition root: builds every service exactly once and wires them together.

Nothing else creates services, so the dependency graph lives in one place:

    repositories -> progress -> profiles -> classroom -> auth
                 -> catalog (MATLAB) -> quiz / live / analytics / games / labs
"""

from __future__ import annotations

import os
import random
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path

from .config import Settings
from .matlab import MatlabGateway
from .services.analytics import AnalyticsService
from .services.auth import AuthService
from .services.catalog import MatlabCatalog
from .services.classroom import ClassroomService
from .services.code_tasks import CodeTaskService
from .services.content import Content
from .services.exports import ExportService
from .services.games import GameService
from .services.labs import CodeLabService, ExperimentService
from .services.live_quiz import LiveQuizService
from .services.profiles import ProfileService
from .services.progress import ProgressService
from .services.quiz import QuizService
from .services.records import KernelLibrary, LeaderboardService, SubmissionService
from .storage.database import Database
from .storage.repositories import Repositories

# Folders that hold no ImageLab MATLAB functions (for the "show the code" lookup)
NOT_MATLAB = {".venv", ".git", "frontend", "backend", "node_modules", "runtime", "data", "reports", "sample_images",
              "shims", "pool", "__pycache__"}


@dataclass
class Services:
    settings: Settings
    matlab: MatlabGateway
    db: Database
    rng: random.Random = field(default_factory=random.Random)

    def __post_init__(self) -> None:
        r = Repositories(self.db)
        self.repos = r
        self.content = Content()
        self.catalog = MatlabCatalog(self.matlab)
        self.progress = ProgressService(r.progress)
        self.profiles = ProfileService(r.profiles, self.progress)
        self.classroom = ClassroomService(r.settings, self.catalog)
        self.auth = AuthService(r.accounts, self.profiles, self.classroom)
        self.submissions = SubmissionService(r.submissions)
        self.leaderboard = LeaderboardService(r.leaderboard)
        self.kernels = KernelLibrary(r.kernels)
        self.exports = ExportService(self.settings.report_dir)
        self.quiz = QuizService(self.content, self.catalog, self.rng)
        self.live = LiveQuizService(self.content, self.quiz, self.progress, self.profiles, r.live_sets,
                                    r.live_results, self.exports, rng=self.rng)
        self.code_tasks = CodeTaskService(r.code_tasks, self.catalog)
        self.analytics = AnalyticsService(self.profiles, self.progress, self.submissions, self.classroom,
                                          self.code_tasks, self.catalog, self.content, self.exports)
        self.games = GameService(self.matlab, self.content, self.catalog, self.progress)
        self.codelab = CodeLabService(self.matlab, self.code_tasks, self.progress, self.submissions,
                                      ipt=lambda: bool(self.matlab_info().get("ipt")))
        self.experiments = ExperimentService(self.matlab, self.catalog, self.classroom, self.progress)
        # A deleted student takes their account, progress, Code Lab work and leaderboard scores along
        for listener in (self.auth.forget, self.progress.remove, self.submissions.remove):
            self.profiles.on_removed(listener)
        self.profiles.on_removed_profile(self.leaderboard.remove_student)
        self.profiles.on_renamed(self.leaderboard.rename_student)

    # ------------------------------------------------------------ MATLAB facts
    def matlab_info(self) -> dict:
        """MATLAB version and toolbox, read once when the engine started (op 'ping')."""
        info = getattr(self.matlab, "info", None)
        if info is None:                               # a gateway without start-up info
            info = self.matlab.call("ping")
        return info or {}

    @cached_property
    def _sources(self) -> dict[str, Path]:
        index: dict[str, Path] = {}
        for folder, dirs, files in os.walk(self.settings.root):
            dirs[:] = [d for d in dirs if d not in NOT_MATLAB and not d.startswith(".")]
            for f in files:
                if f.endswith(".m"):
                    index.setdefault(f[:-2], Path(folder) / f)
        return index

    def find_matlab_source(self, name: str) -> Path | None:
        return self._sources.get(name)
