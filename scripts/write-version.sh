#!/bin/bash

# Writes a version string to public/version.txt
# If an argument is provided, it is used as the version (e.g. a released version tag).
# If no argument is provided it falls back to the current git short commit id.

set -euo pipefail

# If public/version.txt already exists and looks like a released version (e.g. "Version: v1.2.3"), preserve it.
# Otherwise use provided argument or fall back to git short SHA.

if [ -n "${1-}" ]; then
  VER="$1"
else
  # If a released version already exists in public/version.txt, do nothing.
  grep -qE '^Version: v[0-9]+\.[0-9]+\.[0-9]+' public/version.txt 2>/dev/null && exit 0

  # Best-effort: get short git sha
  VER=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
fi

echo "Version: $VER" > public/version.txt
