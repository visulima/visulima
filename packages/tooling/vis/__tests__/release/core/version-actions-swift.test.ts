import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import { SwiftVersionActions } from "../../../src/release/core/version-actions/swift";
import type { WorkspacePackage } from "../../../src/release/types";

/**
 * The `swift` versionActions releases by tag. Publish checks that the tag does
 * not exist yet, and uploads nothing: the release's tag step creates the tag.
 */
describe.skipIf(process.platform === "win32")(SwiftVersionActions, () => {
    let root: string;

    const pkg: WorkspacePackage = {
        dir: "",
        ecosystem: "swift",
        manifest: { name: "mylib", private: false, version: "0.0.0" },
        manifestPath: "",
        name: "mylib",
        private: false,
        version: "0.0.0",
    };

    const contextWith = (run: CommandRunner["run"], overrides: { dryRun?: boolean } = {}): PublishContext => {
        return {
            catalogs: { default: {}, named: {} },
            dryRun: overrides.dryRun,
            perPackageConfig: { releaseTagPattern: "{version}" },
            pkg: { ...pkg, dir: root, manifestPath: join(root, "Package.swift") },
            pm: { id: "npm", minVersion: "8.0.0", runner: { run } } as never,
            release: {
                changeFiles: [],
                isCascadeBump: false,
                isDependencyBump: false,
                isGroupBump: false,
                name: "mylib",
                newVersion: "1.1.0",
                oldVersion: "1.0.0",
                reasons: ["EXPLICIT"],
                sources: [],
                type: "minor",
            },
            versionedManifestByName: new Map(),
        };
    };

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-swift-publish-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("looks for the bare version tag and publishes when it is absent", async () => {
        expect.hasAssertions();

        const run = vi.fn(async () => { return { exitCode: 1, stderr: "", stdout: "" }; });
        const result = await new SwiftVersionActions().publish(contextWith(run));

        expect(run).toHaveBeenCalledWith("git", ["rev-parse", "--quiet", "--verify", "refs/tags/1.1.0"], { cwd: root, silent: true });
        expect(result).toMatchObject({ published: true });
    });

    it("skips a package whose tag already exists", async () => {
        expect.hasAssertions();

        const run = vi.fn(async () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        const result = await new SwiftVersionActions().publish(contextWith(run));

        expect(result).toMatchObject({ alreadyPublished: true, published: false });
    });

    it("returns before any check on a dry run", async () => {
        expect.hasAssertions();

        const run = vi.fn(async () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        const result = await new SwiftVersionActions().publish(contextWith(run, { dryRun: true }));

        expect(run).not.toHaveBeenCalled();
        expect(result).toMatchObject({ published: true });
    });

    it("reads no version from the registry", async () => {
        expect.hasAssertions();

        await expect(new SwiftVersionActions().readPublishedVersion({ pkg, pm: {} as never })).resolves.toBeUndefined();
    });
});
