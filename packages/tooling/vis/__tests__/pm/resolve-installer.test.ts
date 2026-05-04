/**
 * Tests for the installer-backend resolution chain in pm-runner.ts.
 *
 * Precedence (highest first):
 *   1. CLI flag override (`backend`)
 *   2. `VIS_INSTALLER` env var
 *   3. `vis.config.ts` `install.backend`
 *   4. Auto-detect — aube on PATH else `detectPm` (lockfile-based)
 *
 * The native binding's `whichBin` is mocked to make PATH lookups
 * deterministic. The lockfile-detection fallback hits the real
 * filesystem via `detectPm`, which is exercised separately in
 * `pm-runner.test.ts`; here we run from the monorepo root so the
 * fallback consistently resolves to pnpm.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let availableBinaries = new Set<string>();

vi.mock(import("@visulima/vis/native"), async () => {
    const actual = await vi.importActual<typeof import("@visulima/vis/native")>("@visulima/vis/native");

    return {
        ...actual,
        whichBin: (name: string) => (availableBinaries.has(name) ? `/usr/local/bin/${name}` : null),
    };
});

const { resolveInstaller } = await import("../../src/pm/pm-runner");

const ORIGINAL_VIS_INSTALLER = process.env.VIS_INSTALLER;

beforeEach(() => {
    availableBinaries = new Set();
    delete process.env.VIS_INSTALLER;
});

afterEach(() => {
    if (ORIGINAL_VIS_INSTALLER === undefined) {
        delete process.env.VIS_INSTALLER;
    } else {
        process.env.VIS_INSTALLER = ORIGINAL_VIS_INSTALLER;
    }
});

describe("resolveInstaller precedence", () => {
    it("cLI flag wins over env var, config, and auto-detect", () => {
        expect.assertions(1);

        availableBinaries.add("aube");
        process.env.VIS_INSTALLER = "aube";

        const pm = resolveInstaller(process.cwd(), { backend: "pnpm", configBackend: "aube" });

        expect(pm.name).toBe("pnpm");
    });

    it("env var wins over config and auto-detect", () => {
        expect.assertions(1);

        availableBinaries.add("aube");
        process.env.VIS_INSTALLER = "npm";

        const pm = resolveInstaller(process.cwd(), { configBackend: "aube" });

        expect(pm.name).toBe("npm");
    });

    it("config wins over auto-detect", () => {
        expect.assertions(1);

        availableBinaries.add("aube");

        const pm = resolveInstaller(process.cwd(), { configBackend: "yarn" });

        expect(pm.name).toBe("yarn");
    });

    it("auto-detect picks aube when on PATH", () => {
        expect.assertions(1);

        availableBinaries.add("aube");

        const pm = resolveInstaller(process.cwd(), {});

        expect(pm.name).toBe("aube");
    });

    it("auto-detect falls back to detectPm when aube is not on PATH", () => {
        expect.assertions(1);

        // No binaries on PATH → detectPm runs against the real workspace.
        const pm = resolveInstaller(process.cwd(), {});

        // `detectPm` walks up looking for a lockfile; running from the
        // monorepo cwd this resolves to pnpm.
        expect(pm.name).toBe("pnpm");
    });

    it("explicit backend=auto behaves like no backend (auto-detect)", () => {
        expect.assertions(2);

        availableBinaries.add("aube");

        const cliAuto = resolveInstaller(process.cwd(), { backend: "auto" });
        const noFlag = resolveInstaller(process.cwd(), {});

        expect(cliAuto.name).toBe("aube");
        expect(noFlag.name).toBe("aube");
    });

    it("throws a friendly error when explicit backend=aube but aube is not on PATH", () => {
        expect.assertions(1);

        // No `aube` in availableBinaries.
        expect(() => resolveInstaller(process.cwd(), { backend: "aube" })).toThrow(/aube.*not on PATH/);
    });

    it("does not throw for explicit non-aube backends even if their binary is absent (detection is the user's responsibility once they've pinned the choice)", () => {
        expect.assertions(1);

        // We don't validate the existence of `npm`/`pnpm`/`yarn`/`bun` on
        // PATH because `vis` historically delegates that to the spawn
        // failure message — pinning to "npm" should not error here.
        expect(() => resolveInstaller(process.cwd(), { backend: "npm" })).not.toThrow();
    });
});
