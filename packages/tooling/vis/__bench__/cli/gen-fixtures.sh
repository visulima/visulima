#!/usr/bin/env bash
# Regenerate committed lockfiles for the install-benchmark fixtures.
#
# IMPORTANT: these fixtures live INSIDE the visulima monorepo, so installing
# in place makes pnpm/npm walk UP and install the parent workspace. We therefore
# generate each lockfile in an ISOLATED /tmp copy (outside the monorepo) and copy
# the resulting lockfiles back into the committed fixture. The `simple` fixture
# also needs a workspace-root marker in the isolated copy so pnpm treats it as
# its own root.
#
# t3 ships nub's committed lockfiles (for parity with nub's table) and is NOT
# regenerated here. Run once before run-install.sh; re-run after editing a
# fixture's package.json.  Ported from nubjs/nub tests/bench/gen-fixtures.sh (MIT).
set -euo pipefail

FIXTURE_DIR="$(cd "$(dirname "$0")" && pwd)/fixtures"
HAS_BUN=0; command -v bun &>/dev/null && HAS_BUN=1
HAS_NPM=0; command -v npm &>/dev/null && HAS_NPM=1

gen() {
  local dir="$1"
  echo "=== $dir ==="
  local work; work="$(mktemp -d "/tmp/vis-genfix-$dir-XXXXXX")"
  cp -r "$FIXTURE_DIR/$dir/." "$work/"
  rm -rf "$work/node_modules" "$work"/packages/*/node_modules
  # Standalone (non-workspace) fixtures need a root marker so pnpm doesn't climb.
  [[ -f "$work/pnpm-workspace.yaml" ]] || printf 'packages: []\n' > "$work/pnpm-workspace.yaml"
  (
    cd "$work"
    pnpm install --no-frozen-lockfile --ignore-scripts >/dev/null 2>&1 || pnpm install --no-frozen-lockfile --ignore-scripts
    [[ $HAS_BUN -eq 1 ]] && { bun install --ignore-scripts >/dev/null 2>&1 || true; }
    [[ $HAS_NPM -eq 1 ]] && { npm install --package-lock-only --ignore-scripts >/dev/null 2>&1 || true; }
  )
  # Copy generated lockfiles back into the committed fixture (NOT the temp marker).
  for lf in pnpm-lock.yaml bun.lock bun.lockb package-lock.json; do
    [[ -f "$work/$lf" ]] && cp "$work/$lf" "$FIXTURE_DIR/$dir/$lf" && echo "  → $lf"
  done
  rm -rf "$work"
}

gen simple
gen monorepo
echo "Done. Commit the updated lockfiles under __bench__/cli/fixtures/."
