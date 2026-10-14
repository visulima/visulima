import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyContext, buildContext } from "../../../src/release/core/orchestrator";

// git hooks export these; a temp repo must not inherit the outer repository.
delete process.env.GIT_DIR;
delete process.env.GIT_INDEX_FILE;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_PREFIX;

const project = (version: string, extra = ""): string =>
    `<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n    <Version>${version}</Version>\n${extra}  </PropertyGroup>\n</Project>\n`;

/**
 * End to end through buildContext and applyContext, with NuGet discovery on. `a` gets a
 * minor bump and its project file's version literal moves. `b` depends on `a` through a
 * ProjectReference, which carries no version, so `b` is not released and its file is untouched.
 */
describe.skipIf(process.platform === "win32")("orchestrator: opt-in NuGet releases", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-orch-nuget-")));

        write("package.json", "{\n    \"name\": \"root\",\n    \"private\": true,\n    \"version\": \"0.0.0\"\n}\n");
        write("pnpm-workspace.yaml", "packages: []\n");
        write("a/a.csproj", project("1.0.0"));
        write("b/b.csproj", project("1.0.0", "    <ProjectReference Include=\"../a/a.csproj\" />\n"));
        write(".vis/release/x.md", "---\n\"a\": minor\n---\n### Minor a\n\nBody\n");
        write("vis.config.cjs", "module.exports = { release: { acknowledgeUnstable: true, nuget: { discover: true } } };\n");
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("bumps the project's own version literal and leaves the project that depends on it alone", async () => {
        expect.hasAssertions();

        const ctx = await buildContext({ cwd });

        expect(ctx.plan.releases.map((r) => [r.name, r.newVersion])).toStrictEqual([["a", "1.1.0"]]);

        await applyContext(ctx, { dryRun: false });

        expect(readFileSync(join(cwd, "a/a.csproj"), "utf8")).toContain("<Version>1.1.0</Version>");
        expect(readFileSync(join(cwd, "b/b.csproj"), "utf8")).toBe(project("1.0.0", "    <ProjectReference Include=\"../a/a.csproj\" />\n"));
    });
});
