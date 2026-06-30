import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildContext, publishContext } from "../../../src/release/core/orchestrator";
import type { PublishResult } from "../../../src/release/core/package-managers/interface";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import { VersionActions } from "../../../src/release/core/version-actions/interface";

const writeJson = (path: string, value: unknown): void => { writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`); };

const setupFixture = (): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-orch-veto-"));

    writeJson(join(cwd, "package.json"), { name: "fixture-root", packageManager: "pnpm@10.0.0", private: true, version: "0.0.0", workspaces: ["packages/*"] });
    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n  - 'packages/*/*'\n");

    mkdirSync(join(cwd, "packages", "a"), { recursive: true });
    writeJson(join(cwd, "packages", "a", "package.json"), { name: "@scope/a", version: "1.0.0" });

    // b depends on a (runtime) → orphan-protection applies.
    mkdirSync(join(cwd, "packages", "b"), { recursive: true });
    writeJson(join(cwd, "packages", "b", "package.json"), { dependencies: { "@scope/a": "^1.0.0" }, name: "@scope/b", version: "1.0.0" });

    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });
    writeFileSync(join(cwd, ".vis", "release", "feat.md"), `---\n"@scope/a": minor\n"@scope/b": patch\n---\nbody\n`);
    writeFileSync(
        join(cwd, "vis.config.cjs"),
        `module.exports = ${JSON.stringify({ release: { acknowledgeUnstable: true, defaultManaged: true } }, null, 4)};\n`,
    );

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

        return { alreadyPublished: false, output: "ok", published: true };
    }
}

const isWindows = process.platform === "win32";

describe.skipIf(isWindows)("orchestrator: willPublish veto does not orphan dependents", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = setupFixture();
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("skips a dependent when its dependency is vetoed by a plugin", async () => {
        expect.hasAssertions();

        const actions = new StubVersionActions();
        const ctx = await buildContext({
            config: {
                acknowledgeUnstable: true,
                defaultManaged: true,
                plugins: [{ name: "veto-a", willPublish: ({ package: pkg }) => (pkg.name === "@scope/a" ? false : undefined) }],
            },
            cwd,
            firstRelease: true,
        });

        const result = await publishContext(ctx, { noPush: true, noTag: true, publishActionsOverride: actions });

        // Neither the vetoed package nor its dependent reaches publish.
        expect(actions.calls).toStrictEqual([]);
        expect(result.published).toStrictEqual([]);

        const reasons = Object.fromEntries(result.skipped.map((s) => [s.name, s.reason]));

        expect(reasons["@scope/a"]).toContain("plugin-skipped");
        // The fix: b is skipped as dependency-failed rather than published
        // against an @scope/a version that the veto kept off the registry.
        expect(reasons["@scope/b"]).toContain("dependency-failed");
    });
});
