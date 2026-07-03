/**
 * Unit tests for the corepack-passthrough wrapper, the per-PM
 * silent/dry-run post-processors, and the env-injecting spawn
 * fallback. Each helper is pure (with the exception of `spawnResolved`,
 * which we exercise against a known-safe `node` subprocess).
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let availableBinaries: Set<string>;

vi.mock(import("@visulima/vis/native"), async () => {
    const actual = await vi.importActual<typeof import("@visulima/vis/native")>("@visulima/vis/native");

    return {
        ...actual,
        whichBin: (name: string) => (availableBinaries.has(name) ? `/usr/local/bin/${name}` : null),
    };
});

const { pmRunnerInternals } = await import("../../src/pm/pm-runner");

const { applyCorepack, applyDlxOffline, applyDryRun, applyImmutableCache, applySilent, shouldUseCorepack, spawnResolved } = pmRunnerInternals;

const RESOLVED = (bin: string, args: string[]) => {
    return { args, bin, warnings: [] as string[] };
};

describe(applyCorepack, () => {
    beforeEach(() => {
        availableBinaries = new Set();
    });

    it("wraps a pnpm command when useCorepack is true", () => {
        expect.assertions(2);

        const wrapped = applyCorepack(RESOLVED("pnpm", ["install"]), { name: "pnpm", useCorepack: true, version: "10.0.0" });

        expect(wrapped.bin).toBe("corepack");
        expect(wrapped.args).toStrictEqual(["pnpm", "install"]);
    });

    it("is a no-op when useCorepack is false or undefined", () => {
        expect.assertions(2);

        expect(applyCorepack(RESOLVED("pnpm", ["install"]), { name: "pnpm", useCorepack: false, version: "10.0.0" }).bin).toBe("pnpm");

        expect(applyCorepack(RESOLVED("pnpm", ["install"]), { name: "pnpm", version: "10.0.0" }).bin).toBe("pnpm");
    });

    it("is a no-op for bun, deno, and aube even when useCorepack is true", () => {
        expect.assertions(3);

        expect(applyCorepack(RESOLVED("bun", ["install"]), { name: "bun", useCorepack: true, version: "1.0.0" }).bin).toBe("bun");
        expect(applyCorepack(RESOLVED("deno", ["install"]), { name: "deno", useCorepack: true, version: "1.0.0" }).bin).toBe("deno");
        expect(applyCorepack(RESOLVED("aube", ["install"]), { name: "aube", useCorepack: true, version: "1.0.0" }).bin).toBe("aube");
    });

    it("is idempotent when the resolved command is already wrapped", () => {
        expect.assertions(2);

        const already = RESOLVED("corepack", ["pnpm", "install"]);
        const result = applyCorepack(already, { name: "pnpm", useCorepack: true, version: "10.0.0" });

        expect(result.bin).toBe("corepack");
        expect(result.args).toStrictEqual(["pnpm", "install"]);
    });

    it("does not wrap a foreign bin (e.g. dispatcher rewrote pnpm 11 whoami → npm whoami)", () => {
        expect.assertions(2);

        // The subcommand dispatcher can rewrite to a different PM (npm
        // owner / npm whoami for pnpm 11). Wrapping that as
        // `corepack pnpm npm whoami` would re-route the call back through
        // pnpm — exactly what the rewrite was trying to avoid.
        const rewritten = RESOLVED("npm", ["whoami"]);
        const result = applyCorepack(rewritten, { name: "pnpm", useCorepack: true, version: "11.0.0" });

        expect(result.bin).toBe("npm");
        expect(result.args).toStrictEqual(["whoami"]);
    });
});

describe(shouldUseCorepack, () => {
    let tmp: string;

    beforeEach(() => {
        availableBinaries = new Set();
        tmp = mkdtempSync(join(tmpdir(), "vis-corepack-test-"));
    });

    afterEach(() => {
        rmSync(tmp, { force: true, recursive: true });
    });

    it("returns false when mode is explicitly false", () => {
        expect.assertions(1);

        availableBinaries.add("corepack");
        writeFileSync(join(tmp, "package.json"), JSON.stringify({ packageManager: "pnpm@10.0.0" }));

        expect(shouldUseCorepack(tmp, "pnpm", false)).toBe(false);
    });

    it("returns false for PMs corepack does not manage (bun, deno, aube)", () => {
        expect.assertions(3);

        availableBinaries.add("corepack");
        writeFileSync(join(tmp, "package.json"), JSON.stringify({ packageManager: "pnpm@10.0.0" }));

        expect(shouldUseCorepack(tmp, "bun", true)).toBe(false);
        expect(shouldUseCorepack(tmp, "deno", true)).toBe(false);
        expect(shouldUseCorepack(tmp, "aube", true)).toBe(false);
    });

    it("returns false when corepack is not on PATH, even with mode=true", () => {
        expect.assertions(1);

        writeFileSync(join(tmp, "package.json"), JSON.stringify({ packageManager: "pnpm@10.0.0" }));

        expect(shouldUseCorepack(tmp, "pnpm", true)).toBe(false);
    });

    it("auto mode requires both corepack on PATH and a packageManager pin", () => {
        expect.assertions(3);

        availableBinaries.add("corepack");

        writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "no-pin" }));

        expect(shouldUseCorepack(tmp, "pnpm", "auto")).toBe(false);

        writeFileSync(join(tmp, "package.json"), JSON.stringify({ packageManager: "pnpm@10.0.0" }));

        expect(shouldUseCorepack(tmp, "pnpm", "auto")).toBe(true);

        availableBinaries.delete("corepack");

        expect(shouldUseCorepack(tmp, "pnpm", "auto")).toBe(false);
    });

    it("explicit true does not require a packageManager pin", () => {
        expect.assertions(1);

        availableBinaries.add("corepack");
        writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "no-pin" }));

        expect(shouldUseCorepack(tmp, "pnpm", true)).toBe(true);
    });
});

describe(applySilent, () => {
    it("appends --quiet for deno and --silent for every other PM", () => {
        expect.assertions(5);

        for (const pm of ["npm", "pnpm", "bun", "yarn", "aube"] as const) {
            const out = applySilent(RESOLVED(pm, []), pm);

            expect(out.args).toStrictEqual(["--silent"]);
        }
    });

    it("uses --quiet for deno", () => {
        expect.assertions(1);

        const out = applySilent(RESOLVED("deno", []), "deno");

        expect(out.args).toStrictEqual(["--quiet"]);
    });
});

describe(applyDryRun, () => {
    it("appends --dry-run for npm, pnpm, bun, and deno", () => {
        expect.assertions(4);

        for (const pm of ["npm", "pnpm", "bun", "deno"] as const) {
            const out = applyDryRun(RESOLVED(pm, ["install"]), pm);

            expect(out?.args).toStrictEqual(["install", "--dry-run"]);
        }
    });

    it("returns null for yarn (no native dry-run on add/install)", () => {
        expect.assertions(1);

        expect(applyDryRun(RESOLVED("yarn", ["add", "react"]), "yarn")).toBeNull();
    });

    it("returns null for aube (no native dry-run)", () => {
        expect.assertions(1);

        expect(applyDryRun(RESOLVED("aube", ["install"]), "aube")).toBeNull();
    });
});

describe(applyImmutableCache, () => {
    it("appends --immutable-cache to a yarn berry frozen install", () => {
        expect.assertions(1);

        const out = applyImmutableCache(RESOLVED("yarn", ["install", "--immutable"]), "yarn", "4.0.0");

        expect(out.args).toStrictEqual(["install", "--immutable", "--immutable-cache"]);
    });

    it("is a no-op for yarn classic (no --immutable surface)", () => {
        expect.assertions(1);

        const out = applyImmutableCache(RESOLVED("yarn", ["install", "--frozen-lockfile"]), "yarn", "1.22.0");

        expect(out.args).toStrictEqual(["install", "--frozen-lockfile"]);
    });

    it("is a no-op when --immutable is absent (yarn rejects --immutable-cache standalone)", () => {
        expect.assertions(1);

        const out = applyImmutableCache(RESOLVED("yarn", ["install"]), "yarn", "4.0.0");

        expect(out.args).toStrictEqual(["install"]);
    });

    it("is idempotent — does not double-append", () => {
        expect.assertions(1);

        const out = applyImmutableCache(RESOLVED("yarn", ["install", "--immutable", "--immutable-cache"]), "yarn", "4.0.0");

        expect(out.args).toStrictEqual(["install", "--immutable", "--immutable-cache"]);
    });

    it("is a no-op for non-yarn PMs", () => {
        expect.assertions(5);

        for (const pm of ["npm", "pnpm", "bun", "deno", "aube"] as const) {
            const out = applyImmutableCache(RESOLVED(pm, ["install", "--immutable"]), pm, "1.0.0");

            expect(out.args).toStrictEqual(["install", "--immutable"]);
        }
    });
});

describe(applyDlxOffline, () => {
    it("splices --offline after the dlx subcommand for pnpm", () => {
        expect.assertions(1);

        const out = applyDlxOffline(RESOLVED("pnpm", ["dlx", "--silent", "cowsay", "hello"]), "pnpm", "10.0.0");

        expect(out.args).toStrictEqual(["dlx", "--offline", "--silent", "cowsay", "hello"]);
    });

    it("splices --offline after exec for npm", () => {
        expect.assertions(1);

        const out = applyDlxOffline(RESOLVED("npm", ["exec", "--yes", "--", "cowsay"]), "npm", "10.0.0");

        expect(out.args).toStrictEqual(["exec", "--offline", "--yes", "--", "cowsay"]);
    });

    it("splices --offline before --yes for yarn classic (npx fallback)", () => {
        expect.assertions(1);

        // yarn classic dlx is rewritten to npx by the Rust resolver (bin: "npx").
        // For the post-process we only need pm + version; bin is unchanged.
        const out = applyDlxOffline(RESOLVED("npx", ["--yes", "cowsay"]), "yarn", "1.22.0");

        expect(out.args).toStrictEqual(["--offline", "--yes", "cowsay"]);
    });

    it("warns instead of inserting for yarn berry (no offline dlx flag)", () => {
        expect.assertions(2);

        const out = applyDlxOffline(RESOLVED("yarn", ["dlx", "cowsay"]), "yarn", "4.0.0");

        expect(out.args).toStrictEqual(["dlx", "cowsay"]);
        expect(out.warnings.some((w) => w.includes("yarn berry has no --offline flag"))).toBe(true);
    });

    it("warns instead of inserting for bun", () => {
        expect.assertions(2);

        const out = applyDlxOffline(RESOLVED("bun", ["x", "cowsay"]), "bun", "1.2.0");

        expect(out.args).toStrictEqual(["x", "cowsay"]);
        expect(out.warnings.some((w) => w.includes("bun x does not support --offline"))).toBe(true);
    });

    it("uses --cached-only for deno", () => {
        expect.assertions(1);

        const out = applyDlxOffline(RESOLVED("deno", ["run", "-A", "npm:cowsay"]), "deno", "2.0.0");

        expect(out.args).toStrictEqual(["run", "--cached-only", "-A", "npm:cowsay"]);
    });

    it("is idempotent — does not double-insert when --offline is already present", () => {
        expect.assertions(1);

        const out = applyDlxOffline(RESOLVED("pnpm", ["dlx", "--offline", "cowsay"]), "pnpm", "10.0.0");

        expect(out.args).toStrictEqual(["dlx", "--offline", "cowsay"]);
    });

    it("is idempotent for deno (--cached-only already present)", () => {
        expect.assertions(1);

        const out = applyDlxOffline(RESOLVED("deno", ["run", "--cached-only", "-A", "npm:cowsay"]), "deno", "2.0.0");

        expect(out.args).toStrictEqual(["run", "--cached-only", "-A", "npm:cowsay"]);
    });
});

describe(spawnResolved, () => {
    it("inherits process.env when env is undefined (native fast path)", () => {
        expect.assertions(1);

        // node -e exits 0 successfully under the native NAPI path.
        const code = spawnResolved(RESOLVED("node", ["-e", "process.exit(0)"]), process.cwd());

        expect(code).toBe(0);
    });

    it("forwards override env via spawnSync when env is provided", () => {
        expect.assertions(1);

        // The subprocess exits with the numeric value of VIS_TEST_ENV.
        // If env injection works, exit code is 7; otherwise it would
        // be NaN → 1 (spawnSync default).
        const code = spawnResolved(RESOLVED("node", ["-e", "process.exit(parseInt(process.env.VIS_TEST_ENV, 10))"]), process.cwd(), { VIS_TEST_ENV: "7" });

        expect(code).toBe(7);
    });
});
