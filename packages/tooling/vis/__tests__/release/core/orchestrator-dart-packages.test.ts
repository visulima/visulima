import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyContext, buildContext } from "../../../src/release/core/orchestrator";

/**
 * End to end through buildContext and applyContext, with Dart discovery on. `core` is
 * a pub workspace member that gets a minor bump, and its `version:` literal moves.
 * `app` depends on it by name, so it is ordered after `core`, and it is not released.
 */
describe.skipIf(process.platform === "win32")("orchestrator: opt-in Dart package releases", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-orch-dart-")));

        write("package.json", "{\n    \"name\": \"root\",\n    \"private\": true,\n    \"version\": \"0.0.0\"\n}\n");
        write("pnpm-workspace.yaml", "packages: []\n");
        write("pubspec.yaml", "name: root\npublish_to: none\nworkspace:\n  - packages/*\n");
        write("packages/core/pubspec.yaml", "name: core\nversion: 1.0.0\nresolution: workspace\n");
        write("packages/app/pubspec.yaml", "name: app\nversion: 1.0.0\nresolution: workspace\ndependencies:\n  core: ^1.0.0\n");
        write(".vis/release/x.md", "---\n\"core\": minor\n---\n### Minor core\n\nBody\n");
        write("vis.config.cjs", "module.exports = { release: { acknowledgeUnstable: true, dart: { discover: true } } };\n");
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("bumps the released member's version literal and leaves the dependent alone", async () => {
        expect.hasAssertions();

        const ctx = await buildContext({ cwd });

        expect(ctx.plan.releases.map((r) => [r.name, r.newVersion])).toStrictEqual([["core", "1.1.0"]]);

        await applyContext(ctx, { dryRun: false });

        expect(readFileSync(join(cwd, "packages/core/pubspec.yaml"), "utf8")).toContain("version: 1.1.0");
        expect(readFileSync(join(cwd, "packages/app/pubspec.yaml"), "utf8")).toContain("version: 1.0.0");
    });
});
