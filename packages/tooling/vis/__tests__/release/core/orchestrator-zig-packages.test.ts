import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyContext, buildContext } from "../../../src/release/core/orchestrator";

/**
 * End to end through buildContext and applyContext, with Zig package discovery on.
 * `core` gets a minor bump and its `.version` literal moves. `app` depends on it
 * through a `.path` entry, which carries no version to move, so `app` is not released
 * and its manifest is not touched.
 */
describe.skipIf(process.platform === "win32")("orchestrator: opt-in Zig package releases", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-orch-zig-")));

        write("package.json", "{\n    \"name\": \"root\",\n    \"private\": true,\n    \"version\": \"0.0.0\"\n}\n");
        write("pnpm-workspace.yaml", "packages: []\n");
        write("build.zig.zon", ".{\n    .name = .app,\n    .version = \"1.0.0\",\n    .dependencies = .{\n        .core = .{ .path = \"core\" },\n    },\n    .paths = .{ \"build.zig\" },\n}\n");
        write("core/build.zig.zon", ".{\n    .name = .core,\n    .version = \"1.0.0\",\n    .paths = .{ \"build.zig\" },\n}\n");
        write(".vis/release/x.md", "---\n\"core\": minor\n---\n### Minor core\n\nBody\n");
        write("vis.config.cjs", "module.exports = { release: { acknowledgeUnstable: true, zig: { discover: true } } };\n");
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("bumps the released package's version literal and leaves the package that depends on it alone", async () => {
        expect.hasAssertions();

        const ctx = await buildContext({ cwd });

        expect(ctx.plan.releases.map((r) => [r.name, r.newVersion])).toStrictEqual([["core", "1.1.0"]]);

        await applyContext(ctx, { dryRun: false });

        expect(readFileSync(join(cwd, "core/build.zig.zon"), "utf8")).toContain(".version = \"1.1.0\",");
        expect(readFileSync(join(cwd, "build.zig.zon"), "utf8")).toContain(".version = \"1.0.0\",");
    });
});
