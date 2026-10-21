"""Errors that reach the user interface.

The UI reacts to some error ids (for example ImageLab:auth signs the user
out, ImageLab:needsPassword asks for a first password), so they keep the
identifiers the MATLAB version used.
"""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """An error with a message that is safe to show to the user."""

    def __init__(self, message: str, error_id: str = "ImageLab:invalidParameter", **extra: Any):
        super().__init__(message)
        self.message = message
        self.error_id = error_id
        self.extra = extra


SESSION_ENDED = "Please sign in again (your session has ended)."


def invalid(message: str) -> AppError:
    return AppError(message, "ImageLab:invalidParameter")


def quiz_state(message: str) -> AppError:
    return AppError(message, "ImageLab:invalidQuizState")


def forbidden(message: str = "Only the teacher can do this.") -> AppError:
    return AppError(message, "ImageLab:forbidden")


def session_ended(message: str = SESSION_ENDED) -> AppError:
    return AppError(message, "ImageLab:auth")
