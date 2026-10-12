import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyContext, buildContext } from "../../../src/release/core/orchestrator";

const manifest = "import PackageDescription\n\nlet package = Package(\n    name: \"mylib\",\n    targets: [.target(name: \"MyLib\")]\n)\n";

// Git hooks export GIT_DIR and GIT_INDEX_FILE for the repository they run in. Those must not leak into
// the throwaway repository below, so every GIT_* variable is dropped before the commands run.
const git = (cwd: string, args: string[]): void => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

    execFileSync("git", args, {
        cwd,
        env: { ...env, GIT_AUTHOR_EMAIL: "t@example.com", GIT_AUTHOR_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "tag.gpgsign", GIT_CONFIG_VALUE_0: "false" },
        stdio: "ignore",
    });
};

/**
 * End to end through buildContext and applyContext, with Swift discovery on. The
 * version is read from the Git tag (no manifest write), and the release tag is the
 * bare version. The manifest bytes are never rewritten.
 */
describe.skipIf(process.platform === "win32")("orchestrator: opt-in Swift package releases", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-orch-swift-")));

        write("package.json", "{\n    \"name\": \"root\",\n    \"private\": true,\n    \"version\": \"0.0.0\"\n}\n");
        write("pnpm-workspace.yaml", "packages: []\n");
        write("Package.swift", manifest);
        write(".vis/release/x.md", "---\n\"mylib\": minor\n---\n### Minor mylib\n\nBody\n");
        write("vis.config.cjs", "module.exports = { release: { acknowledgeUnstable: true, swift: { discover: true } } };\n");

        git(cwd, ["init", "-q"]);
        git(cwd, ["add", "."]);
        git(cwd, ["commit", "-q", "-m", "init"]);
        git(cwd, ["tag", "1.0.0"]);
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("reads the version from the tag, bumps from it, and leaves Package.swift unchanged", async () => {
        expect.hasAssertions();

        const ctx = await buildContext({ cwd });

        expect(ctx.plan.releases.map((r) => [r.name, r.oldVersion, r.newVersion])).toStrictEqual([["mylib", "1.0.0", "1.1.0"]]);
        expect(ctx.perPackageConfig.get("mylib")?.releaseTagPattern).toBe("{version}");

        await applyContext(ctx, { dryRun: false });

        expect(readFileSync(join(cwd, "Package.swift"), "utf8")).toBe(manifest);
    });

    it("keeps the workspace tag pattern for a nested package, so two packages never share a bare tag", async () => {
        expect.hasAssertions();

        write("tools/cli/Package.swift", manifest.replace("mylib", "mycli"));

        const ctx = await buildContext({ cwd });

        expect(ctx.perPackageConfig.get("mycli")?.releaseTagPattern).toBeUndefined();
        expect(ctx.perPackageConfig.get("mylib")?.releaseTagPattern).toBe("{version}");
    });

    it("discovers nothing without release.swift.discover", async () => {
        expect.hasAssertions();

        write("vis.config.cjs", "module.exports = { release: { acknowledgeUnstable: true } };\n");

        const ctx = await buildContext({ cwd });

        expect(ctx.packages.some((pkg) => pkg.name === "mylib")).toBe(false);
    });
});
