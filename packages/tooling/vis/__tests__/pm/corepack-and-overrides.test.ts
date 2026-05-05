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

const { applyCorepack, applyDryRun, applySilent, shouldUseCorepack, spawnResolved } = pmRunnerInternals;

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
        const code = spawnResolved(
            RESOLVED("node", ["-e", "process.exit(parseInt(process.env.VIS_TEST_ENV, 10))"]),
            process.cwd(),
            { VIS_TEST_ENV: "7" },
        );

        expect(code).toBe(7);
    });
});
