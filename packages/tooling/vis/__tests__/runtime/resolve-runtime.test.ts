/**
 * Tests for `resolveRuntime` — the cross-runtime selection chain.
 *
 * Precedence (highest first):
 *   1. `--runtime` flag
 *   2. `VIS_RUNTIME` env var
 *   3. `runtime:` config
 *   4. lockfile walk (bun.lock(b) → bun; npm/pnpm/yarn → node)
 *   5. default → node
 *
 * Pure fs + path, so this hits the real filesystem via temp dirs — no
 * `#native` binding involved. Deno is deferred: explicit requests hard-error;
 * a detected deno.lock falls back to node with a notice.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveRuntime } from "../../src/runtime/resolve-runtime";

let root: string;

const touch = (relative: string): void => {
    const full = join(root, relative);

    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, "");
};

describe(resolveRuntime, () => {
    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-resolve-runtime-"));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    describe("lockfile detection", () => {
        it("selects bun for bun.lock", () => {
            expect.hasAssertions();

            touch("bun.lock");

            const result = resolveRuntime(root, { env: {} });

            expect(result.runtime).toBe("bun");
            expect(result.source).toBe("lockfile");
        });

        it("selects bun for the legacy bun.lockb", () => {
            expect.hasAssertions();

            touch("bun.lockb");

            expect(resolveRuntime(root, { env: {} }).runtime).toBe("bun");
        });

        it.each(["pnpm-lock.yaml", "yarn.lock", "package-lock.json", "npm-shrinkwrap.json"])("selects node for %s", (lockfile) => {
            expect.hasAssertions();

            touch(lockfile);

            expect(resolveRuntime(root, { env: {} }).runtime).toBe("node");
        });

        it("walks up to a parent lockfile", () => {
            expect.hasAssertions();

            touch("bun.lock");
            mkdirSync(join(root, "packages", "app"), { recursive: true });

            const result = resolveRuntime(join(root, "packages", "app"), { env: {} });

            expect(result.runtime).toBe("bun");
        });

        it("defaults to node when no lockfile is found", () => {
            expect.hasAssertions();

            const result = resolveRuntime(root, { env: {} });

            expect(result.runtime).toBe("node");
            expect(result.source).toBe("default");
            expect(result.deferredNotice).toBeUndefined();
        });
    });

    describe("precedence", () => {
        it("flag beats env, config, and lockfile", () => {
            expect.hasAssertions();

            touch("pnpm-lock.yaml");

            const result = resolveRuntime(root, { config: "node", env: { VIS_RUNTIME: "node" }, flag: "bun" });

            expect(result.runtime).toBe("bun");
            expect(result.source).toBe("flag");
        });

        it("env beats config and lockfile", () => {
            expect.hasAssertions();

            touch("pnpm-lock.yaml");

            const result = resolveRuntime(root, { config: "node", env: { VIS_RUNTIME: "bun" } });

            expect(result.runtime).toBe("bun");
            expect(result.source).toBe("env");
        });

        it("config beats lockfile", () => {
            expect.hasAssertions();

            touch("bun.lock");

            const result = resolveRuntime(root, { config: "node", env: {} });

            expect(result.runtime).toBe("node");
            expect(result.source).toBe("config");
        });

        it("ignores empty flag/env and falls through to lockfile", () => {
            expect.hasAssertions();

            touch("bun.lock");

            const result = resolveRuntime(root, { env: { VIS_RUNTIME: "" }, flag: "" });

            expect(result.runtime).toBe("bun");
            expect(result.source).toBe("lockfile");
        });
    });

    describe("deferred runtimes (deno)", () => {
        it("hard-errors on an explicit --runtime deno", () => {
            expect.hasAssertions();
            expect(() => resolveRuntime(root, { env: {}, flag: "deno" })).toThrow(/not supported yet/i);
        });

        it("hard-errors on VIS_RUNTIME=deno", () => {
            expect.hasAssertions();
            expect(() => resolveRuntime(root, { env: { VIS_RUNTIME: "deno" } })).toThrow(/not supported yet/i);
        });

        it("falls back to node with a notice when deno.lock is detected", () => {
            expect.hasAssertions();

            touch("deno.lock");

            const result = resolveRuntime(root, { env: {} });

            expect(result.runtime).toBe("node");
            expect(result.deferredNotice).toMatch(/deno/i);
        });
    });

    describe("validation", () => {
        it("hard-errors on an unknown runtime", () => {
            expect.hasAssertions();
            expect(() => resolveRuntime(root, { env: {}, flag: "go" })).toThrow(/unknown runtime/i);
        });

        it("attaches the resolved adapter", () => {
            expect.hasAssertions();

            touch("bun.lock");

            const result = resolveRuntime(root, { env: {} });

            expect(result.adapter.id).toBe("bun");
            expect(result.adapter.scriptSource).toBe("package.json");
        });
    });
});
