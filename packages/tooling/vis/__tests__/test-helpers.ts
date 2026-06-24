import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { removeSync } from "@visulima/fs";
import { dirname, join } from "@visulima/path";

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
