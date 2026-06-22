import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DependencyGraph } from "../../../src/release/core/dep-graph";
import type { OrchestratorContext } from "../../../src/release/core/orchestrator";
import { MockRunner } from "../../../src/release/core/shell-runner";
import { runSnapshot } from "../../../src/release/core/snapshot";
import type { WorkspacePackage } from "../../../src/release/types";

const mkPkg = (name: string, version = "1.0.0"): WorkspacePackage => {
    return {
        dir: `/r/packages/${name.replace(/^@.+\//, "")}`,
        manifest: { name, version },
        manifestPath: `/r/packages/${name.replace(/^@.+\//, "")}/package.json`,
        name,
        private: false,
        version,
    };
};

const mkPrivatePkg = (name: string): WorkspacePackage => {
    return {
        ...mkPkg(name),
        manifest: { name, private: true, version: "1.0.0" },
        private: true,
    };
};

const mkContext = (packages: WorkspacePackage[], runner: MockRunner): OrchestratorContext => {
    return {
        config: { changelog: "default", changesDir: ".vis/release" },
        cwd: "/r",
        depGraph: new DependencyGraph(packages),
        firstRelease: false,
        packages,
        perPackageConfig: new Map(),
        plan: { consumedChangeFiles: [], releases: [], warnings: [] },
        pm: {
            async detectVersion() { return "11.0.0"; },
            id: "npm",
            async installLockfileOnly() {},
            async listWorkspacePackages() { return []; },
            minVersion: "11.0.0",
            async pack() { throw new Error("not stubbed"); },
            async publish() { throw new Error("not stubbed"); },
            async readCatalogYaml() { return undefined; },
            runner,
        } as never,
    };
};

describe(runSnapshot, () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-snap-"));
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("requires a working git repo (throws when sha is unresolvable)", async () => {
        const runner = new MockRunner();
        // No git handlers → getCurrentSha returns undefined.

        const ctx = mkContext([mkPkg("a")], runner);

        await expect(runSnapshot({ context: ctx, runner, tag: "pr-1" })).rejects.toThrow(/Could not resolve git HEAD/);
    });

    it("computes the snapshot version from the configured template", async () => {
        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "abcdef0123456789\n" };
        });
        runner.on("git", ["rev-parse", "--short", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "abcdef0\n" };
        });

        const ctx = mkContext([], runner);
        const result = await runSnapshot({ context: ctx, dryRun: true, runner, tag: "pr-1234" });

        expect(result.snapshotVersion).toBe("0.0.0-pr-1234-abcdef0");
        expect(result.tag).toBe("pr-1234");
    });

    it("supports custom version templates with all placeholders", async () => {
        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "abcdef0123456789\n" };
        });
        runner.on("git", ["rev-parse", "--short", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "abcdef0\n" };
        });

        const ctx = mkContext([], runner);

        ctx.config.snapshot = { versionTemplate: "{tag}+{sha}" };

        const result = await runSnapshot({ context: ctx, dryRun: true, runner, tag: "preview" });

        expect(result.snapshotVersion).toBe("preview+abcdef0123456789");
    });

    it("excludes private packages from snapshot publishing", async () => {
        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "abcdef0\n" };
        });
        runner.on("git", ["rev-parse", "--short", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "abc\n" };
        });

        const ctx = mkContext([mkPkg("@scope/public"), mkPrivatePkg("@scope/internal")], runner);

        const result = await runSnapshot({ context: ctx, dryRun: true, runner, tag: "x" });

        expect(result.published.map((p) => p.name)).toStrictEqual(["@scope/public"]);
    });

    it("--filter narrows the target set", async () => {
        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "abc\n" };
        });
        runner.on("git", ["rev-parse", "--short", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "abc\n" };
        });

        const ctx = mkContext([mkPkg("@scope/a"), mkPkg("@scope/b"), mkPkg("@other/c")], runner);

        const result = await runSnapshot({ context: ctx, dryRun: true, filter: "@scope/*", runner, tag: "x" });

        expect(result.published.map((p) => p.name).sort()).toStrictEqual(["@scope/a", "@scope/b"]);
    });
});
