import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatLockfileVerification, verifyLockfile } from "../../src/security/lockfile-verification";

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return { ...actual, homedir: () => homeOverride };
});

const { clearPackumentCache } = await import("../../src/security/marshalls/packument");

const stubFetch = (body: unknown): void => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => { return { json: async () => body, ok: true, status: 200 }; }),
    );
};

const exoticNpmLock = (): string =>
    JSON.stringify({
        lockfileVersion: 3,
        name: "fixture",
        packages: {
            "": { dependencies: { "prod-pkg": "1.0.0" }, name: "fixture", version: "0.0.0" },
            "node_modules/git-dep": { version: "0.0.0" },
            "node_modules/prod-pkg": { dependencies: { "git-dep": "github:attacker/evil#deadbeef" }, version: "1.0.0" },
        },
        version: "0.0.0",
    });

const cleanNpmLock = (): string =>
    JSON.stringify({
        lockfileVersion: 3,
        name: "fixture",
        packages: {
            "": { dependencies: { "prod-pkg": "1.0.0" }, name: "fixture", version: "0.0.0" },
            "node_modules/prod-pkg": { dependencies: { "ok-dep": "^2.0.0" }, version: "1.0.0" },
        },
        version: "0.0.0",
    });

const singlePkgNpmLock = (): string =>
    JSON.stringify({
        lockfileVersion: 3,
        name: "fixture",
        packages: {
            "": { dependencies: { evil: "1.0.0" }, name: "fixture", version: "0.0.0" },
            "node_modules/evil": { version: "1.0.0" },
        },
        version: "0.0.0",
    });

describe(verifyLockfile, () => {
    let ws: string;

    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-verify-home-"));
        ws = mkdtempSync(join(tmpdir(), "vis-verify-ws-"));
    });

    afterEach(() => {
        clearPackumentCache();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        rmSync(homeOverride, { force: true, recursive: true });
        rmSync(ws, { force: true, recursive: true });
    });

    it("skips when no supply-chain policy is configured", async () => {
        expect.assertions(3);

        writeFileSync(join(ws, "package-lock.json"), cleanNpmLock());

        const result = await verifyLockfile({ packageManager: "npm", visConfig: {}, workspaceRoot: ws });

        expect(result.status).toBe("skipped");
        expect(result.entryCount).toBe(0);
        expect(formatLockfileVerification(result)[0]).toContain("skipped");
    });

    it("fails instead of silently passing when a policy is configured but no lockfile exists", async () => {
        expect.assertions(4);

        const result = await verifyLockfile({
            packageManager: "npm",
            visConfig: { security: { blockExoticSubdeps: true } },
            workspaceRoot: ws,
        });

        expect(result.status).toBe("fail");
        expect(result.lockfileMissing).toBe(true);
        expect(result.entryCount).toBe(0);
        expect(formatLockfileVerification(result)[0]).toContain("no lockfile found");
    });

    it("fails on a transitive exotic source when blockExoticSubdeps is on", async () => {
        expect.assertions(4);

        writeFileSync(join(ws, "package-lock.json"), exoticNpmLock());

        const result = await verifyLockfile({
            packageManager: "npm",
            visConfig: { security: { blockExoticSubdeps: true } },
            workspaceRoot: ws,
        });

        expect(result.status).toBe("fail");
        expect(result.exoticViolations).toStrictEqual([
            { declaredBy: "prod-pkg@1.0.0", packageName: "git-dep", source: "github:attacker/evil#deadbeef" },
        ]);

        const lines = formatLockfileVerification(result);

        expect(lines[0]).toContain("✗ Lockfile failed supply-chain policy check");
        expect(lines[1]).toBe("  [blockExoticSubdeps] git-dep pulled from exotic source by prod-pkg@1.0.0: github:attacker/evil#deadbeef");
    });

    it("passes a clean closure under blockExoticSubdeps", async () => {
        expect.assertions(2);

        writeFileSync(join(ws, "package-lock.json"), cleanNpmLock());

        const result = await verifyLockfile({
            packageManager: "npm",
            visConfig: { security: { blockExoticSubdeps: true } },
            workspaceRoot: ws,
        });

        expect(result.status).toBe("pass");
        expect(formatLockfileVerification(result)[0]).toContain("✓ Lockfile passes supply-chain policies");
    });

    it("honors exoticSubdepsAllow", async () => {
        expect.assertions(1);

        writeFileSync(join(ws, "package-lock.json"), exoticNpmLock());

        const result = await verifyLockfile({
            packageManager: "npm",
            visConfig: { security: { blockExoticSubdeps: true, exoticSubdepsAllow: ["git-dep"] } },
            workspaceRoot: ws,
        });

        expect(result.status).toBe("pass");
    });

    it("fails when firstSeen catches a freshly published locked version", async () => {
        expect.assertions(3);

        writeFileSync(join(ws, "package-lock.json"), singlePkgNpmLock());

        const publishedAt = new Date(Date.now() - 30 * 60_000).toISOString();

        stubFetch({ name: "evil", time: { "1.0.0": publishedAt }, versions: { "1.0.0": { version: "1.0.0" } } });

        const result = await verifyLockfile({
            packageManager: "npm",
            visConfig: { security: { policies: { firstSeen: { minutes: 1440 } } } },
            workspaceRoot: ws,
        });

        expect(result.status).toBe("fail");
        expect(result.entryCount).toBe(1);
        expect(result.decisions.some((d) => d.policy === "firstSeen" && d.severity === "block")).toBe(true);
    });
});
