import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyContext, buildContext } from "../../../src/release/core/orchestrator";

/**
 * End to end through buildContext and applyContext, with gem discovery on. `a` gets a
 * minor bump and its gemspec's version literal moves. `b` depends on `a` through
 * `add_dependency`, which carries no version, so `b` is not released and its gemspec
 * is not touched.
 */
describe.skipIf(process.platform === "win32")("orchestrator: opt-in gem releases", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-orch-gem-")));

        write("package.json", "{\n    \"name\": \"root\",\n    \"private\": true,\n    \"version\": \"0.0.0\"\n}\n");
        write("pnpm-workspace.yaml", "packages: []\n");
        write("a/a.gemspec", "Gem::Specification.new do |spec|\n  spec.name = \"a\"\n  spec.version = \"1.0.0\"\nend\n");
        write("b/b.gemspec", "Gem::Specification.new do |spec|\n  spec.name = \"b\"\n  spec.version = \"1.0.0\"\n  spec.add_dependency \"a\"\nend\n");
        write(".vis/release/x.md", "---\n\"a\": minor\n---\n### Minor a\n\nBody\n");
        write("vis.config.cjs", "module.exports = { release: { acknowledgeUnstable: true, gem: { discover: true } } };\n");
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("bumps the gem's own version literal and leaves the gem that depends on it alone", async () => {
        expect.hasAssertions();

        const ctx = await buildContext({ cwd });

        expect(ctx.plan.releases.map((r) => [r.name, r.newVersion])).toStrictEqual([["a", "1.1.0"]]);

        await applyContext(ctx, { dryRun: false });

        expect(readFileSync(join(cwd, "a/a.gemspec"), "utf8")).toBe(
            "Gem::Specification.new do |spec|\n  spec.name = \"a\"\n  spec.version = \"1.1.0\"\nend\n",
        );
        expect(readFileSync(join(cwd, "b/b.gemspec"), "utf8")).toBe(
            "Gem::Specification.new do |spec|\n  spec.name = \"b\"\n  spec.version = \"1.0.0\"\n  spec.add_dependency \"a\"\nend\n",
        );
    });
});
