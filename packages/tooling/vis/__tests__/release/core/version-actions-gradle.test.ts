import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import { GradleVersionActions } from "../../../src/release/core/version-actions/gradle";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import type { WorkspacePackage } from "../../../src/release/types";

/**
 * The `gradle` versionActions publishes a module with its `publish` task, run
 * through the build root's wrapper. The task path is the module's, and the root
 * project's is `:publish`. A version the repository already lists is skipped.
 */
describe.skipIf(process.platform === "win32")(GradleVersionActions, () => {
    let root: string;

    const buildPkg = (dir: string): WorkspacePackage => {
        return {
            dir,
            ecosystem: "gradle",
            manifest: { name: "io.visulima:core", private: false, version: "1.0.0" },
            manifestPath: join(dir, "build.gradle.kts"),
            name: "io.visulima:core",
            private: false,
            version: "1.0.0",
        };
    };

    const okRunner = (): CommandRunner => { return (({ run: vi.fn(async () => { return { exitCode: 0, stderr: "", stdout: "" }; }) })); };

    const buildContext = (pkg: WorkspacePackage, overrides: { dryRun?: boolean; runner?: CommandRunner } = {}): PublishContext => {
        return {
            catalogs: { default: {}, named: {} },
            dryRun: overrides.dryRun,
            pkg,
            pm: { id: "npm", minVersion: "8.0.0", runner: overrides.runner ?? okRunner() } as never,
            release: {
                changeFiles: [],
                isCascadeBump: false,
                isDependencyBump: false,
                isGroupBump: false,
                name: pkg.name,
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
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-gradle-publish-")));
        writeFileSync(join(root, "settings.gradle.kts"), "include(\":core\")\n");
        writeFileSync(join(root, "gradlew"), "#!/bin/sh\n");
        mkdirSync(join(root, "core"), { recursive: true });
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("publishes a module through the root wrapper with its task path, from the root", async () => {
        expect.hasAssertions();

        const run = vi.fn(async () => { return { exitCode: 0, stderr: "", stdout: "" }; });

        const result = await new GradleVersionActions().publish(buildContext(buildPkg(join(root, "core")), { runner: { run } as unknown as CommandRunner }));

        expect(run).toHaveBeenCalledWith(join(root, "gradlew"), [":core:publish"], { cwd: root, silent: false });
        expect(result.published).toBe(true);
    });

    it("uses :publish for the root project", async () => {
        expect.hasAssertions();

        const run = vi.fn(async () => { return { exitCode: 0, stderr: "", stdout: "" }; });

        await new GradleVersionActions().publish(buildContext(buildPkg(root), { runner: { run } as unknown as CommandRunner }));

        expect(run).toHaveBeenCalledWith(join(root, "gradlew"), [":publish"], { cwd: root, silent: false });
    });

    it("runs nothing on a dry run", async () => {
        expect.hasAssertions();

        const run = vi.fn();

        const result = await new GradleVersionActions().publish(buildContext(buildPkg(join(root, "core")), { dryRun: true, runner: { run } as unknown as CommandRunner }));

        expect(run).not.toHaveBeenCalled();
        expect(result.output).toContain(":core:publish");
    });

    it("throws PUBLISH_FAILED on a non-zero exit", async () => {
        expect.hasAssertions();

        const runner = { run: async () => { return { exitCode: 1, stderr: "Could not find task", stdout: "" }; } } as unknown as CommandRunner;

        await expect(new GradleVersionActions().publish(buildContext(buildPkg(join(root, "core")), { runner }))).rejects.toMatchObject({ code: "PUBLISH_FAILED" });
    });

    it("refuses a module with no build root above it", async () => {
        expect.hasAssertions();

        const orphan = realpathSync(mkdtempSync(join(tmpdir(), "vis-gradle-orphan-")));

        try {
            await expect(new GradleVersionActions().publish(buildContext(buildPkg(orphan)))).rejects.toMatchObject({ code: "CONFIG_INVALID" });
        } finally {
            rmSync(orphan, { force: true, recursive: true });
        }
    });

    it("refuses to publish when the build root has no gradlew", async () => {
        expect.hasAssertions();

        rmSync(join(root, "gradlew"));

        await expect(new GradleVersionActions().publish(buildContext(buildPkg(join(root, "core"))))).rejects.toMatchObject({
            code: "CONFIG_INVALID",
            message: expect.stringContaining("gradlew"),
        });
    });

    it("skips a version the repository already lists, without running the publish task", async () => {
        expect.hasAssertions();

        const originalFetch = globalThis.fetch;
        const run = vi.fn();

        globalThis.fetch = vi.fn().mockResolvedValue({
            headers: new Headers(),
            ok: true,
            status: 200,
            text: async () => "<metadata><versioning><versions><version>1.0.0</version><version>1.1.0</version></versions></versioning></metadata>",
        }) as never;

        try {
            const result = await new GradleVersionActions().publish(buildContext(buildPkg(join(root, "core")), { runner: { run } as unknown as CommandRunner }));

            expect(result).toMatchObject({ alreadyPublished: true, published: false });
            expect(run).not.toHaveBeenCalled();
            expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("https://repo1.maven.org/maven2/io/visulima/core/maven-metadata.xml"), expect.anything());
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("publishes when the metadata lookup fails, so the publish reports the real error", async () => {
        expect.hasAssertions();

        const originalFetch = globalThis.fetch;
        const run = vi.fn(async () => { return { exitCode: 0, stderr: "", stdout: "" }; });

        globalThis.fetch = vi.fn().mockRejectedValue(new Error("ENOTFOUND")) as never;

        try {
            const result = await new GradleVersionActions().publish(buildContext(buildPkg(join(root, "core")), { runner: { run } as unknown as CommandRunner }));

            expect(result.published).toBe(true);
            expect(run).toHaveBeenCalledTimes(1);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("does not check the registry in readPublishedVersion, so the version resolver stays on the manifest", async () => {
        expect.hasAssertions();

        await expect(new GradleVersionActions().readPublishedVersion({ pkg: buildPkg(join(root, "core")), pm: {} as never })).resolves.toBeUndefined();
    });
});
