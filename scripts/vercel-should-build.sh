#!/usr/bin/env bash
# Vercel "Ignored Build Step".
#   exit 1  → run the build
#   exit 0  → skip the build (nothing the frontend cares about changed)
#
# Point Vercel at this: Project → Settings → Git → Ignored Build Step:
#   bash scripts/vercel-should-build.sh
#
# It skips the frontend rebuild when a commit only touched the backend, docs, or
# CI — cutting build minutes and "push → live" time on this shared repo.

# Paths that actually affect the Vite build:
PATHS=(
  src
  public
  index.html
  vite.config.ts
  vite.config.js
  package.json
  package-lock.json
  vercel.json
  tsconfig.json
  tsconfig.node.json
)

# First deploy / shallow clone with no parent → build to be safe.
if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "No parent commit available — building."
  exit 1
fi

if git diff --quiet HEAD^ HEAD -- "${PATHS[@]}"; then
  echo "No frontend-relevant changes in this commit — skipping build."
  exit 0
else
  echo "Frontend changes detected — building."
  exit 1
fi
