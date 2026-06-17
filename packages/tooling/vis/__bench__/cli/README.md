# vis CLI benchmark harness

Wall-clock benchmarks for vis's hot paths — **script dispatch** (`vis run`), **bin dispatch** (`vis exec` / `visx`), and **install** (`vis install`) — measured against pnpm / npm / bun with [`hyperfine`](https://github.com/sharkdp/hyperfine).

The methodology is **ported from [`nubjs/nub`](https://github.com/nubjs/nub)'s `tests/bench/` suite** (MIT). The two load-bearing ideas we keep verbatim:

1. **Pure-shell `noop` payloads.** Dispatch benchmarks run a script/bin that is pure shell (`true` / `exit 0`), **never** `node -e …`. Node's ~40 ms cold startup would swamp the few-ms runner overhead and dilute the exact thing being measured.
2. **Rename-aside teardown, excluded from timing.** Install benchmarks wipe `node_modules` between runs via hyperfine `--prepare` (untimed) using an atomic `mv` to a trash dir + detached `rm`, so a tool's deletion cost (1–12 s for materialized stores) never leaks into the install number.

## Why this exists

vis is a **Node** CLI (`dist/bin.js`); nub is a single Rust binary. vis therefore _starts behind_ on raw dispatch — cerebro boot + jiti config load are real costs that `pnpm run` doesn't pay. **That gap is the point.** This harness establishes the baseline before the cross-runtime multi-tool work (see `rfc/design-runtime-multitool.md`), so the Phase 4 native hot-path work (local-first bin resolution, native script dispatch) can be measured against a number instead of a vibe.

## Prerequisites

```sh
brew install hyperfine          # macOS; see hyperfine README for Linux
pnpm --filter @visulima/vis run build   # produces dist/bin.js + dist/binx.js
```

`pnpm` and `npm` are required; `bun` is optional (added to the comparison when present).

## Running

```sh
# from packages/tooling/vis/
bash __bench__/cli/run-script-runner.sh      # vis run vs pnpm/npm/bun run
bash __bench__/cli/run-bin-runner.sh         # vis exec / visx vs pnpm/npm exec, bun x
bash __bench__/cli/run-install.sh            # vis install vs pnpm/bun/npm (warm + cold)
bash __bench__/cli/run-install.sh --warm-only --fixture simple
```

Each writes a hyperfine JSON export to `__bench__/cli/results/`. Override the binary under test with `VIS=/path/to/bin.js` (defaults to `./dist/bin.js`).

## Scenario → vis command map

| nub scenario           | nub command                     | vis equivalent                  | what it isolates                       |
| ---------------------- | ------------------------------- | ------------------------------- | -------------------------------------- |
| Script-runner dispatch | `nub run noop`                  | `vis run noop`                  | cerebro boot + script lookup + spawn   |
| Bin-runner dispatch    | `nub exec` / `nubx`             | `vis exec` / `visx`             | `node_modules/.bin` resolution + spawn |
| Install (warm)         | `nub install --frozen-lockfile` | `vis install --frozen-lockfile` | wrapper overhead over the delegated PM |
| Install (cold)         | empty stores                    | empty stores                    | full resolve + fetch + link            |

## nub's published targets (Apple M1 Max, Node v24.14.0)

These are the numbers to chase. vis will not match Rust dispatch today — record where we land and track it down.

**Script dispatch (`run noop`, pure-shell):**

| Command         | Mean       | vs nub |
| --------------- | ---------- | ------ |
| `nub run noop`  | **9.2 ms** | 1.0×   |
| `npm run noop`  | 104.0 ms   | 11.4×  |
| `pnpm run noop` | 160.9 ms   | 17.6×  |

**Bin dispatch (`exec esbuild --version`):**

| Command     | Mean        | vs nub |
| ----------- | ----------- | ------ |
| `nub exec`  | **11.2 ms** | 1.0×   |
| `pnpm exec` | 190.6 ms    | 17.0×  |
| `npx`       | 225.5 ms    | 20.1×  |

**TS file execution (informs the future `vis x`):** `bun hello.ts` 11.2 ms · `node hello.js` 25.8 ms · `nub hello.ts` 44.4 ms · `tsx hello.ts` 127.8 ms.

**PM shim overhead:** nub adds **+4.9 ms** over `node pnpm.cjs -v`; corepack adds +14.0 ms. This is the bar for `vis install`'s wrapper overhead — vis delegates to the PM, so its overhead-over-raw-PM is the comparable metric.

## Fixtures

Install fixtures mirror nub's: `simple` (~435 pkgs), `monorepo` (~407 pkgs / 4 workspaces), `t3` (Next/tRPC/Drizzle — Bun's create-t3-app bench), `large` (~1168 pkgs). Generate lockfiles with `bash __bench__/cli/gen-fixtures.sh` after editing a fixture's `package.json`. Each tool installs from its own lockfile family (`pnpm-lock.yaml`, `bun.lock`, `package-lock.json`); foreign lockfiles are pruned per-tool so no tool reads a stale lock.
