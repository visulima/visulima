import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    buildContext,
    publishContext,
} from "../../../src/release/core/orchestrator";
import type { PublishResult } from "../../../src/release/core/package-managers/interface";
import {
    readStagedRegistry,
    recordRecentlyNotified,
    recordRecentlyWalked,
    writeStagedRegistry,
} from "../../../src/release/core/staged-registry";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import { VersionActions } from "../../../src/release/core/version-actions/interface";

/**
 * Coverage for the wiring between `publishContext` and the staged-publish
 * registry. The lower-level helpers (upsert/remove/findConflicting) are
 * tested in staged-registry.test.ts. These tests stub out `VersionActions`
 * entirely so we don't need a real npm CLI to drive end-to-end behaviour.
 */

const setupFixture = (): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-orch-stage-"));

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
        version: "1.0.0",
    }, null, 4)}\n`);

    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });
    writeFileSync(join(cwd, ".vis", "release", "feat.md"), "---\n\"@scope/a\": patch\n---\nbody\n");

    writeFileSync(join(cwd, "vis.config.cjs"), `module.exports = ${JSON.stringify({
        release: { acknowledgeUnstable: true, defaultManaged: true },
    }, null, 4)};\n`);

    return cwd;
};

/**
 * A VersionActions implementation that returns canned outcomes. Used to
 * exercise the publishContext → staged.json wiring without going through
 * the real npm pack + publish.
 */
class StubVersionActions extends VersionActions {
    public readonly id = "stub";

    public readonly calls: { pkg: string; resumeStageId?: string; version: string }[] = [];

    public constructor(
        private readonly response: PublishResult | ((ctx: PublishContext) => PublishResult),
    ) {
        super();
    }

    public async readPublishedVersion(): Promise<string | undefined> {
        return undefined;
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        this.calls.push({
            pkg: context.pkg.name,
            resumeStageId: context.resumeStageId,
            version: context.release.newVersion,
        });

        return typeof this.response === "function" ? this.response(context) : this.response;
    }
}

// TODO(windows): the vis TS/config loader (importTs → native transformTs +
// dynamic import) intermittently deadlocks on win32 — buildContext hangs ~30s
// then EBUSY on temp rmdir. Flaky and only reproducible on a real Windows box.
// Skip this suite there until it's fixed. See the layered-fixes note in memory
// (project_vis_windows_release_layered_fixes_pr687).
const isWindows = process.platform === "win32";

describe.skipIf(isWindows)("orchestrator: publishContext → staged.json wiring", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = setupFixture();
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("records a stage-timeout outcome in staged.json with reason=timeout", async () => {
        const actions = new StubVersionActions({
            alreadyPublished: false,
            output: "stage-timeout: stage-xyz",
            published: false,
            stageId: "stage-xyz",
        });

        const ctx = await buildContext({ cwd });

        const result = await publishContext(ctx, {
            noPush: true,
            noTag: true,
            publishActionsOverride: actions,
        });

        // Action was invoked once for our single package.
        expect(actions.calls).toHaveLength(1);
        expect(actions.calls[0]!.pkg).toBe("@scope/a");

        // Skipped (not published), reason carries the stage-timeout marker.
        expect(result.skipped.find((s) => s.name === "@scope/a")?.reason).toContain("stage-timeout");

        // Registry got the upsert. Verify by reading the on-disk file.
        const registry = await readStagedRegistry(cwd, ".vis/release");

        expect(registry.pending).toHaveLength(1);
        expect(registry.pending[0]).toMatchObject({
            id: "stage-xyz",
            name: "@scope/a",
            reason: "timeout",
            version: "1.0.1",
        });
    });

    it("records a stage-rejected outcome with reason=rejected", async () => {
        const actions = new StubVersionActions({
            alreadyPublished: false,
            output: "stage-rejected: stage-abc",
            published: false,
            stageId: "stage-abc",
        });

        const ctx = await buildContext({ cwd });

        await publishContext(ctx, {
            noPush: true,
            noTag: true,
            publishActionsOverride: actions,
        });

        const registry = await readStagedRegistry(cwd, ".vis/release");

        expect(registry.pending[0]).toMatchObject({
            id: "stage-abc",
            name: "@scope/a",
            reason: "rejected",
        });
    });

    it("drains a prior pending entry when the same (name, version) goes through the published path", async () => {
        // Seed: a leftover stage from a prior wave.
        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-prior",
                name: "@scope/a",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                tag: "latest",
                version: "1.0.1",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        // The publish action now reports the version as published (e.g.
        // because the operator approved out-of-band and a re-run picked
        // it up via the resume path).
        const actions = new StubVersionActions({
            output: "[resumed] published @scope/a@1.0.1",
            published: true,
        });

        const ctx = await buildContext({ cwd });

        await publishContext(ctx, {
            noPush: true,
            noTag: true,
            publishActionsOverride: actions,
        });

        // Registry was drained — file is deleted when pending is empty.
        const registry = await readStagedRegistry(cwd, ".vis/release");

        expect(registry.pending).toStrictEqual([]);
    });

    it("passes resumeStageId to the action when staged.json already holds an entry for the planned (name, version)", async () => {
        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-resume",
                name: "@scope/a",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                tag: "latest",
                version: "1.0.1", // matches the planned patch bump
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const actions = new StubVersionActions((ctx) => {
            return {
                output: `[resumed] published ${ctx.pkg.name}@${ctx.release.newVersion}`,
                published: true,
            };
        });

        const ctx = await buildContext({ cwd });

        // skipSelfHeal — the guard would otherwise try `npm view`. We
        // don't need to test self-heal here; the resume case is the
        // distinct path under test.
        await publishContext(ctx, {
            noPush: true,
            noTag: true,
            publishActionsOverride: actions,
        });

        // Action received resumeStageId — confirming the orchestrator
        // wired the existing entry through.
        expect(actions.calls[0]!.resumeStageId).toBe("stage-resume");
    });

    it("drains the registry entry on a successful resume (out.published from resume path)", async () => {
        await writeStagedRegistry(cwd, ".vis/release", {
            pending: [{
                id: "stage-resume",
                name: "@scope/a",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                tag: "latest",
                version: "1.0.1",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const actions = new StubVersionActions({
            output: "[resumed] published @scope/a@1.0.1",
            published: true,
        });

        const ctx = await buildContext({ cwd });

        const result = await publishContext(ctx, {
            noPush: true,
            noTag: true,
            publishActionsOverride: actions,
        });

        expect(result.published).toHaveLength(1);
        expect(result.published[0]!.name).toBe("@scope/a");

        const registry = await readStagedRegistry(cwd, ".vis/release");

        expect(registry.pending).toStrictEqual([]);
    });
});

/**
 * Cross-machine notify/walk dedupe via the tracked `staged.json` registry.
 *
 * The orchestrator's `publishContext` consults BOTH `state.notified`
 * (gitignored, per-run, per-machine) AND `stagedRegistry.recentlyNotified`
 * (tracked, cross-machine). Same wiring for `walked`. This test stubs
 * `fetch` so the channel implementations don't make real HTTP requests
 * and asserts that a SECOND `publishContext` call on the same wave does
 * NOT re-fire notifications even when `state.notified` is empty (the
 * cross-machine scenario simulated by clearing `.state.json` between
 * runs).
 *
 * Tag-push is exercised against a bare-repo "origin" so
 * `result.tagsPushed` flips true and the orchestrator enters the
 * walk/notify branch. Walking requires a forge client (gh CLI) which
 * isn't available in the test env — we keep `notifications` configured
 * but leave the walk path to soft-fail to `plan.warnings`, which is the
 * code path under test.
 */
describe.skipIf(isWindows)("orchestrator: cross-runner notify/walk dedupe via staged.json", () => {
    let cwd: string;
    let originPath: string;
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    const setupGitFixture = (): { cwd: string; origin: string } => {
        const pkgCwd = mkdtempSync(join(tmpdir(), "vis-orch-notify-"));
        const origin = mkdtempSync(join(tmpdir(), "vis-orch-notify-origin-"));

        writeFileSync(join(pkgCwd, "package.json"), `${JSON.stringify({
            name: "fixture-root",
            packageManager: "pnpm@10.0.0",
            private: true,
            version: "0.0.0",
            workspaces: ["packages/*"],
        }, null, 4)}\n`);
        writeFileSync(join(pkgCwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

        mkdirSync(join(pkgCwd, "packages", "a"), { recursive: true });
        writeFileSync(join(pkgCwd, "packages", "a", "package.json"), `${JSON.stringify({
            name: "@scope/a",
            version: "1.0.0",
        }, null, 4)}\n`);

        mkdirSync(join(pkgCwd, ".vis", "release"), { recursive: true });
        writeFileSync(join(pkgCwd, ".vis", "release", "feat.md"), "---\n\"@scope/a\": patch\n---\nbody\n");

        // Notifications config — webhook channel keeps the test offline
        // (vs. slack/discord which validate webhook URL shape).
        writeFileSync(join(pkgCwd, "vis.config.cjs"), `module.exports = ${JSON.stringify({
            release: {
                acknowledgeUnstable: true,
                defaultManaged: true,
                notifications: {
                    skipPrerelease: false,
                    webhook: { url: "https://example.com/hook" },
                },
            },
        }, null, 4)};\n`);

        // Bare repo as origin so `git push --tags` succeeds without a
        // real remote.
        execFileSync("git", ["init", "-q", "--bare", "--initial-branch", "main"], { cwd: origin });

        execFileSync("git", ["init", "-q", "--initial-branch", "main"], { cwd: pkgCwd });
        execFileSync("git", ["config", "user.email", "test@test"], { cwd: pkgCwd });
        execFileSync("git", ["config", "user.name", "Test"], { cwd: pkgCwd });
        execFileSync("git", ["remote", "add", "origin", origin], { cwd: pkgCwd });
        execFileSync("git", ["add", "."], { cwd: pkgCwd });
        execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: pkgCwd });
        execFileSync("git", ["push", "-q", "-u", "origin", "main"], { cwd: pkgCwd });

        return { cwd: pkgCwd, origin };
    };

    beforeEach(() => {
        const fixture = setupGitFixture();

        cwd = fixture.cwd;
        originPath = fixture.origin;
        fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    });

    afterEach(async () => {
        fetchSpy.mockRestore();
        await rm(cwd, { force: true, recursive: true });
        await rm(originPath, { force: true, recursive: true });
    });

    it("recentlyNotified entry on disk prevents a follow-up publish from re-firing the webhook", async () => {
        // Seed the tracked registry as if a prior CI run (on a different
        // machine) had already dispatched the notification for the
        // package + version we're about to publish.
        const seeded = recordRecentlyNotified(
            { pending: [], updatedAt: new Date().toISOString(), version: 1 },
            ["@scope/a@1.0.1"],
        );

        await writeStagedRegistry(cwd, ".vis/release", seeded);

        const actions = new StubVersionActions({ output: "ok", published: true });

        const ctx = await buildContext({ cwd });

        await publishContext(ctx, { publishActionsOverride: actions });

        // Webhook fetch MUST NOT have fired — the cross-runner dedupe
        // recognised the (name, version) had already been notified on a
        // prior wave (even though .state.json is fresh on this runner).
        expect(fetchSpy).not.toHaveBeenCalled();

        // Tag was still pushed — dedupe only affects notification
        // dispatch, not the rest of the publish flow.
        const tags = execFileSync("git", ["tag", "--list"], { cwd, encoding: "utf8" }).trim();

        expect(tags).toContain("@scope/a@1.0.1");
    });

    it("a successful publish writes recentlyNotified into staged.json for next-runner dedupe", async () => {
        // Happy path: nothing in staged.json yet, publishContext dispatches
        // the webhook, then commits the (name, version) into the registry
        // so the next runner sees it.
        const actions = new StubVersionActions({ output: "ok", published: true });
        const ctx = await buildContext({ cwd });

        await publishContext(ctx, { publishActionsOverride: actions });

        // First wave fired the webhook…
        expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

        // …AND recorded the (name, version) in staged.json. Cross-runner
        // dedupe state now lives in the worktree where a fresh CI runner
        // will read it on re-fired workflow.
        const registry = await readStagedRegistry(cwd, ".vis/release");

        expect((registry.recentlyNotified ?? []).map((entry) => entry.key)).toContain("@scope/a@1.0.1");
    });

    it("recentlyWalked entry on disk skips walkSuccessfulRelease for the matching package", async () => {
        // walkSuccessfulRelease requires a remote-client (gh CLI) which
        // isn't available in the test env. The walk path is gated by the
        // dedupe check — if recentlyWalked already covers the published
        // entry, the gate filter empties `walkable.published` and the
        // walk function isn't entered at all (zero-cost dedupe).
        const seeded = recordRecentlyWalked(
            { pending: [], updatedAt: new Date().toISOString(), version: 1 },
            ["@scope/a@1.0.1"],
        );

        await writeStagedRegistry(cwd, ".vis/release", seeded);

        const actions = new StubVersionActions({ output: "ok", published: true });
        const ctx = await buildContext({ cwd });
        const result = await publishContext(ctx, { publishActionsOverride: actions });

        // Publish itself succeeded.
        expect(result.published.map((p) => p.name)).toStrictEqual(["@scope/a"]);

        // No `successWalk:` warning surfaced (the gate skipped the walk
        // before any remote-client call could fail). Compare with the
        // happy-path expectation: a forge-failure warning would mention
        // either "successWalk" or "post-release walk".
        const walkWarnings = ctx.plan.warnings.filter((w) => w.toLowerCase().includes("walk"));

        expect(walkWarnings).toStrictEqual([]);
    });
});

/**
 * H1 regression: when a package's publish throws, its dependents must NOT be
 * published — otherwise a dependent ships with a `workspace:`-rewritten range
 * pointing at a version that never reached the registry, leaving consumers
 * with an uninstallable tree. The publish loop runs in topological order, so
 * the failed dependency is recorded before its dependents are reached.
 */
const setupDependencyFixture = (): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-orch-dep-"));

    writeFileSync(join(cwd, "package.json"), `${JSON.stringify({
        name: "fixture-root",
        packageManager: "pnpm@10.0.0",
        private: true,
        version: "0.0.0",
        workspaces: ["packages/*"],
    }, null, 4)}\n`);

    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

    mkdirSync(join(cwd, "packages", "a"), { recursive: true });
    writeFileSync(join(cwd, "packages", "a", "package.json"), `${JSON.stringify({
        name: "@scope/a",
        version: "1.0.0",
    }, null, 4)}\n`);

    // @scope/b depends on @scope/a — publishing b after a fails would orphan it.
    mkdirSync(join(cwd, "packages", "b"), { recursive: true });
    writeFileSync(join(cwd, "packages", "b", "package.json"), `${JSON.stringify({
        dependencies: { "@scope/a": "workspace:^" },
        name: "@scope/b",
        version: "1.0.0",
    }, null, 4)}\n`);

    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });
    writeFileSync(join(cwd, ".vis", "release", "feat.md"), "---\n\"@scope/a\": patch\n\"@scope/b\": patch\n---\nbody\n");

    writeFileSync(join(cwd, "vis.config.cjs"), `module.exports = ${JSON.stringify({
        release: { acknowledgeUnstable: true, defaultManaged: true },
    }, null, 4)};\n`);

    return cwd;
};

describe.skipIf(isWindows)("orchestrator: publish loop does not orphan dependents (H1)", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = setupDependencyFixture();
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("skips a dependent when its internal dependency fails to publish", async () => {
        // @scope/a throws; @scope/b (which depends on it) must be skipped, not published.
        const actions = new StubVersionActions((context: PublishContext): PublishResult => {
            if (context.pkg.name === "@scope/a") {
                throw new Error("npm publish failed (E500 internal registry error)");
            }

            return { output: "ok", published: true };
        });

        const ctx = await buildContext({ cwd });
        const result = await publishContext(ctx, {
            noPush: true,
            noTag: true,
            publishActionsOverride: actions,
        });

        // @scope/a is recorded as failed.
        expect(result.failed.map((f) => f.name)).toContain("@scope/a");

        // @scope/b is NOT published — neither package made it to the registry.
        expect(result.published.map((p) => p.name)).not.toContain("@scope/b");
        expect(result.published.map((p) => p.name)).not.toContain("@scope/a");

        // @scope/b is skipped with a reason that names the failed dependency.
        const bSkip = result.skipped.find((s) => s.name === "@scope/b");

        expect(bSkip?.reason).toContain("dependency-failed");
        expect(bSkip?.reason).toContain("@scope/a");

        // The dependent's publish was never even attempted (short-circuited
        // before the action call), so the stub only saw @scope/a.
        expect(actions.calls.map((c) => c.pkg)).toStrictEqual(["@scope/a"]);
    });
});
