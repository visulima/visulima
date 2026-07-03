#!/usr/bin/env bash
# Install benchmark: `vis install` vs pnpm / bun / npm.
# Full process wall-clock, frozen lockfile, warm + cold scenarios.
#
# vis install DELEGATES to the detected PM, so the headline number is vis's
# WRAPPER OVERHEAD over the raw PM (cf. nub's "+4.9ms shim"). We therefore also
# run the raw PM directly, so the delta is visible.
#
# Usage:
#   bash __bench__/cli/run-install.sh [--cold-only | --warm-only] [--fixture <name>]
#
# WARM (headline): warm PM store + lockfile present, node_modules WIPED, then a
# full OFFLINE reinstall — the apples-to-apples repeated-checkout / CI-restore
# number. Teardown is rename-aside in hyperfine --prepare and EXCLUDED from timing.
#
# Methodology ported from nubjs/nub tests/bench/run.sh (MIT), trimmed: vis has no
# aube global-virtual-store, so the GVS-pinning leg is dropped.
# Requires: hyperfine, pnpm, perl; bun + npm optional; dist/bin.js built.
set -euo pipefail

# Measure resolve + link, NOT postinstall build scripts: they're nondeterministic
# and trip pnpm v10's deny-by-default build policy (ERR_PNPM_IGNORED_BUILDS). The
# env var propagates to vis's delegated pnpm/npm too, so all legs are consistent.
export npm_config_ignore_scripts=true

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIS="${VIS:-$REPO_ROOT/dist/bin.js}"
case "$VIS" in /*) ;; *) VIS="$(cd "$(dirname "$VIS")" 2>/dev/null && pwd)/$(basename "$VIS")" ;; esac
FIXTURE_DIR="$REPO_ROOT/__bench__/cli/fixtures"
RESULTS_DIR="$REPO_ROOT/__bench__/cli/results"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

TRASH_DIR="$(mktemp -d "${TMPDIR:-/tmp}/vis-bench-trash-$$-XXXXXX")"
cleanup_trash() { rm -rf "$TRASH_DIR" 2>/dev/null || true; }
trap cleanup_trash EXIT

RUN_WARM=1; RUN_COLD=1; FIXTURE_FILTER=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cold-only) RUN_WARM=0 ;;
    --warm-only) RUN_COLD=0 ;;
    --fixture)   shift; FIXTURE_FILTER="${1:-}" ;;
    *) echo "WARN: unknown arg '$1'" >&2 ;;
  esac
  shift
done

HAS_BUN=0; command -v bun &>/dev/null && HAS_BUN=1

[[ -f "$VIS" ]] || { echo "ERROR: vis not built at $VIS — run 'pnpm run build' first." >&2; exit 1; }
command -v hyperfine &>/dev/null || { echo "ERROR: hyperfine not found (brew install hyperfine)." >&2; exit 1; }
command -v pnpm &>/dev/null || { echo "ERROR: pnpm not found." >&2; exit 1; }
command -v perl &>/dev/null || { echo "ERROR: perl not found (used for sub-ms timing)." >&2; exit 1; }
[[ -d "$FIXTURE_DIR" ]] || { echo "ERROR: no fixtures — run 'bash __bench__/cli/gen-fixtures.sh' first." >&2; exit 1; }

echo "================================================================"
echo "  Install benchmark: vis install (delegates) vs raw pnpm / bun / npm"
echo "  vis:  $(node "$VIS" --version 2>&1 | head -1)   ($VIS)"
echo "  pnpm: $(pnpm --version)   bun: $([[ $HAS_BUN -eq 1 ]] && bun --version || echo '(absent)')   npm: $(npm --version 2>/dev/null || echo '(absent)')"
echo "  date: $(date)"
echo "================================================================"
mkdir -p "$RESULTS_DIR"

# Copy a fixture to a fresh workdir, pruning foreign lockfiles for the tool.
setup_workdir() {
  local fixture="$1" workdir="$2" tool="${3:-}"
  rm -rf "$workdir"
  cp -r "$FIXTURE_DIR/$fixture" "$workdir"
  rm -rf "$workdir/node_modules" "$workdir"/packages/*/node_modules 2>/dev/null || true
  case "$tool" in
    pnpm|vis) rm -f "$workdir/bun.lock" "$workdir/bun.lockb" "$workdir/package-lock.json" 2>/dev/null || true ;;
    bun)      rm -f "$workdir/pnpm-lock.yaml" "$workdir/pnpm-workspace.yaml" "$workdir/package-lock.json" 2>/dev/null || true ;;
    npm)      rm -f "$workdir/bun.lock" "$workdir/bun.lockb" "$workdir/pnpm-lock.yaml" "$workdir/pnpm-workspace.yaml" 2>/dev/null || true ;;
  esac
}

# Rename-aside teardown for hyperfine --prepare (UNTIMED). Atomic mv + detached rm.
reset_cmd() {
  local wd="$1" trash="$TRASH_DIR/$(basename "$1")"
  echo "for nm in '$wd/node_modules' '$wd'/packages/*/node_modules; do [ -e \"\$nm\" ] && mv \"\$nm\" '$trash'-\$RANDOM-\$RANDOM 2>/dev/null; done; rm -rf '$trash'-* 2>/dev/null & true"
}

run_warm() {
  local fixture="$1" label="$2"
  local WD_PNPM="/tmp/vis-warm-pnpm-$$-$fixture" WD_VIS="/tmp/vis-warm-vis-$$-$fixture" WD_BUN="/tmp/vis-warm-bun-$$-$fixture"
  echo "──────────────────────────────────────────────"
  echo "  WARM — $label  (store+lockfile warm; node_modules wiped; offline reinstall)"
  echo "──────────────────────────────────────────────"

  setup_workdir "$fixture" "$WD_PNPM" pnpm
  setup_workdir "$fixture" "$WD_VIS"  vis
  echo "[setup] pre-populating pnpm store..."
  pnpm install --frozen-lockfile --dir "$WD_PNPM" --silent 2>/dev/null || true
  echo "[setup] pre-populating vis (delegated) install..."
  ( cd "$WD_VIS" && node "$VIS" install --frozen-lockfile ) >/dev/null 2>&1 || true

  local outfile="$RESULTS_DIR/install-warm-${fixture}-${TIMESTAMP}.json"
  # -i (ignore-failure): pnpm v10 exits 1 on ERR_PNPM_IGNORED_BUILDS (e.g. esbuild)
  # AFTER resolve+link completes — a build-policy notice, not an install failure.
  # The timed work is done; both legs hit it identically, so the comparison holds.
  local HF=(
    --warmup 3 --runs 12 -i
    --prepare "$(reset_cmd "$WD_PNPM")"
    --command-name "pnpm install (raw)" "pnpm install --frozen-lockfile --dir '$WD_PNPM' --silent"
    --prepare "$(reset_cmd "$WD_VIS")"
    --command-name "vis install (delegates→pnpm)" "cd '$WD_VIS' && node '$VIS' install --frozen-lockfile"
  )
  if [[ $HAS_BUN -eq 1 && -f "$FIXTURE_DIR/$fixture/bun.lock" ]]; then
    setup_workdir "$fixture" "$WD_BUN" bun
    bun install --frozen-lockfile --cwd "$WD_BUN" 2>/dev/null || true
    HF+=( --prepare "$(reset_cmd "$WD_BUN")" --command-name "bun install (ref)" "bun install --frozen-lockfile --cwd '$WD_BUN'" )
  fi

  hyperfine "${HF[@]}" --export-json "$outfile"
  echo "  [results → $outfile]"
  for wd in "$WD_PNPM" "$WD_VIS" "$WD_BUN"; do [[ -e "$wd" ]] && mv "$wd" "$TRASH_DIR/wd-$(basename "$wd")-$RANDOM" 2>/dev/null || true; done
  rm -rf "$TRASH_DIR"/wd-* 2>/dev/null & true
}

ms_now() { perl -MTime::HiRes=time -e 'printf "%d\n", time()*1000'; }

run_cold() {
  local fixture="$1" label="$2" RUNS=5
  echo "──────────────────────────────────────────────"
  echo "  COLD — $label  (empty stores cleared between each run)"
  echo "──────────────────────────────────────────────"
  local pnpm_times=() vis_times=()

  echo "[pnpm cold — $RUNS runs]"
  for i in $(seq 1 $RUNS); do
    local store="/tmp/vis-cold-pnpm-store-$$-$i" wd="/tmp/vis-cold-pnpm-wd-$$-$i"
    setup_workdir "$fixture" "$wd" pnpm; mkdir -p "$store"
    local t0; t0=$(ms_now)
    pnpm install --frozen-lockfile --dir "$wd" --silent --store-dir "$store" 2>/dev/null || true
    local t1; t1=$(ms_now); pnpm_times+=($((t1 - t0))); echo "  run $i: $((t1 - t0))ms"
    rm -rf "$wd" "$store"
  done

  echo "[vis cold — $RUNS runs]"
  for i in $(seq 1 $RUNS); do
    local store="/tmp/vis-cold-vis-store-$$-$i" wd="/tmp/vis-cold-vis-wd-$$-$i"
    setup_workdir "$fixture" "$wd" vis; mkdir -p "$store"
    local t0; t0=$(ms_now)
    ( cd "$wd" && pnpm config set store-dir "$store" --location project 2>/dev/null; node "$VIS" install --frozen-lockfile ) 2>/dev/null || true
    local t1; t1=$(ms_now); vis_times+=($((t1 - t0))); echo "  run $i: $((t1 - t0))ms"
    rm -rf "$wd" "$store"
  done

  local p_sum=0 v_sum=0
  for v in "${pnpm_times[@]}"; do p_sum=$((p_sum + v)); done
  for v in "${vis_times[@]}";  do v_sum=$((v_sum + v)); done
  echo ""
  echo "  COLD summary — $label:  pnpm $((p_sum / RUNS))ms   vis $((v_sum / RUNS))ms"
  printf '{"scenario":"cold","fixture":"%s","runs":%d,"pnpm_mean_ms":%d,"vis_mean_ms":%d}\n' \
    "$fixture" "$RUNS" "$((p_sum / RUNS))" "$((v_sum / RUNS))" > "$RESULTS_DIR/install-cold-${fixture}-${TIMESTAMP}.json"
}

# t3 = create-t3-app (Next/tRPC/Drizzle) — Bun's standard install-bench fixture,
# lifted from nubjs/nub so our numbers line up with nub's published table.
ALL_FIXTURES=( "simple|simple" "monorepo|monorepo (4 workspaces)" "t3|t3-app (create-t3-app, Bun's bench fixture)" )

[[ $RUN_WARM -eq 1 ]] && for entry in "${ALL_FIXTURES[@]}"; do
  IFS='|' read -r name label <<< "$entry"
  [[ -n "$FIXTURE_FILTER" && "$name" != "$FIXTURE_FILTER" ]] && continue
  [[ -d "$FIXTURE_DIR/$name" ]] && run_warm "$name" "$label"
done

[[ $RUN_COLD -eq 1 ]] && for entry in "${ALL_FIXTURES[@]}"; do
  IFS='|' read -r name label <<< "$entry"
  [[ -n "$FIXTURE_FILTER" && "$name" != "$FIXTURE_FILTER" ]] && continue
  [[ -d "$FIXTURE_DIR/$name" ]] && run_cold "$name" "$label"
done

echo "================================================================"
echo "  Done. Results: $RESULTS_DIR/"
echo "================================================================"
