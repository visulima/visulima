import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { removeSync } from "@visulima/fs";
import { dirname, join } from "@visulima/path";

/**
 * Timeout (ms) for the `vis release` *command* integration suites.
 *
 * These tests are not slow because of any one assertion — they shell out to
 * real `git` (4 spawns in fixture setup alone) and `pnpm` via `buildContext`,
 * and the *first* test in each worker additionally pays the cost of Vitest
 * transpiling the large `release/core` lazy-`import()` graph. On Windows CI,
 * where process spawn + fs are an order of magnitude slower, that cold-start
 * storm blows past Vitest's 30s default, the test times out mid-spawn, and the
 * still-running child leaves the temp workspace locked (EBUSY on cleanup).
 *
 * A generous ceiling removes the timeout (and therefore the EBUSY/stdout-leak
 * cascade it triggers) without masking a genuine hang — a real deadlock still
 * trips it, just later.
 */
export const RELEASE_SUITE_TIMEOUT = 120_000;

/**
 * `pristine` snapshot of `process.stdout.write`, captured at module load before
 * any test patches it. {@link restorePristineStdout} resets to this.
 */
const PRISTINE_STDOUT_WRITE: typeof process.stdout.write = process.stdout.write.bind(process.stdout);

/**
 * Unconditionally restore `process.stdout.write` to the implementation that was
 * live when this helper module loaded.
 *
 * Tests that capture stdout normally restore in a per-test `finally`, but a
 * test that *times out* never reaches that `finally` — its monkey-patch stays
 * installed and the next test's capture chains on top, so a straggler write
 * from the timed-out handler pollutes an unrelated test's buffer. Calling this
 * in `afterEach` guarantees every test starts from a clean stdout regardless of
 * how its predecessor ended.
 */
export const restorePristineStdout = (): void => {
    process.stdout.write = PRISTINE_STDOUT_WRITE;
};

/**
 * Remove a temp dir, tolerating Windows' lazy release of handles held by a
 * just-exited (or still-exiting) child process. `fs.rm`'s native retry rides
 * out the brief window where the OS still reports the dir busy (EBUSY/EPERM).
 * @param path Absolute path to the directory.
 */
export const removeTemporaryDirectoryWithRetry = async (path: string): Promise<void> => {
    await rm(path, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
};

/**
 * The `packageManager` value a temp workspace fixture should declare.
 *
 * A fixture that hardcodes e.g. `pnpm@10.0.0` while the test process runs a
 * different pnpm makes Corepack (or pnpm's own version management) download
 * the pinned version on first `pnpm` spawn. That download hangs on locked-down
 * Windows CI runners — `vis release` handlers that shell out to `pnpm -r ls`
 * during `buildContext` then time out, and the still-running child leaves the
 * tmp dir locked (EBUSY) for cleanup.
 *
 * Pinning the fixture to the already-running pnpm sidesteps the download
 * entirely. We read it from pnpm's user-agent (set whenever the suite runs
 * under `pnpm exec`, i.e. CI and local pnpm), falling back to this monorepo's
 * own pinned pnpm when the agent is absent (e.g. a raw `vitest` run).
 */
export const fixturePackageManager = (): string => {
    const userAgent = process.env["npm_config_user_agent"] ?? "";
    const fromAgent = /\bpnpm\/(\d[\w.+-]*)/.exec(userAgent);

    if (fromAgent) {
        return `pnpm@${fromAgent[1]}`;
    }

    try {
        // test-helpers.ts → packages/tooling/vis/__tests__/ ⇒ repo root is four up.
        const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "package.json");
        const { packageManager } = JSON.parse(readFileSync(root, "utf8")) as { packageManager?: string };

        if (typeof packageManager === "string" && packageManager.startsWith("pnpm@")) {
            return packageManager;
        }
    } catch {
        // Fall through to the conservative default below.
    }

    return "pnpm@10.0.0";
};

/**
 * Creates a fresh temporary directory and returns its absolute path.
 * Use together with {@link cleanupTemporaryDirectory} in `afterEach`
 * to avoid leaking fixtures between tests.
 *
 * Uses Node's `mkdtempSync` (no `@visulima/fs` equivalent exists for
 * "create a unique temp dir" — the rest of the helper uses `@visulima/fs`).
 * @param prefix Short prefix used for debugging.
 * @returns The absolute path to the created directory.
 */
export const createTemporaryDirectory = (prefix = "vis-test-"): string => mkdtempSync(join(tmpdir(), prefix));

/**
 * Removes a directory created by {@link createTemporaryDirectory}.
 * Safe to call even if the directory no longer exists.
 * @param path Absolute path to the directory.
 */
export const cleanupTemporaryDirectory = (path: string): void => {
    removeSync(path);
};

/**
 * A no-op logger that collects info/warn calls for assertions. Matches
 * the `MigrateLogger` shape consumed by migrate modules.
 */
export interface MockLogger {
    info: (message: string) => void;
    infoMessages: string[];
    warn: (message: string) => void;
    warnMessages: string[];
}

/**
 * Creates a mock logger that captures every message. Useful for
 * asserting on logged output in migration / command tests.
 * @returns A logger with `info`/`warn` methods plus message arrays.
 */
export const createMockLogger = (): MockLogger => {
    const infoMessages: string[] = [];
    const warnMessages: string[] = [];

    return {
        info: (message: string) => infoMessages.push(message),
        infoMessages,
        warn: (message: string) => warnMessages.push(message),
        warnMessages,
    };
};
