import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

import { removeSync } from "@visulima/fs";
import { join } from "@visulima/path";

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
    warn: (message: string) => void;
    infoMessages: string[];
    warnMessages: string[];
}

/**
 * Creates a mock logger that captures every message. Useful for
 * asserting on logged output in migration / command tests.
 *
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
