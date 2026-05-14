/**
 * Tests for `resolveAuditBackend` and `mapSeverityToAube` from
 * `commands/audit/handler.ts`.
 *
 * Precedence chain (highest first):
 *   1. CLI flag (`--backend`)
 *   2. `VIS_AUDIT_BACKEND` env var
 *   3. `vis.config.ts` `security.audit.backend`
 *   4. Default `auto` — delegates to aube only when the active
 *      installer is aube AND `aube` is on PATH
 *
 * `whichBin` is mocked so PATH lookups stay deterministic; the
 * `VIS_INSTALLER` and `VIS_AUDIT_BACKEND` env vars are restored after
 * each test so a failure can't pollute later runs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let availableBinaries: Set<string>;

vi.mock(import("@visulima/vis/native"), async () => {
    const actual = await vi.importActual<typeof import("@visulima/vis/native")>("@visulima/vis/native");

    return {
        ...actual,
        whichBin: (name: string) => (availableBinaries.has(name) ? `/usr/local/bin/${name}` : null),
    };
});

const { mapSeverityToAube, resolveAuditBackend } = await import("../../../src/commands/audit/handler");

const ORIGINAL_VIS_INSTALLER = process.env.VIS_INSTALLER;
const ORIGINAL_VIS_AUDIT_BACKEND = process.env.VIS_AUDIT_BACKEND;

describe(resolveAuditBackend, () => {
    beforeEach(() => {
        availableBinaries = new Set();
        delete process.env.VIS_INSTALLER;
        delete process.env.VIS_AUDIT_BACKEND;
    });

    afterEach(() => {
        if (ORIGINAL_VIS_INSTALLER === undefined) {
            delete process.env.VIS_INSTALLER;
        } else {
            process.env.VIS_INSTALLER = ORIGINAL_VIS_INSTALLER;
        }

        if (ORIGINAL_VIS_AUDIT_BACKEND === undefined) {
            delete process.env.VIS_AUDIT_BACKEND;
        } else {
            process.env.VIS_AUDIT_BACKEND = ORIGINAL_VIS_AUDIT_BACKEND;
        }
    });

    it("returns aube when --backend aube is passed, even if aube isn't on PATH", () => {
        expect.assertions(1);

        // Forced delegation — the spawn step will surface aube's absence.
        // resolveAuditBackend itself doesn't gate on PATH for the explicit form.
        expect(resolveAuditBackend("aube", undefined, undefined)).toBe("aube");
    });

    it("returns vis when --backend vis is passed, even with aube installer", () => {
        expect.assertions(1);

        availableBinaries.add("aube");

        expect(resolveAuditBackend("vis", undefined, { install: { backend: "aube" } })).toBe("vis");
    });

    it("throws on an unknown --backend value", () => {
        expect.assertions(1);

        expect(() => resolveAuditBackend("abue", undefined, undefined)).toThrow("Invalid --backend value 'abue'");
    });

    it("throws on an unknown VIS_AUDIT_BACKEND value", () => {
        expect.assertions(1);

        process.env.VIS_AUDIT_BACKEND = "weird";

        expect(() => resolveAuditBackend(undefined, undefined, undefined)).toThrow("Invalid VIS_AUDIT_BACKEND value 'weird'");
    });

    it("treats an empty VIS_AUDIT_BACKEND as unset (auto fallback)", () => {
        expect.assertions(1);

        process.env.VIS_AUDIT_BACKEND = "";

        // No installer hint, no aube on PATH → auto resolves to vis.
        expect(resolveAuditBackend(undefined, undefined, undefined)).toBe("vis");
    });

    it("env var beats config when CLI flag is omitted", () => {
        expect.assertions(1);

        process.env.VIS_AUDIT_BACKEND = "vis";

        availableBinaries.add("aube");

        expect(resolveAuditBackend(undefined, "aube", { install: { backend: "aube" } })).toBe("vis");
    });

    it("config value applies when neither CLI flag nor env var is set", () => {
        expect.assertions(1);

        expect(resolveAuditBackend(undefined, "vis", undefined)).toBe("vis");
    });

    it("cli flag beats env var beats config", () => {
        expect.assertions(1);

        process.env.VIS_AUDIT_BACKEND = "vis";

        // CLI flag wins outright.
        expect(resolveAuditBackend("aube", "vis", undefined)).toBe("aube");
    });

    it("auto + aube installer + aube on PATH → delegates", () => {
        expect.assertions(1);

        availableBinaries.add("aube");

        expect(resolveAuditBackend(undefined, "auto", { install: { backend: "aube" } })).toBe("aube");
    });

    it("auto + aube installer + aube NOT on PATH → falls back to vis", () => {
        expect.assertions(1);

        // installer says aube but binary missing — resolveAuditBackend
        // must not delegate, otherwise the spawn step would error.
        expect(resolveAuditBackend(undefined, "auto", { install: { backend: "aube" } })).toBe("vis");
    });

    it("auto + non-aube installer + aube on PATH → uses vis", () => {
        expect.assertions(1);

        availableBinaries.add("aube");

        // Aube is globally installed but the user's workspace pins pnpm —
        // don't surprise them by silently delegating.
        expect(resolveAuditBackend(undefined, "auto", { install: { backend: "pnpm" } })).toBe("vis");
    });

    it("auto + VIS_INSTALLER=aube + aube on PATH → delegates", () => {
        expect.assertions(1);

        availableBinaries.add("aube");
        process.env.VIS_INSTALLER = "aube";

        expect(resolveAuditBackend(undefined, "auto", undefined)).toBe("aube");
    });

    it("auto with no hints → resolves to vis", () => {
        expect.assertions(1);

        // No CLI, no env, no config — full default path.
        expect(resolveAuditBackend(undefined, undefined, undefined)).toBe("vis");
    });
});

describe(mapSeverityToAube, () => {
    it("returns undefined when severity is undefined", () => {
        expect.assertions(1);

        expect(mapSeverityToAube(undefined)).toBeUndefined();
    });

    it("maps medium → moderate (the only non-identity mapping)", () => {
        expect.assertions(1);

        expect(mapSeverityToAube("medium")).toBe("moderate");
    });

    it("passes critical/high/low through unchanged", () => {
        expect.assertions(3);

        expect(mapSeverityToAube("critical")).toBe("critical");
        expect(mapSeverityToAube("high")).toBe("high");
        expect(mapSeverityToAube("low")).toBe("low");
    });
});
