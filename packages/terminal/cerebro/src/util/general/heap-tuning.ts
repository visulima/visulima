/**
 * Dynamic V8 heap memory tuning based on system memory.
 *
 * This helper computes optimal `--max-old-space-size` and `--max-semi-space-size`
 * flags for Node.js/Bun, then re-spawns the process with those flags applied.
 * If the flags are already set (via `NODE_OPTIONS` or direct CLI arguments),
 * the user's values are respected and no re-spawn occurs.
 *
 * ## When to use
 *
 * Import this helper **before** any heavy work — ideally as the very first
 * import in your CLI entry point. Because V8 memory flags can only be set at
 * process startup, this helper works by re-spawning the current process with
 * the computed flags when they are missing. After re-spawn, the module detects
 * that flags are already present and becomes a no-op.
 *
 * ## How to use
 *
 * Call `applyHeapTuning()` as early as possible in your CLI entry point,
 * **before** creating the cerebro instance or importing heavy modules:
 *
 * ```typescript
 * // bin.ts
 * import { applyHeapTuning } from "@visulima/cerebro/heap-tuning";
 *
 * // Apply with defaults (75% of system RAM)
 * applyHeapTuning();
 *
 * // Or customize the allocation percentage
 * applyHeapTuning({ maxOldSpacePercent: 0.5 });
 *
 * import { createCerebro } from "@visulima/cerebro";
 * // ... rest of your CLI setup
 * ```
 *
 * If heap tuning is needed, `applyHeapTuning()` re-spawns the process and
 * **never returns** — subsequent code in the parent is not reached. After
 * re-spawn, the flags are already set so the call becomes a no-op.
 *
 * ## How it works
 *
 * 1. Checks `process.execArgv` for existing `--max-old-space-size` and
 *    `--max-semi-space-size` flags.
 * 2. If both are present, returns immediately (no-op).
 * 3. Otherwise, computes defaults:
 *    - `--max-old-space-size`: percentage of total system memory (default 75%)
 *    - `--max-semi-space-size`: tiered scaling based on old-space size
 * 4. Re-spawns the current process via `execFileSync` with the computed flags
 *    prepended to `execArgv`, then exits the parent with the child's exit code.
 *
 * ## Semi-space sizing tiers
 *
 * | Old-space (MiB) | Semi-space (MiB) |
 * |-----------------|-----------------|
 * | &lt;= 512          | 4               |
 * | &lt;= 1024         | 8               |
 * | &lt;= 2048         | 16              |
 * | &lt;= 4096         | 32              |
 * | &lt;= 8192         | 64              |
 * | > 8192          | log2-scaled     |
 * @module
 */

// NOTE: execFileSync is safe here — we only pass the runtime's own executable
// path (process.execPath) with computed numeric flags, never user input.
import { execFileSync } from "node:child_process";
import { totalmem } from "node:os";

import { exitProcess, getArgv, getEnv, getExecArgv, getExecPath } from "./runtime-process";

const MAX_OLD_SPACE_RE = /--max-old-space-size=(\d+)/;
const MAX_SEMI_SPACE_RE = /--max-semi-space-size=(\d+)/;

interface HeapTuningOptions {
    /**
     * Fraction of total system memory to allocate as `--max-old-space-size`.
     * Must be between 0 and 1. Default: `0.75` (75%).
     */
    maxOldSpacePercent?: number;
}

// SYNC NOTE: this heuristic (old = floor(RAM * percent), semi = the tier table
// below) is mirrored in Rust at packages/tooling/vis/launcher/src/heap.rs, which
// applies the same flags natively when the vis launcher fronts Node. If you change
// the formula or the tiers here, update that file too (its unit test pins the
// expected values, so a drift surfaces there).

/** Compute `--max-old-space-size` in MiB from a percentage of total system RAM. */
const getDefaultMaxOldSpaceSize = (percent: number): number => Math.floor((totalmem() / 1024 / 1024) * percent);

/**
 * Compute `--max-semi-space-size` in MiB based on old-space size.
 *
 * Uses tiered scaling for heaps &lt;= 8 GiB and logarithmic scaling above.
 * Each 1 MiB of semi-space adds ~3 MiB to the young generation
 * (V8 maintains 3 semi-spaces internally).
 */
const getSemiSpaceSize = (maxOldSpaceMiB: number): number => {
    if (maxOldSpaceMiB <= 512) {
        return 4;
    }

    if (maxOldSpaceMiB <= 1024) {
        return 8;
    }

    if (maxOldSpaceMiB <= 2048) {
        return 16;
    }

    if (maxOldSpaceMiB <= 4096) {
        return 32;
    }

    if (maxOldSpaceMiB <= 8192) {
        return 64;
    }

    return Math.floor(Math.log2(maxOldSpaceMiB)) * 8;
};

/** Extract a numeric V8 flag value from execArgv. */
const extractFlag = (regex: RegExp, execArgv: ReadonlyArray<string>): number | undefined => {
    for (const argument of execArgv) {
        const match = regex.exec(argument);

        if (match) {
            return Number.parseInt(match[1] as string, 10);
        }
    }

    return undefined;
};

/**
 * Apply heap memory tuning to the current process.
 *
 * When tuning is needed, this function re-spawns the process with computed
 * V8 memory flags and **never returns** — the parent exits with the child's
 * exit code. When no tuning is needed (flags already set), it returns
 * immediately.
 * @param options Optional configuration for heap tuning.
 */
const applyHeapTuning = (options?: HeapTuningOptions): void => {
    const percent = options?.maxOldSpacePercent ?? 0.75;
    const execArgv = [...getExecArgv()];
    const argv = [...getArgv()];

    const existingOldSpace = extractFlag(MAX_OLD_SPACE_RE, execArgv);
    const existingSemiSpace = extractFlag(MAX_SEMI_SPACE_RE, execArgv);

    if (existingOldSpace !== undefined && existingSemiSpace !== undefined) {
        return;
    }

    const oldSpace = existingOldSpace ?? getDefaultMaxOldSpaceSize(percent);
    const semiSpace = existingSemiSpace ?? getSemiSpaceSize(oldSpace);

    const extraFlags: string[] = [];

    if (existingOldSpace === undefined) {
        extraFlags.push(`--max-old-space-size=${String(oldSpace)}`);
    }

    if (existingSemiSpace === undefined) {
        extraFlags.push(`--max-semi-space-size=${String(semiSpace)}`);
    }

    if (extraFlags.length === 0) {
        return;
    }

    try {
        execFileSync(getExecPath(), [...extraFlags, ...execArgv, ...argv.slice(1)], {
            env: getEnv(),
            stdio: "inherit",
        });

        exitProcess(0);
    } catch (error: unknown) {
        const code = (error as { status?: number }).status;

        exitProcess(typeof code === "number" ? code : 1);
    }
};

export type { HeapTuningOptions };
export { applyHeapTuning };
