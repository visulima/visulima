import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildContext, publishContext } from "../../../src/release/core/orchestrator";
import type { PublishResult } from "../../../src/release/core/package-managers/interface";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import { VersionActions } from "../../../src/release/core/version-actions/interface";

const writeJson = (path: string, value: unknown): void => {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
};

const git = (cwd: string, ...args: string[]): void => {
    execFileSync("git", args, { cwd, stdio: "ignore" });
};

const setupFixture = (): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-lockgit-"));

    writeJson(join(cwd, "package.json"), { name: "fixture-root", packageManager: "pnpm@10.0.0", private: true, version: "0.0.0", workspaces: ["packages/*"] });
    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n  - 'packages/*/*'\n");

    mkdirSync(join(cwd, "packages", "a"), { recursive: true });
    writeJson(join(cwd, "packages", "a", "package.json"), { name: "@scope/a", version: "1.0.0" });

    // b depends on a so the topo order is a → b.
    mkdirSync(join(cwd, "packages", "b"), { recursive: true });
    writeJson(join(cwd, "packages", "b", "package.json"), { dependencies: { "@scope/a": "^1.0.0" }, name: "@scope/b", version: "1.0.0" });

    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });
    writeFileSync(join(cwd, ".vis", "release", "feat.md"), `---\n"@scope/a": minor\n"@scope/b": minor\n---\nbody\n`);
    writeJson(join(cwd, "vis.config.cjs"), {}); // placeholder; overwritten below as raw JS
    writeFileSync(
        join(cwd, "vis.config.cjs"),
        `module.exports = ${JSON.stringify({ release: { acknowledgeUnstable: true, defaultManaged: true, publish: { lockInGit: true } } }, null, 4)};\n`,
    );

    git(cwd, "init", "-q");
    git(cwd, "config", "user.email", "test@example.com");
    git(cwd, "config", "user.name", "Test");
    git(cwd, "add", "-A");
    git(cwd, "commit", "-qm", "init");

    return cwd;
};

class StubVersionActions extends VersionActions {
    public readonly id = "stub";

    public readonly calls: string[] = [];

    public async readPublishedVersion(): Promise<string | undefined> {
        return undefined;
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        this.calls.push(context.pkg.name);

        // a publishes; b fails — leaving a partially-published wave.
        if (context.pkg.name === "@scope/b") {
            throw new Error("boom-b");
        }

        return { alreadyPublished: false, output: "ok", published: true };
    }
}

const isWindows = process.platform === "win32";

describe.skipIf(isWindows)("orchestrator: lockInGit per-package durability", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = setupFixture();
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("commits the tracked lock with the published set when a later package fails", async () => {
        expect.hasAssertions();

        const actions = new StubVersionActions();
        const ctx = await buildContext({ cwd, firstRelease: true });

        const result = await publishContext(ctx, { noPush: true, noTag: true, publishActionsOverride: actions });

        expect(result.published.map((p) => p.name)).toStrictEqual(["@scope/a"]);
        expect(result.failed.map((f) => f.name)).toContain("@scope/b");

        // The wave failed, so the lock is NOT removed — it stays on disk,
        // committed, recording that @scope/a@1.1.0 already published.
        const lockPath = join(cwd, ".vis", "release", "publish-lock.json");

        expect(existsSync(lockPath)).toBe(true);

        const lock = JSON.parse(readFileSync(lockPath, "utf8")) as { published: string[] };

        expect(lock.published).toContain("@scope/a@1.1.0");

        // The lock was committed (not just written) so a fresh clone would see it.
        const log = execFileSync("git", ["log", "--oneline"], { cwd, encoding: "utf8" });

        expect(log).toMatch(/publish lock/);
    });
});
