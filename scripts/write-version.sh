#!/bin/bash

# Single source of truth for release versioning.
#
# Syncs the version across package.json, package-lock.json (BOTH version
# fields — the root one and packages[""].version) and public/version.txt so
# the pre-push hook finds them already in sync with the release tag and
# `git push origin main --follow-tags` succeeds on the first attempt.
#
# Usage:
#   scripts/write-version.sh vX.Y.Z   # explicit release version
#   scripts/write-version.sh          # derive from the highest v* git tag,
#                                     # fall back to package.json version;
#                                     # last resort (no tags, fresh clone):
#                                     # stamp version.txt with git short SHA
#
# Called automatically by `npm run dev` and `npm run build`; idempotent when
# everything is already in sync.

set -euo pipefail

NUM_RE='^[0-9]+\.[0-9]+\.[0-9]+$'
VER="${1-}"

if [ -z "$VER" ]; then
  # Highest reachable release tag (fails on shallow CI checkouts without
  # tags — the package.json fallback covers that case).
  VER=$(git describe --tags --match 'v[0-9]*' --abbrev=0 2>/dev/null || true)
fi

if [ -z "$VER" ]; then
  VER=$(node -p 'require("./package.json").version' 2>/dev/null || true)
fi

# Normalize: drop a leading "v" for the JSON files; the footer keeps it.
NUM="${VER#v}"

if [[ "$NUM" =~ $NUM_RE ]]; then
  node -e '
    const fs = require("fs");
    const ver = process.argv[1];
    for (const f of ["package.json", "package-lock.json"]) {
      const p = JSON.parse(fs.readFileSync(f, "utf8"));
      if (f === "package-lock.json" && p.packages && p.packages[""]) {
        p.packages[""].version = ver;
      }
      p.version = ver;
      fs.writeFileSync(f, JSON.stringify(p, null, 2) + "\n");
    }
  ' "$NUM"
  echo "Version: v$NUM" > public/version.txt
else
  # No semver derivable (fresh clone without tags): stamp the footer only,
  # never touch the JSON files with a non-release version.
  echo "Version: $VER" > public/version.txt
fi
