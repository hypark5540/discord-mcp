"""Thin launcher for the bundled Node.js discord-mcp server."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import NoReturn


MINIMUM_NODE_MAJOR = 22
_NODE_VERSION_PATTERN = re.compile(r"^v?(\d+)(?:\.|$)")


class LauncherError(RuntimeError):
    """Raised when the bundled server cannot be launched safely."""


def _find_node() -> str:
    configured = os.environ.get("DISCORD_MCP_NODE")
    candidate = (
        os.path.expandvars(os.path.expanduser(configured))
        if configured
        else "node"
    )
    executable = shutil.which(candidate)

    if executable is None:
        if configured:
            raise LauncherError(
                "DISCORD_MCP_NODE does not point to an executable Node.js "
                f"runtime: {configured!r}"
            )
        raise LauncherError(
            f"Node.js {MINIMUM_NODE_MAJOR} or newer is required, but 'node' "
            "was not found on PATH"
        )

    return executable


def _node_major_version(executable: str) -> int:
    try:
        result = subprocess.run(
            [executable, "--version"],
            check=False,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError) as error:
        raise LauncherError(
            f"could not determine the Node.js version from {executable!r}: {error}"
        ) from error

    output = result.stdout.strip() or result.stderr.strip()
    match = _NODE_VERSION_PATTERN.match(output)
    if result.returncode != 0 or match is None:
        detail = output or f"exit status {result.returncode}"
        raise LauncherError(
            f"could not determine the Node.js version from {executable!r}: {detail}"
        )

    return int(match.group(1))


def _bundled_server() -> Path:
    server = Path(__file__).resolve().parent / "_bundled" / "server.cjs"
    if not server.is_file():
        raise LauncherError(
            "the bundled server.cjs is missing; reinstall hypark-discord-mcp "
            "from an official wheel or source distribution"
        )
    return server


def main() -> NoReturn:
    """Replace this process with the bundled Node.js MCP server."""

    try:
        node = _find_node()
        major = _node_major_version(node)
        if major < MINIMUM_NODE_MAJOR:
            raise LauncherError(
                f"Node.js {MINIMUM_NODE_MAJOR} or newer is required; "
                f"{node!r} reports major version {major}"
            )
        server = _bundled_server()
    except LauncherError as error:
        print(f"discord-mcp: {error}", file=sys.stderr)
        raise SystemExit(1) from error

    os.execv(node, [node, str(server), *sys.argv[1:]])
