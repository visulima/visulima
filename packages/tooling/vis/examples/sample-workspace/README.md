# Sample Workspace — TUI Demo

A minimal monorepo workspace for testing vis CLI features.

## Structure

```
packages/
  app-a/   — depends on lib-b, has build/test/lint scripts with sleep delays
  lib-b/   — depends on lib-c
  lib-c/   — leaf package
```

## Usage

From the **monorepo root** (`visulima/`), first build the packages:

```bash
pnpm --filter "@visulima/task-runner" run build
pnpm --filter "@visulima/vis" run build
```

Then run vis against this example workspace using `--cwd`:

```bash
# Dynamic TUI (interactive terminal with spinners)
node packages/tooling/vis/dist/bin.js run build --cwd=packages/tooling/vis/examples/sample-workspace

# Test target
node packages/tooling/vis/dist/bin.js run test --cwd=packages/tooling/vis/examples/sample-workspace

# Lint target (fast, no sleep)
node packages/tooling/vis/dist/bin.js run lint --cwd=packages/tooling/vis/examples/sample-workspace

# Force static/CI output (no cursor manipulation)
CI=true node packages/tooling/vis/dist/bin.js run build --cwd=packages/tooling/vis/examples/sample-workspace

# Run specific projects only
node packages/tooling/vis/dist/bin.js run build --cwd=packages/tooling/vis/examples/sample-workspace --projects=app-a,lib-b

# With 5 parallel tasks
node packages/tooling/vis/dist/bin.js run build --cwd=packages/tooling/vis/examples/sample-workspace --parallel=5
```

## What to look for

- **Dynamic TUI (TTY):** Spinning indicators for running tasks, live-updating footer with remaining/succeeded/failed counts, colored result lines as tasks complete, final summary.
- **Static output (CI):** Linear append-only log with task start markers, colored result lines, skipped task detection on failure, structured summary.
- **Cache hits:** Run the same target twice — second run shows `[cache]` indicators.
- **Failure handling:** Add a failing script to a package.json and re-run to see error summaries.
