import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    applyContext,
    assertNoConflictingPendingStages,
    buildContext,
} from "../../../src/release/core/orchestrator";
import { MockRunner } from "../../../src/release/core/shell-runner";
import {
    readStagedRegistry,
    stagedRegistryPath,
    writeStagedRegistry,
} from "../../../src/release/core/staged-registry";
import { VisReleaseError } from "../../../src/release/errors";

/**
 * Fixture: a single-package pnpm workspace with a pending change file so the
 * release plan is non-empty (otherwise the guard short-circuits on the
 * plan-empty branch). Mirrors the pattern used in orchestrator.test.ts.
 */
const setupFixture = (): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-stage-guard-"));

    writeFileSync(join(cwd, "package.json"), `${JSON.stringify({
        name: "fixture-root",
        packageManager: "pnpm@10.0.0",
        private: true,
        version: "0.0.0",
        workspaces: ["packages/*"],
    }, null, 4)}\n`);

    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n  - 'packages/*/*'\n");

    mkdirSync(join(cwd, "packages", "a"), { recursive: true });
    writeFileSync(join(cwd, "packages", "a", "package.json"), `${JSON.stringify({
        name: "@scope/a",
        version: "1.2.0",
    }, null, 4)}\n`);

    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });

    // Pending change → patch bump → plan.releases.length === 1
    writeFileSync(join(cwd, ".vis", "release", "feat.md"), "---\n\"@scope/a\": patch\n---\nbody\n");

    writeFileSync(join(cwd, "vis.config.cjs"), `module.exports = ${JSON.stringify({
        release: { acknowledgeUnstable: true, defaultManaged: true },
    }, null, 4)};\n`);

    return cwd;
};

// TODO(windows): the vis TS/config loader (importTs → native transformTs +
// dynamic import) intermittently deadlocks on win32 — buildContext hangs ~30s
// then EBUSY on temp rmdir. Flaky and only reproducible on a real Windows box.
// Skip this suite there until it's fixed. See the layered-fixes note in memory
// (project_vis_windows_release_layered_fixes_pr687).
const isWindows = process.platform === "win32";

describe.skipIf(isWindows)("stage guardrail: applyContext refuses to re-version when a pending stage targets the same package", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = setupFixture();
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("throws STAGE_PENDING when staged.json holds an entry for a planned package", async () => {
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-xyz",
                name: "@scope/a",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                tag: "latest",
                version: "1.2.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const ctx = await buildContext({ cwd });

        await expect(applyContext(ctx, { dryRun: true })).rejects.toMatchObject({
            code: "STAGE_PENDING",
        });
    });

    it("blocks even when the staged version is older than the planned bump (would orphan the prior tarball)", async () => {
        // Staged 1.2.0 (timed out); plan would bump to 1.2.1 — without the
        // guard, we'd publish 1.2.1 leaving 1.2.0 pending on npm forever.
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-xyz",
                name: "@scope/a",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                tag: "latest",
                version: "1.2.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const ctx = await buildContext({ cwd });

        await expect(applyContext(ctx, { dryRun: true })).rejects.toMatchObject({
            code: "STAGE_PENDING",
        });
    });

    it("includes the package + stage id + reason in the error message", async () => {
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-xyz",
                name: "@scope/a",
                reason: "rejected",
                stagedAt: "2026-05-22T14:00:00.000Z",
                tag: "latest",
                version: "1.2.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const ctx = await buildContext({ cwd });

        try {
            await applyContext(ctx, { dryRun: true });

            expect.fail("Expected applyContext to throw");
        } catch (error) {
            if (!(error instanceof VisReleaseError)) {
                throw error;
            }

            expect(error.code).toBe("STAGE_PENDING");
            expect(error.message).toContain("@scope/a");
            expect(error.message).toContain("stage-xyz");
            expect(error.message).toContain("rejected");
            expect(error.hint).toContain("vis release stage approve");
        }
    });

    it("does NOT block when staged.json holds an entry for an UNRELATED package", async () => {
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-other",
                name: "@other/pkg",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                tag: "latest",
                version: "1.0.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const ctx = await buildContext({ cwd });

        // dryRun: true → guard runs, then the dry-run branch returns early
        // without touching git. No throw means the guard correctly let it pass.
        await expect(applyContext(ctx, { dryRun: true })).resolves.toBeDefined();
    });

    it("does NOT block when staged.json is absent", async () => {
        expect.hasAssertions();

        const ctx = await buildContext({ cwd });

        await expect(applyContext(ctx, { dryRun: true })).resolves.toBeDefined();
    });

    it("does NOT block when staged.json has an empty pending array", async () => {
        // Write directly to the file path so writeStagedRegistry doesn't
        // delete it for being empty.
        expect.hasAssertions();

        const { mkdir, writeFile } = await import("node:fs/promises");

        await mkdir(join(cwd, ".vis", "release"), { recursive: true });
        await writeFile(
            stagedRegistryPath(cwd, ".vis/release"),
            JSON.stringify({ pending: [], updatedAt: "now", version: 1 }, null, 2),
        );

        const ctx = await buildContext({ cwd });

        await expect(applyContext(ctx, { dryRun: true })).resolves.toBeDefined();
    });
});

describe.skipIf(isWindows)("stage guardrail: RESUME case (same name + same version is allowed)", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = setupFixture();
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("aLLOWS when the pending stage's version matches the planned version (resume scenario)", async () => {
        // The fixture's @scope/a is at 1.2.0 with a patch bump → plan
        // would be 1.2.1. So we stage a pending entry at 1.2.1 too:
        // the in-memory plan matches the pending stage, which is the
        // resume case — we want to resume waiting on the existing stage,
        // not refuse the operation.
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-xyz",
                name: "@scope/a",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                tag: "latest",
                version: "1.2.1", // matches the planned bump
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const ctx = await buildContext({ cwd });

        await expect(
            assertNoConflictingPendingStages(ctx, "publish", undefined, { skipSelfHeal: true }),
        ).resolves.toBeUndefined();
    });

    it("bLOCKS when the pending stage's version is below the planned version (orphan-risk)", async () => {
        // Pending at 1.2.0; plan bumps to 1.2.1. If we let this through,
        // 1.2.0 would never be tagged and the pending tarball orphans.
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-xyz",
                name: "@scope/a",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                tag: "latest",
                version: "1.2.0", // != planned 1.2.1
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const ctx = await buildContext({ cwd });

        await expect(
            assertNoConflictingPendingStages(ctx, "publish", undefined, { skipSelfHeal: true }),
        ).rejects.toMatchObject({ code: "STAGE_PENDING" });
    });

    it("bLOCKS when the pending stage's version is ABOVE the planned version (would orphan the newer stage)", async () => {
        // Pending at 1.3.0 (somehow); plan only bumps to 1.2.1. Letting
        // this through would still leave 1.3.0 orphaned. Block.
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-xyz",
                name: "@scope/a",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                tag: "latest",
                version: "1.3.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const ctx = await buildContext({ cwd });

        await expect(
            assertNoConflictingPendingStages(ctx, "publish", undefined, { skipSelfHeal: true }),
        ).rejects.toMatchObject({ code: "STAGE_PENDING" });
    });

    it("aLLOWS resume when MULTIPLE pending entries all match planned versions", async () => {
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [
                {
                    id: "stage-a",
                    name: "@scope/a",
                    reason: "timeout",
                    stagedAt: "2026-05-22T14:00:00.000Z",
                    tag: "latest",
                    version: "1.2.1", // matches plan
                },
            ],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const ctx = await buildContext({ cwd });

        await expect(
            assertNoConflictingPendingStages(ctx, "publish", undefined, { skipSelfHeal: true }),
        ).resolves.toBeUndefined();
    });
});

describe.skipIf(isWindows)("stage guardrail: assertNoConflictingPendingStages (publish phase)", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = setupFixture();
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("throws STAGE_PENDING with hint when called for the publish phase", async () => {
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-xyz",
                name: "@scope/a",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                tag: "latest",
                version: "1.2.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const ctx = await buildContext({ cwd });

        try {
            await assertNoConflictingPendingStages(ctx, "publish");

            expect.fail("Expected to throw");
        } catch (error) {
            if (!(error instanceof VisReleaseError)) {
                throw error;
            }

            // Verb in the message differs by phase so logs are
            // unambiguous when the guard fires in mixed flows.
            expect(error.message).toContain("Refusing to publish");
            expect(error.hint).toBeDefined();
        }
    });

    it("uses the `version` verb when phase is version", async () => {
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-xyz",
                name: "@scope/a",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                version: "1.2.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const ctx = await buildContext({ cwd });

        try {
            await assertNoConflictingPendingStages(ctx, "version", undefined, { skipSelfHeal: true });

            expect.fail("Expected to throw");
        } catch (error) {
            if (!(error instanceof VisReleaseError)) {
                throw error;
            }

            expect(error.message).toContain("Refusing to version");
        }
    });
});

describe.skipIf(isWindows)("stage guardrail: self-heal for out-of-band approvals", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = setupFixture();
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("drains a pending entry whose version is already on the registry (operator approved via npmjs.com UI)", async () => {
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-xyz",
                name: "@scope/a",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                tag: "latest",
                version: "1.2.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const runner = new MockRunner();

        // Simulate: `npm view @scope/a@1.2.0 dist.tarball` returns a URL,
        // meaning the version is live (out-of-band approval).
        runner.on("npm", ["view", "@scope/a@1.2.0", "dist.tarball"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: "https://registry.npmjs.org/@scope/a/-/a-1.2.0.tgz\n",
            };
        });

        const ctx = await buildContext({ cwd });

        // Should NOT throw — the guard self-heals.
        await expect(
            assertNoConflictingPendingStages(ctx, "publish", undefined, { runner }),
        ).resolves.toBeUndefined();

        // …and the registry file is updated to reflect the resolution.
        const after = await readStagedRegistry(cwd, ".vis/release");

        expect(after.pending).toHaveLength(0);
    });

    it("does NOT drain when `npm view` returns no tarball (still pending)", async () => {
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-xyz",
                name: "@scope/a",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                tag: "latest",
                version: "1.2.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const runner = new MockRunner();

        // 404 / non-zero exit → still pending.
        runner.on("npm", ["view"], () => {
            return {
                exitCode: 1,
                stderr: "E404",
                stdout: "",
            };
        });

        const ctx = await buildContext({ cwd });

        await expect(
            assertNoConflictingPendingStages(ctx, "publish", undefined, { runner }),
        ).rejects.toMatchObject({ code: "STAGE_PENDING" });

        // Registry unchanged — the entry stays pending.
        const after = await readStagedRegistry(cwd, ".vis/release");

        expect(after.pending).toHaveLength(1);
    });

    it("self-heals a subset and throws for the rest", async () => {
        // Two pending entries — one already live (approved out-of-band),
        // one still pending. Guard should drain the live one and still
        // throw for the other.
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [
                {
                    id: "stage-live",
                    name: "@scope/a",
                    reason: "timeout",
                    stagedAt: "2026-05-22T14:00:00.000Z",
                    tag: "latest",
                    version: "1.2.0",
                },
                {
                    id: "stage-stuck",
                    name: "@scope/a",
                    reason: "timeout",
                    stagedAt: "2026-05-22T15:00:00.000Z",
                    tag: "latest",
                    // Must differ from the planned version (1.2.1) — a stage at
                    // the exact plan version is the allowed *resume* case and
                    // would be filtered out before the self-heal probe runs.
                    version: "1.3.0",
                },
            ],
            updatedAt: "2026-05-22T15:00:00.000Z",
            version: 1,
        });

        const runner = new MockRunner();

        runner.on("npm", ["view", "@scope/a@1.2.0", "dist.tarball"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: "https://registry/@scope/a/-/a-1.2.0.tgz\n",
            };
        });
        runner.on("npm", ["view", "@scope/a@1.3.0", "dist.tarball"], () => {
            return {
                exitCode: 1,
                stderr: "",
                stdout: "",
            };
        });

        const ctx = await buildContext({ cwd });

        try {
            await assertNoConflictingPendingStages(ctx, "publish", undefined, { runner });

            expect.fail("Expected to throw");
        } catch (error) {
            if (!(error instanceof VisReleaseError)) {
                throw error;
            }

            // Message references the stuck one only, not the drained one.
            expect(error.message).toContain("stage-stuck");
            expect(error.message).not.toContain("stage-live");
        }

        const after = await readStagedRegistry(cwd, ".vis/release");

        expect(after.pending).toHaveLength(1);
        expect(after.pending[0]!.id).toBe("stage-stuck");
    });

    it("respects skipSelfHeal — no npm-view round-trips, straight to throw", async () => {
        expect.hasAssertions();

        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-xyz",
                name: "@scope/a",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                version: "1.2.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const runner = new MockRunner();
        let viewCalls = 0;

        runner.on("npm", ["view"], () => {
            viewCalls += 1;

            return { exitCode: 0, stderr: "", stdout: "tarball-url\n" };
        });

        const ctx = await buildContext({ cwd });

        await expect(
            assertNoConflictingPendingStages(ctx, "publish", undefined, { runner, skipSelfHeal: true }),
        ).rejects.toMatchObject({ code: "STAGE_PENDING" });

        expect(viewCalls).toBe(0);
    });
});
