/**
 * Tests for the command ↔ runtime bridge (Phase 1). Verifies that the global
 * `--runtime` flag and `runtime:` config steer the resolution, and that a
 * resolved `bun` runtime forces the bun installer backend.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveCommandRuntime, runtimeInstallerBackend } from "../../src/runtime/command-runtime";

let root: string;
let savedEnv: string | undefined;

describe("command runtime bridge", () => {
    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-command-runtime-"));
        // resolveRuntime reads process.env.VIS_RUNTIME; isolate the default-case tests.
        savedEnv = process.env.VIS_RUNTIME;
        delete process.env.VIS_RUNTIME;
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });

        if (savedEnv === undefined) {
            delete process.env.VIS_RUNTIME;
        } else {
            process.env.VIS_RUNTIME = savedEnv;
        }
    });

    it("forces the bun backend when --runtime bun is passed", () => {
        expect.hasAssertions();

        const resolution = resolveCommandRuntime({ options: { runtime: "bun" } }, root);

        expect(resolution.runtime).toBe("bun");
        expect(runtimeInstallerBackend(resolution)).toBe("bun");
    });

    it("does not override the backend for node", () => {
        expect.hasAssertions();

        const resolution = resolveCommandRuntime({ options: {} }, root);

        expect(resolution.runtime).toBe("node");
        expect(runtimeInstallerBackend(resolution)).toBeUndefined();
    });

    it("reads runtime from vis config", () => {
        expect.hasAssertions();

        const resolution = resolveCommandRuntime({ visConfig: { runtime: "bun" } }, root);

        expect(resolution.runtime).toBe("bun");
    });
});
