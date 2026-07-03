import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runConcurrently } from "../../src/concurrent";

/**
 * Regression coverage for the `vis run build` → `packem build` failure:
 * before the PATH-enhancement chokepoint landed, bare binary names from
 * `package.json` scripts didn't resolve because the runner inherited
 * `process.env` without the `node_modules/.bin` chain `npm run` /
 * `pnpm run` set up. These tests spawn through `runConcurrently` against
 * a real on-disk shim to make sure both the native Rust path and the JS
 * fallback (forced via `onEvent`) pick the shim up.
 */

const isWindows = process.platform === "win32";
const SENTINEL = "visulima-bin-resolution-ok";

const createTempWorkspace = async (name: string): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

const writeBinShim = async (binDirectory: string, shimName: string, sentinel: string): Promise<void> => {
    await mkdir(binDirectory, { recursive: true });

    if (isWindows) {
        const file = join(binDirectory, `${shimName}.cmd`);

        await writeFile(file, `@echo off\r\necho ${sentinel}\r\n`);

        return;
    }

    const file = join(binDirectory, shimName);

    await writeFile(file, `#!/bin/sh\necho ${sentinel}\n`);
    await chmod(file, 0o755);
};

describe("bin path resolution end-to-end", () => {
    let workspace: string;

    beforeEach(async () => {
        workspace = await createTempWorkspace("bin-path");
    });

    afterEach(async () => {
        await rm(workspace, { force: true, recursive: true });
    });

    it("resolves a bare binary from the cwd's node_modules/.bin (native path)", async () => {
        expect.assertions(2);

        const shim = "visulima-shim-cwd";

        await writeBinShim(join(workspace, "node_modules", ".bin"), shim, SENTINEL);

        const result = await runConcurrently([{ command: shim, cwd: workspace }]);

        expect(result.success).toBe(true);
        expect(result.closeEvents[0]!.exitCode).toBe(0);
    });

    it("resolves a bare binary from an ancestor node_modules/.bin (workspace root shadow)", async () => {
        expect.assertions(2);

        const shim = "visulima-shim-root";
        const subPackage = join(workspace, "packages", "child");

        await mkdir(subPackage, { recursive: true });
        // Only the workspace-root .bin gets the shim — cwd is the subpackage.
        await writeBinShim(join(workspace, "node_modules", ".bin"), shim, SENTINEL);

        const result = await runConcurrently([{ command: shim, cwd: subPackage }]);

        expect(result.success).toBe(true);
        expect(result.closeEvents[0]!.exitCode).toBe(0);
    });

    it("prefers the per-package shim over the workspace-root shim (cwd-nearest wins)", async () => {
        expect.assertions(2);

        const shim = "visulima-shim-shadow";
        const subPackage = join(workspace, "packages", "child");
        const events: string[] = [];

        await mkdir(subPackage, { recursive: true });
        await writeBinShim(join(workspace, "node_modules", ".bin"), shim, "root-version");
        await writeBinShim(join(subPackage, "node_modules", ".bin"), shim, "package-version");

        // `onEvent` forces the JS fallback path, so this also covers
        // the fallback branch of `coreRun`.
        const result = await runConcurrently([{ command: shim, cwd: subPackage }], {
            onEvent: (event) => {
                if (event.kind === "stdout") {
                    events.push(event.text);
                }
            },
        });

        expect(result.success).toBe(true);
        expect(events.join("")).toContain("package-version");
    });

    it("captures the shim's stdout via the JS fallback (proves PATH applies to the fallback path)", async () => {
        expect.assertions(2);

        const shim = "visulima-shim-fallback";
        const events: string[] = [];

        await writeBinShim(join(workspace, "node_modules", ".bin"), shim, SENTINEL);

        const result = await runConcurrently([{ command: shim, cwd: workspace }], {
            onEvent: (event) => {
                if (event.kind === "stdout") {
                    events.push(event.text);
                }
            },
        });

        expect(result.success).toBe(true);
        expect(events.join("")).toContain(SENTINEL);
    });
});
