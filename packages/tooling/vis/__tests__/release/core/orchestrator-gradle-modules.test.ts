import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyContext, buildContext } from "../../../src/release/core/orchestrator";

/**
 * End to end through buildContext and applyContext, with Gradle module discovery
 * on. `a` gets a minor bump and its own `version` literal moves. `b` depends on `a`
 * through `project(":a")`, which carries no version, so `b` is not released and
 * its script is not touched.
 */
describe.skipIf(process.platform === "win32")("orchestrator: opt-in Gradle module releases", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-orch-gradle-")));

        write("package.json", "{\n    \"name\": \"root\",\n    \"private\": true,\n    \"version\": \"0.0.0\"\n}\n");
        write("pnpm-workspace.yaml", "packages: []\n");
        write("settings.gradle.kts", "include(\":a\", \":b\")\n");
        write("build.gradle.kts", "allprojects {\n    group = \"io.visulima\"\n}\n");
        write("a/build.gradle.kts", "version = \"1.0.0\"\n");
        write("b/build.gradle.kts", "version = \"1.0.0\"\n\ndependencies {\n    implementation(project(\":a\"))\n}\n");
        write(".vis/release/x.md", "---\n\"io.visulima:a\": minor\n---\n### Minor a\n\nBody\n");
        write("vis.config.cjs", "module.exports = { release: { acknowledgeUnstable: true, gradle: { discover: true } } };\n");
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("bumps the module's own version literal and leaves the module that depends on it alone", async () => {
        expect.hasAssertions();

        const ctx = await buildContext({ cwd });

        expect(ctx.plan.releases.map((r) => [r.name, r.newVersion])).toStrictEqual([["io.visulima:a", "1.1.0"]]);

        await applyContext(ctx, { dryRun: false });

        expect(readFileSync(join(cwd, "a/build.gradle.kts"), "utf8")).toBe("version = \"1.1.0\"\n");
        expect(readFileSync(join(cwd, "b/build.gradle.kts"), "utf8")).toBe("version = \"1.0.0\"\n\ndependencies {\n    implementation(project(\":a\"))\n}\n");
    });
});
