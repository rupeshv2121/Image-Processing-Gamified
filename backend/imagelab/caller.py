"""Who is making a request - derived from the session token only."""

from __future__ import annotations

from dataclasses import dataclass

from .services.auth import Session


@dataclass(frozen=True)
class Caller:
    session: Session | None
    # False for preview requests (landing-page demo) and the teacher: no XP / progress
    tracking: bool = True

    @property
    def is_teacher(self) -> bool:
        return self.session is not None and self.session.is_teacher

    @property
    def student_id(self) -> str | None:
        """The signed-in student's profile id; None for the teacher and guests."""
        if self.session is None or self.session.is_teacher:
            return None
        return self.session.profile_id

    @property
    def actor(self) -> str:
        """'guest', 'teacher' or the student's profile id (as the UI shows in progress.profileId)."""
        if self.session is None:
            return "guest"
        return "teacher" if self.session.is_teacher else self.session.profile_id

    @property
    def tracked_student(self) -> str | None:
        """The student whose progress this request may change (None = record nothing)."""
        return self.student_id if self.tracking else None
