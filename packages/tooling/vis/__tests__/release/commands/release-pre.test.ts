/**
 * Regression tests for `vis release pre exit` channel-conflict refusal.
 *
 * Covers the C6 audit fix: when the active channel has its own prerelease
 * identifier, `pre exit` must refuse upfront with CONFIG_INVALID. Otherwise
 * the next `vis release version` would still produce a prerelease via the
 * channel while the cleanup deletes pre.json — an unrecoverable state.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import preHandler from "../../../src/commands/release/pre/handler";
import { buildEnterFile, readPreMode, writePreMode } from "../../../src/release/core/pre-mode";
import { VisReleaseError } from "../../../src/release/errors";

const writeJson = (path: string, value: unknown): void => {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
};

const writeVisConfigCjs = (cwd: string, releaseBlock: Record<string, unknown>): void => {
    // loadVisConfig handles .cjs and runs through jiti — keep the config
    // synchronous-friendly so the test doesn't depend on a build step.
    const block = { release: { ...releaseBlock, acknowledgeUnstable: true } };

    writeFileSync(join(cwd, "vis.config.cjs"), `module.exports = ${JSON.stringify(block, null, 4)};\n`);
};

/**
 * Create a tmp workspace + git-init it on `branch`. `detectCurrentBranch`
 * (called by buildContext) shells out to `git rev-parse --abbrev-ref HEAD`
 * — we drive that via a real git repo so the handler resolves the channel
 * exactly the way it would in production.
 */
const setupFixture = (branch: string): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-pre-handler-"));

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

/**
 * Drive the pre-handler default export with a minimal toolbox shim. The
 * handler dispatches on `options.action`; everything else is captured
 * via the logger stubs.
 */
const callHandler = async (cwd: string, options: Record<string, unknown>): Promise<{ errors: string[]; infos: string[]; warns: string[] }> => {
    const infos: string[] = [];
    const errors: string[] = [];
    const warns: string[] = [];

    const logger = {
        error: (message: string) => errors.push(message),
        info: (message: string) => infos.push(message),
        warn: (message: string) => warns.push(message),
    };

    await preHandler({ logger, options, workspaceRoot: cwd });

    return { errors, infos, warns };
};

describe("vis release pre exit — C6 channel-conflict refusal", () => {
    let cwd: string | undefined;

    beforeEach(() => {
        cwd = undefined;
    });

    afterEach(async () => {
        if (cwd) {
            await rm(cwd, { force: true, recursive: true });
        }
    });

    it("refuses with CONFIG_INVALID when active channel pins its own prerelease", async () => {
        // git branch "alpha" → channel { alpha: { prerelease: "alpha" } }
        // → ctx.channel.prerelease === "alpha".
        expect.hasAssertions();

        cwd = setupFixture("alpha");

        await writePreMode(cwd, ".vis/release", buildEnterFile("rc", [{ name: "@scope/a", version: "1.0.0" }]));

        writeVisConfigCjs(cwd, {
            channels: {
                alpha: { prerelease: "alpha", tag: "alpha" },
            },
        });

        await expect(callHandler(cwd, { action: "exit", commit: false })).rejects.toMatchObject({
            code: "CONFIG_INVALID",
        });

        // pre.json must stay in `pre` mode — the throw fires BEFORE
        // the mutate-and-write, so the operator can resolve the conflict
        // (switch branches) and retry without re-entering.
        const after = await readPreMode(cwd, ".vis/release");

        expect(after?.mode).toBe("pre");
        expect(after?.tag).toBe("rc");
    });

    it("error carries a hint pointing operator at the resolution", async () => {
        expect.hasAssertions();

        cwd = setupFixture("beta");

        await writePreMode(cwd, ".vis/release", buildEnterFile("rc", []));
        writeVisConfigCjs(cwd, {
            channels: {
                beta: { prerelease: "beta", tag: "beta" },
            },
        });

        let captured: VisReleaseError | undefined;

        try {
            await callHandler(cwd, { action: "exit", commit: false });
        } catch (error) {
            captured = error as VisReleaseError;
        }

        expect(captured).toBeInstanceOf(VisReleaseError);
        expect(captured?.code).toBe("CONFIG_INVALID");
        expect(captured?.hint).toContain("non-prerelease branch");
        expect(captured?.message).toContain("beta");
    });

    it("allows pre exit on a channel without its own prerelease", async () => {
        expect.hasAssertions();

        cwd = setupFixture("main");

        await writePreMode(cwd, ".vis/release", buildEnterFile("rc", [{ name: "@scope/a", version: "1.0.0" }]));

        // main channel has no prerelease set — exit should proceed and
        // flip pre.json to exit-pending.
        writeVisConfigCjs(cwd, {
            channels: {
                main: { tag: "latest" },
            },
        });

        await callHandler(cwd, { action: "exit", commit: false });

        const after = await readPreMode(cwd, ".vis/release");

        expect(after?.mode).toBe("exit-pending");
        expect(after?.tag).toBe("rc");
    });

    it("allows pre exit when on a branch with no matching channel", async () => {
        // Branch "feature-random" matches no channel → ctx.channel is
        // undefined → no conflict possible → exit proceeds.
        expect.hasAssertions();

        cwd = setupFixture("feature-random");

        await writePreMode(cwd, ".vis/release", buildEnterFile("rc", []));
        writeVisConfigCjs(cwd, {
            channels: {
                main: { tag: "latest" },
            },
        });

        await callHandler(cwd, { action: "exit", commit: false });

        const after = await readPreMode(cwd, ".vis/release");

        expect(after?.mode).toBe("exit-pending");
    });
});
