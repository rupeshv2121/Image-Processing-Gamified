"""Local-network helpers for classroom mode."""

from __future__ import annotations

import socket

LOOPBACK = {"127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost", "testclient"}


def is_remote(host: str | None) -> bool:
    """A device other than the ImageLab computer (a student's phone or laptop)."""
    return (host or "") not in LOOPBACK


def lan_addresses() -> list[str]:
    """IPv4 addresses of this computer on the local network (best first)."""
    found: list[str] = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))           # picks the outgoing interface, sends nothing
            found.append(s.getsockname()[0])
    except OSError:
        pass
    try:
        found += socket.gethostbyname_ex(socket.gethostname())[2]
    except OSError:
        pass
    # skip loopback and link-local (169.254.x.x: no DHCP, unreachable for students)
    return [ip for i, ip in enumerate(found) if not ip.startswith(("127.", "169.254.")) and ip not in found[:i]]
