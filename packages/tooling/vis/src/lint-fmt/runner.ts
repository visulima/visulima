import { spawnSync } from "node:child_process";

import type { AdapterRunOptions, RunResult, ToolAdapter, ToolPresence } from "./config-types";

/**
 * Invoke a tool adapter against a file list. Synchronous because the
 * underlying tools (eslint, prettier) are CPU-bound and we already
 * fan out across adapters at a higher level.
 *
 * `mode` controls whether to dry-run (`check`) or write fixes
 * (`fix`). The runner doesn't know the difference — it just picks
 * `argsCheck` vs `argsFix`.
 *
 * Cache integration is a TODO — for the Phase 1 MVP this spawns
 * unconditionally. The cache key returned by `adapter.cacheKey()`
 * is the hook the cache layer will mix with file content hashes.
 */
export const runAdapter = (
    adapter: ToolAdapter,
    presence: ToolPresence,
    files: ReadonlyArray<string>,
    options: AdapterRunOptions,
    mode: "check" | "fix",
): RunResult => {
    const bin = adapter.bin(presence);
    const args = [...bin.slice(1), ...(mode === "fix" ? adapter.argsFix(files, options) : adapter.argsCheck(files, options))];

    const start = Date.now();
    const result = spawnSync(bin[0]!, args, {
        cwd: presence.root,
        encoding: "utf8",
        // 60s ceiling. ESLint can be slow but anything past a minute
        // on a single batch is almost always a misconfiguration.
        timeout: 60_000,
    });

    return {
        durationMs: Date.now() - start,
        exitCode: result.status,
        stderr: result.stderr ?? "",
        stdout: result.stdout ?? "",
    };
};
