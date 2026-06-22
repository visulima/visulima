/**
 * Regression tests for `vis release ci release` idempotency (C7 fix).
 *
 * Two paths get the resume treatment:
 *
 *   1. version-pr mode with no pending change files:
 *        - `.state.json` absent → fresh "merge detected → publish" (no resume)
 *        - `.state.json` present → prior partial wave → publishContext({ resume: true })
 *
 *   2. auto-publish mode:
 *        - applyContext lands the version commit (durable)
 *        - publishContext is invoked with { resume: true } so a retry skips
 *          already-published packages instead of replaying.
 *
 * The tests stub `publishContext` to capture its invocation options and
 * assert the right `resume` flag is propagated.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { access, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stateFilePath } from "../../../src/release/core/state";

const writeJson = (path: string, value: unknown): void => {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
};

// The handler reads through the injected `toolbox.fs` (CerebroFs); node:fs/promises
// satisfies that surface for the methods it uses.
const testFs = { access, mkdir, readdir, readFile, rm, stat, writeFile } as never;

const writeVisConfigCjs = (cwd: string, releaseBlock: Record<string, unknown>): void => {
    const block = { release: { ...releaseBlock, acknowledgeUnstable: true } };

    writeFileSync(join(cwd, "vis.config.cjs"), `module.exports = ${JSON.stringify(block, null, 4)};\n`);
};

const setupFixture = (branch: string): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-ci-release-"));

    writeJson(join(cwd, "package.json"), {
        name: "fixture-root",
        packageManager: "pnpm@10.0.0",
        private: true,
        version: "0.0.0",
        workspaces: ["packages/*"],
    });

    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    mkdirSync(join(cwd, "packages"), { recursive: true });
    mkdirSync(join(cwd, "packages", "a"), { recursive: true });
    writeJson(join(cwd, "packages", "a", "package.json"), { name: "@scope/a", version: "1.0.0" });
    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });

    execFileSync("git", ["init", "-q", "--initial-branch", branch], { cwd });
    execFileSync("git", ["config", "user.email", "test@test"], { cwd });
    execFileSync("git", ["config", "user.name", "Test"], { cwd });
    execFileSync("git", ["add", "."], { cwd });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd });

    return cwd;
};

const publishOptionsCaptured: { resume?: boolean; tag?: string }[] = [];

// Stub publishContext + applyContext so the handler runs without touching
// npm / real publishing. We assert on the captured `resume` flag.
vi.mock(import("../../../src/release/core/orchestrator"), async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../../src/release/core/orchestrator")>();

    return {
        ...actual,
        applyContext: vi.fn(async () => {
            return {
                changedFiles: [],
                deletedFiles: [],
                plan: { consumedChangeFiles: [], releases: [], warnings: [] },
            };
        }),
        publishContext: vi.fn(async (_ctx: unknown, options: { resume?: boolean; tag?: string } = {}) => {
            publishOptionsCaptured.push({ ...options });

            return { failed: [], published: [], skipped: [], tags: [], tagsPushed: false };
        }),
    };
});

// Avoid pushing inside the test.
vi.mock(import("../../../src/release/core/git"), async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../../src/release/core/git")>();

    return {
        ...actual,
        getCurrentBranch: vi.fn(async () => "main"),
        hasUncommittedChanges: vi.fn(async () => false),
        pushBranch: vi.fn(async () => undefined),
    };
});

describe("vis release ci release — C7 publish idempotency", () => {
    let cwd: string | undefined;

    beforeEach(() => {
        cwd = undefined;
        publishOptionsCaptured.length = 0;
    });

    afterEach(async () => {
        if (cwd) {
            await rm(cwd, { force: true, recursive: true });
        }

        vi.clearAllMocks();
    });

    it("version-pr mode with no pending files and no .state.json → publish without resume", async () => {
        expect.hasAssertions();

        cwd = setupFixture("main");

        // Configure main as version-pr channel — no pending files → assume merge.
        writeVisConfigCjs(cwd, {
            channels: { main: { mode: "version-pr", tag: "latest" } },
        });

        const { default: execute } = await import("../../../src/commands/release/ci/release/handler");

        await execute({
            fs: testFs,
            logger: { error: () => {}, info: () => {}, warn: () => {} },
            options: { channel: "main" },
            workspaceRoot: cwd,
        });

        expect(publishOptionsCaptured).toHaveLength(1);
        expect(publishOptionsCaptured[0]).toMatchObject({ resume: false });
    });

    it("version-pr mode with no pending files and .state.json present → publish with resume", async () => {
        expect.hasAssertions();

        cwd = setupFixture("main");

        writeVisConfigCjs(cwd, {
            channels: { main: { mode: "version-pr", tag: "latest" } },
        });

        // Plant a `.state.json` from a prior partial wave.
        await writeFile(
            stateFilePath(cwd, ".vis/release"),
            `${JSON.stringify({ applied: [], plan: [], published: [], pushed: false, startedAt: new Date().toISOString(), tagged: [], version: 1 }, null, 2)}\n`,
        );

        const { default: execute } = await import("../../../src/commands/release/ci/release/handler");

        await execute({
            fs: testFs,
            logger: { error: () => {}, info: () => {}, warn: () => {} },
            options: { channel: "main" },
            workspaceRoot: cwd,
        });

        expect(publishOptionsCaptured).toHaveLength(1);
        expect(publishOptionsCaptured[0]).toMatchObject({ resume: true });
    });

    it("auto-publish mode → applyContext then publishContext with resume:true", async () => {
        expect.hasAssertions();

        cwd = setupFixture("alpha");

        writeVisConfigCjs(cwd, {
            channels: { alpha: { mode: "auto-publish", prerelease: "alpha", tag: "alpha" } },
        });

        // Auto-publish only fires when there are pending change files.
        await writeFile(
            join(cwd, ".vis", "release", "change-1.md"),
            "---\n\"@scope/a\": minor\n---\nFeature\n",
        );

        const { default: execute } = await import("../../../src/commands/release/ci/release/handler");

        await execute({
            fs: testFs,
            logger: { error: () => {}, info: () => {}, warn: () => {} },
            options: { channel: "alpha" },
            workspaceRoot: cwd,
        });

        expect(publishOptionsCaptured).toHaveLength(1);
        expect(publishOptionsCaptured[0]).toMatchObject({ resume: true, tag: "alpha" });
    });
});
