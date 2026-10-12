import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import { ZigVersionActions } from "../../../src/release/core/version-actions/zig";
import type { WorkspacePackage } from "../../../src/release/types";

/**
 * Zig publishes by git tag: no registry, no upload, no command. The published
 * check is whether the tag the release would create already exists.
 */
describe("zig version actions", () => {
    let dir: string;

    const pkg: WorkspacePackage = {
        dir: "",
        ecosystem: "zig",
        manifest: { name: "app", private: false, version: "1.0.0" },
        manifestPath: "",
        name: "app",
        private: false,
        version: "1.0.0",
    };

    const runner = (tagExists: boolean): CommandRunner & { run: ReturnType<typeof vi.fn> } => {
        return {
            run: vi.fn(async () => { return { exitCode: tagExists ? 0 : 1, stderr: "", stdout: "" }; }),
        };
    };

    const context = (overrides: { dryRun?: boolean; perPackageConfig?: PublishContext["perPackageConfig"]; runner?: CommandRunner } = {}): PublishContext => {
        return {
            catalogs: { default: {}, named: {} },
            dryRun: overrides.dryRun,
            perPackageConfig: overrides.perPackageConfig,
            pkg: { ...pkg, dir },
            pm: { id: "npm", minVersion: "8.0.0", runner: overrides.runner ?? runner(false) } as never,
            release: { changeFiles: [], isCascadeBump: false, isDependencyBump: false, isGroupBump: false, name: "app", newVersion: "1.1.0", oldVersion: "1.0.0", reasons: ["EXPLICIT"], sources: [], type: "minor" },
            versionedManifestByName: new Map(),
        };
    };

    beforeEach(() => {
        dir = realpathSync(mkdtempSync(join(tmpdir(), "vis-zig-publish-")));
    });

    afterEach(() => {
        rmSync(dir, { force: true, recursive: true });
    });

    it("returns before any check on a dry run", async () => {
        expect.hasAssertions();

        const spy = runner(false);
        const result = await new ZigVersionActions().publish(context({ dryRun: true, runner: spy }));

        expect(result.published).toBe(true);
        expect(spy.run).not.toHaveBeenCalled();
    });

    it("skips when the release tag already exists", async () => {
        expect.hasAssertions();

        const result = await new ZigVersionActions().publish(context({ runner: runner(true) }));

        expect(result).toMatchObject({ alreadyPublished: true, published: false });
    });

    it("publishes by leaving the tag to the release when none exists, without running a command", async () => {
        expect.hasAssertions();

        const spy = runner(false);
        const result = await new ZigVersionActions().publish(context({ runner: spy }));

        expect(result.published).toBe(true);
        expect(spy.run).toHaveBeenCalledTimes(1);
        expect(spy.run).toHaveBeenCalledWith("git", ["rev-parse", "--verify", "--quiet", "refs/tags/app@1.1.0"], expect.anything());
    });

    it("renders the tag from releaseTagPattern when the package sets one", async () => {
        expect.hasAssertions();

        const spy = runner(false);

        await new ZigVersionActions().publish(context({ perPackageConfig: { releaseTagPattern: "v{version}" }, runner: spy }));

        expect(spy.run).toHaveBeenCalledWith("git", ["rev-parse", "--verify", "--quiet", "refs/tags/v1.1.0"], expect.anything());
    });

    it.skipIf(process.platform === "win32")("refuses on Windows after the dry run", async () => {
        expect.hasAssertions();

        const original = Object.getOwnPropertyDescriptor(process, "platform")!;

        Object.defineProperty(process, "platform", { value: "win32" });

        try {
            await expect(new ZigVersionActions().publish(context())).rejects.toMatchObject({ code: "CONFIG_INVALID" });
        } finally {
            Object.defineProperty(process, "platform", original);
        }
    });
});
