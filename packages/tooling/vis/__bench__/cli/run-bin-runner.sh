#!/usr/bin/env bash
# Bin-runner DISPATCH benchmark — PURE-SHELL local .bin (no node invocation).
#
# Measures how long each tool takes to locate a binary in node_modules/.bin and
# dispatch it — the `vis exec` / `visx` path vs `pnpm exec` / `npm exec` / `bun x`
# for a LOCALLY-INSTALLED bin. To isolate the RUNNER's overhead, the .bin script
# itself MUST be pure-shell (`exit 0`), NEVER `node -e ...`.
#
# This is the benchmark that justifies the Phase 4 native local-first bin
# resolver in rfc/design-runtime-multitool.md — run it before and after.
#
# Methodology ported from nubjs/nub tests/bench/run-bin-runner-pure.sh (MIT).
# Requires: hyperfine, pnpm, npm; bun optional. Build first: `pnpm run build`.
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

[[ -f "$VIS" ]] || { echo "ERROR: vis not built at $VIS — run 'pnpm run build' first." >&2; exit 1; }
command -v hyperfine &>/dev/null || { echo "ERROR: hyperfine not found (brew install hyperfine)." >&2; exit 1; }
command -v pnpm &>/dev/null || { echo "ERROR: pnpm not found." >&2; exit 1; }
command -v npm &>/dev/null  || { echo "ERROR: npm not found." >&2; exit 1; }
HAS_BUN=0; command -v bun &>/dev/null && HAS_BUN=1

# Fixture: a project with a single LOCALLY-INSTALLED pure-shell bin in
# node_modules/.bin. No real dependency; we hand-build the .bin so dispatch
# never touches node or the network.
FIXTURE="$(mktemp -d /tmp/vis-bin-runner-XXXXXX)"
trap 'rm -rf "$FIXTURE"' EXIT
cat > "$FIXTURE/package.json" <<'EOF'
{
  "name": "vis-bin-runner-bench",
  "version": "1.0.0"
}
EOF
mkdir -p "$FIXTURE/node_modules/.bin"
cat > "$FIXTURE/node_modules/.bin/noopbin" <<'EOF'
#!/bin/sh
exit 0
EOF
chmod +x "$FIXTURE/node_modules/.bin/noopbin"

# Verify each runner can dispatch the bin (cwd must be project root).
( cd "$FIXTURE" && node "$VIS" exec noopbin >/dev/null 2>&1 ) || { echo "vis exec failed" >&2; exit 1; }
( cd "$FIXTURE" && pnpm exec noopbin >/dev/null 2>&1 )        || { echo "pnpm exec failed" >&2; exit 1; }
( cd "$FIXTURE" && npm exec noopbin  >/dev/null 2>&1 )        || { echo "npm exec failed" >&2; exit 1; }

echo "================================================================"
echo "  Bin-runner DISPATCH benchmark — PURE-SHELL local .bin ('exit 0')"
echo "  (no node invocation — isolates vis exec/visx dispatch overhead)"
echo "  vis:  $(node "$VIS" --version 2>&1 | head -1)   ($VIS)"
echo "  pnpm: $(pnpm --version)   npm: $(npm --version)"
echo "  bun:  $([[ $HAS_BUN -eq 1 ]] && bun --version || echo '(absent)')"
echo "  warmup: $WARMUP  runs: $RUNS"
echo "  date: $(date)"
echo "================================================================"

OUTFILE="$RESULTS_DIR/bin-runner-${TIMESTAMP}.json"
mkdir -p "$RESULTS_DIR"

HF_ARGS=(
  --warmup "$WARMUP" --runs "$RUNS" --export-json "$OUTFILE"
  --command-name "vis exec"  "cd '$FIXTURE' && node '$VIS' exec noopbin"
  --command-name "pnpm exec" "cd '$FIXTURE' && pnpm exec noopbin"
  --command-name "npm exec"  "cd '$FIXTURE' && npm exec noopbin"
)
if [[ $HAS_BUN -eq 1 ]]; then
  ( cd "$FIXTURE" && bun x noopbin >/dev/null 2>&1 ) \
    && HF_ARGS+=( --command-name "bun x" "cd '$FIXTURE' && bun x noopbin" )
fi

hyperfine "${HF_ARGS[@]}"
echo ""
echo "  [results saved → $OUTFILE]"
echo "================================================================"
