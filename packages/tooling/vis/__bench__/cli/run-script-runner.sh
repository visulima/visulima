#!/usr/bin/env bash
# Script-runner DISPATCH benchmark — PURE-SHELL script (no node invocation).
#
# Measures how long each runner takes to discover the workspace, look up a
# script/target, and dispatch it. The script itself MUST be pure-shell (`true`)
# — NEVER `node -e ...`. Node's ~40ms cold startup would swamp the runner
# overhead and dilute the very thing being measured.
#
# IMPORTANT — vis is NOT a drop-in `npm run`: `vis run <target>` is a WORKSPACE
# task orchestrator (it requires a workspace root — marked by a lockfile — and
# runs a target across projects, building a project graph first). Its true peers
# are `pnpm -r run` / `turbo run` / `nx run`, NOT single-package `npm run`. So we
# benchmark workspace task dispatch: a one-package workspace, pure-shell `noop`.
# vis runs with --no-preflight --skip-toolchain to isolate dispatch from its
# (network-touching) lockfile-preflight and toolchain auto-install probes.
#
# Methodology ported from nubjs/nub tests/bench/run-script-runner-pure.sh (MIT).
# Requires: hyperfine, pnpm, npm; bun optional. Build first: `pnpm run build:native && packem build`.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIS="${VIS:-$REPO_ROOT/dist/bin.js}"
case "$VIS" in /*) ;; *) VIS="$(cd "$(dirname "$VIS")" 2>/dev/null && pwd)/$(basename "$VIS")" ;; esac
RESULTS_DIR="$REPO_ROOT/__bench__/cli/results"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

WARMUP=5
RUNS=30
while [[ $# -gt 0 ]]; do
  case "$1" in
    --warmup) WARMUP="$2"; shift 2 ;;
    --runs)   RUNS="$2";   shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

[[ -f "$VIS" ]] || { echo "ERROR: vis not built at $VIS — run 'pnpm run build:native && packem build' first." >&2; exit 1; }
command -v hyperfine &>/dev/null || { echo "ERROR: hyperfine not found (brew install hyperfine)." >&2; exit 1; }
command -v pnpm &>/dev/null || { echo "ERROR: pnpm not found." >&2; exit 1; }
command -v npm &>/dev/null  || { echo "ERROR: npm not found." >&2; exit 1; }
HAS_BUN=0; command -v bun &>/dev/null && HAS_BUN=1

# Fixture: a one-package workspace whose only script is PURE SHELL (`true`).
# A lockfile is REQUIRED — that's the marker vis uses to find the workspace root.
FIXTURE="$(mktemp -d /tmp/vis-script-runner-XXXXXX)"
trap 'rm -rf "$FIXTURE"' EXIT
# `workspaces` field is for npm/bun (they ignore pnpm-workspace.yaml); pnpm + vis
# use pnpm-workspace.yaml + the lockfile. Declaring both keeps all four honest.
cat > "$FIXTURE/package.json" <<'EOF'
{ "name": "ws-root", "version": "1.0.0", "private": true, "workspaces": ["packages/*"] }
EOF
printf 'packages:\n  - "packages/*"\n' > "$FIXTURE/pnpm-workspace.yaml"
printf "lockfileVersion: '9.0'\n" > "$FIXTURE/pnpm-lock.yaml"   # workspace-root marker
mkdir -p "$FIXTURE/packages/app"
cat > "$FIXTURE/packages/app/package.json" <<'EOF'
{ "name": "app", "version": "1.0.0", "scripts": { "noop": "true" } }
EOF

VIS_CMD="node '$VIS' run noop --no-preflight --skip-toolchain"

# Verify each runner can dispatch (cwd must be workspace root).
( cd "$FIXTURE" && eval "$VIS_CMD" >/dev/null 2>&1 ) || { echo "vis run failed in workspace fixture" >&2; exit 1; }
( cd "$FIXTURE" && pnpm -r run noop >/dev/null 2>&1 ) || { echo "pnpm -r run failed" >&2; exit 1; }
( cd "$FIXTURE" && npm run noop --workspaces --if-present >/dev/null 2>&1 ) || { echo "npm -ws run failed" >&2; exit 1; }

echo "================================================================"
echo "  Workspace task DISPATCH benchmark — PURE-SHELL script ('true')"
echo "  (1-package workspace; no node invocation; isolates orchestration overhead)"
echo "  vis:  $(node "$VIS" --version 2>&1 | head -1)   ($VIS)"
echo "  pnpm: $(pnpm --version)   npm: $(npm --version)"
echo "  bun:  $([[ $HAS_BUN -eq 1 ]] && bun --version || echo '(absent)')"
echo "  warmup: $WARMUP  runs: $RUNS   date: $(date)"
echo "  NOTE: vis builds a project graph + orchestrates; pnpm -r / npm -ws are the fair peers."
echo "================================================================"

OUTFILE="$RESULTS_DIR/script-runner-${TIMESTAMP}.json"
mkdir -p "$RESULTS_DIR"

HF_ARGS=(
  --warmup "$WARMUP" --runs "$RUNS" --export-json "$OUTFILE"
  --command-name "vis run (orchestrated)" "cd '$FIXTURE' && $VIS_CMD"
  --command-name "pnpm -r run"            "cd '$FIXTURE' && pnpm -r run noop"
  --command-name "npm -ws run"            "cd '$FIXTURE' && npm run noop --workspaces --if-present"
)
if [[ $HAS_BUN -eq 1 ]]; then
  ( cd "$FIXTURE" && bun run --filter '*' noop >/dev/null 2>&1 ) \
    && HF_ARGS+=( --command-name "bun --filter run" "cd '$FIXTURE' && bun run --filter '*' noop" )
fi

hyperfine "${HF_ARGS[@]}"
echo ""
echo "  [results saved → $OUTFILE]"
echo "================================================================"
