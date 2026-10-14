import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyContext, buildContext } from "../../../src/release/core/orchestrator";

/**
 * End to end through buildContext and applyContext, with uv workspace discovery
 * on. A minor bump of `core-lib` breaks its dependent's `&lt;0.2` specifier, so the
 * dependent gets a patch bump, both uv.lock entries move, and the stale specifier
 * is reported rather than rewritten.
 */
describe.skipIf(process.platform === "win32")("orchestrator: opt-in uv workspace releases", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-orch-py-")));

        write("package.json", "{\n    \"name\": \"root\",\n    \"private\": true,\n    \"version\": \"0.0.0\"\n}\n");
        write("pnpm-workspace.yaml", "packages: []\n");
        write("pyproject.toml", "[project]\nname = \"root\"\nversion = \"0.0.0\"\n\n[tool.uv.workspace]\nmembers = [\"packages/*\"]\n");
        write("uv.lock", "version = 1\n\n[[package]]\nname = \"core-lib\"\nversion = \"0.1.0\"\nsource = { editable = \"packages/core\" }\n\n[[package]]\nname = \"app\"\nversion = \"0.1.0\"\nsource = { editable = \"packages/app\" }\n");
        write("packages/core/pyproject.toml", "[project]\nname = \"core-lib\"\nversion = \"0.1.0\"\n");
        write(
            "packages/app/pyproject.toml",
            "[project]\nname = \"app\"\nversion = \"0.1.0\"\ndependencies = [\"core-lib<0.2\"]\n\n[tool.uv.sources]\ncore-lib = { workspace = true }\n",
        );
        write(".vis/release/x.md", "---\ncore-lib: minor\n---\n### Minor core\n\nBody\n");
        write("vis.config.cjs", "module.exports = { release: { acknowledgeUnstable: true, python: { discover: true } } };\n");
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("bumps both projects and their uv.lock entries", async () => {
        expect.hasAssertions();

        const ctx = await buildContext({ cwd });

        expect(ctx.plan.releases.map((r) => [r.name, r.newVersion]).sort()).toStrictEqual([
            ["app", "0.1.1"],
            ["core-lib", "0.2.0"],
        ]);

        await applyContext(ctx, { dryRun: false });

        expect(readFileSync(join(cwd, "packages", "core", "pyproject.toml"), "utf8")).toContain("version = \"0.2.0\"");
        expect(readFileSync(join(cwd, "packages", "app", "pyproject.toml"), "utf8")).toContain("version = \"0.1.1\"");
        expect(readFileSync(join(cwd, "packages", "app", "pyproject.toml"), "utf8")).toContain("core-lib<0.2");

        const lock = readFileSync(join(cwd, "uv.lock"), "utf8");

        expect(lock).toContain("name = \"core-lib\"\nversion = \"0.2.0\"");
        expect(lock).toContain("name = \"app\"\nversion = \"0.1.1\"");
    });

    it("reports the specifier that now excludes the new version", async () => {
        expect.hasAssertions();

        const ctx = await buildContext({ cwd });

        await applyContext(ctx, { dryRun: false });

        expect(ctx.plan.warnings.join("\n")).toContain("requires core-lib<0.2, which excludes 0.2.0");
    });

    it("discovers no projects unless release.python.discover is on", async () => {
        expect.hasAssertions();

        write("vis.config.cjs", "module.exports = { release: { acknowledgeUnstable: true } };\n");

        const ctx = await buildContext({ cwd });

        expect(ctx.packages.filter((pkg) => pkg.ecosystem === "python")).toStrictEqual([]);
    });
});
