"""Slow password hashing shared by student passwords, the teacher PIN and its recovery code.

PBKDF2-HMAC-SHA256, 120 000 iterations, a random 16-byte salt per secret
(byte-compatible with the hashes the MATLAB version wrote for passwords).
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

ITERATIONS = 120_000


def pbkdf2(password: str, salt_hex: str, iterations: int = ITERATIONS) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), iterations, 32).hex()


def new_hash(secret: str) -> dict:
    salt = secrets.token_hex(16)
    return {"salt": salt, "hash": pbkdf2(secret, salt), "iterations": ITERATIONS}


def matches(stored: dict | None, secret: str) -> bool:
    if not stored or not stored.get("hash") or not secret:
        return False
    return hmac.compare_digest(pbkdf2(secret, stored["salt"], int(stored["iterations"])), stored["hash"])
