/**
 * Tests for the command ↔ runtime bridge (Phase 1). Verifies that the global
 * `--runtime` flag and `runtime:` config steer the resolution, that a resolved
 * `bun` runtime forces the bun installer backend, and that a detected deferred
 * runtime (deno.lock) warns on the logger rather than silently falling back.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

    it("warns and falls back to node when a deno project is detected", () => {
        expect.hasAssertions();

        writeFileSync(join(root, "deno.lock"), "");
        const warn = vi.fn();

        const resolution = resolveCommandRuntime({ logger: { warn }, options: {} }, root);

        expect(resolution.runtime).toBe("node");
        expect(warn).toHaveBeenCalledWith(expect.stringMatching(/deno/i));
    });

    it("hard-errors on an explicit deno request", () => {
        expect.hasAssertions();

        expect(() => resolveCommandRuntime({ options: { runtime: "deno" } }, root)).toThrow(/not supported yet/i);
    });
});
