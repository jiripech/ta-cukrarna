#!/bin/bash

# Writes a version string to public/version.txt
# If an argument is provided, it is used as the version (e.g. a released version tag).
# If no argument is provided it falls back to the current git short commit id.

set -euo pipefail

if [ -n "${1-}" ]; then
  VER="$1"
else
  # Best-effort: get short git sha
  VER=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
fi

mkdir -p public
echo "Version: $VER" > public/version.txt

echo "Wrote public/version.txt: Version: $VER"
