import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyContext, buildContext, publishContext } from "../../../src/release/core/orchestrator";

/**
 * End to end through buildContext and applyContext, with Go module discovery on.
 * `github.com/acme/a` is tagged `a/v1.0.0` and gets a minor bump, planned as 1.1.0.
 * No file is written for it: its go.mod stays byte-identical and no `name@version`
 * tag is created. `b` has no change file, so it is not released.
 */
// git hooks export these; a temp repo must not inherit the outer repository.
delete process.env.GIT_DIR;
delete process.env.GIT_INDEX_FILE;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_PREFIX;

describe.skipIf(process.platform === "win32")("orchestrator: opt-in Go module releases", () => {
    let cwd: string;
    let remote: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const git = (...args: string[]): string =>
        execFileSync("git", ["-c", "tag.gpgsign=false", "-c", "commit.gpgsign=false", ...args], { cwd }).toString();

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-orch-go-")));
        remote = realpathSync(mkdtempSync(join(tmpdir(), "vis-orch-go-remote-")));

        write("package.json", "{\n    \"name\": \"root\",\n    \"private\": true,\n    \"version\": \"0.0.0\"\n}\n");
        write("pnpm-workspace.yaml", "packages: []\n");
        write("go.work", "go 1.22\n\nuse (\n\t./a\n\t./b\n)\n");
        write("a/go.mod", "module github.com/acme/a\n\ngo 1.22\n");
        write("b/go.mod", "module github.com/acme/b\n\ngo 1.22\n");
        write(".vis/release/x.md", "---\n\"github.com/acme/a\": minor\n---\n### Minor a\n\nBody\n");
        write("vis.config.cjs", "module.exports = { release: { acknowledgeUnstable: true, go: { discover: true } } };\n");

        git("init", "-q");
        git("config", "user.email", "ci@example.invalid");
        git("config", "user.name", "ci");
        git("add", ".");
        git("commit", "-q", "-m", "init");
        git("tag", "a/v1.0.0");
        execFileSync("git", ["init", "-q", "--bare", remote]);
        git("remote", "add", "origin", remote);
        git("push", "-q", "origin", "HEAD");
        git("push", "-q", "origin", "a/v1.0.0");
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
        rmSync(remote, { force: true, recursive: true });
    });

    it("plans the minor bump from the tag, leaves go.mod alone, and tags the module's prefixed version", async () => {
        expect.hasAssertions();

        const goMod = "module github.com/acme/a\n\ngo 1.22\n";
        const ctx = await buildContext({ cwd });

        expect(ctx.plan.releases.map((r) => [r.name, r.newVersion])).toStrictEqual([["github.com/acme/a", "1.1.0"]]);

        await applyContext(ctx, { dryRun: false });

        expect(readFileSync(join(cwd, "a/go.mod"), "utf8")).toBe(goMod);

        const published = await publishContext(ctx, {});

        expect(published.tags).toStrictEqual(["a/v1.1.0"]);
        expect(git("tag", "--list").trim().split("\n").sort()).toStrictEqual(["a/v1.0.0", "a/v1.1.0"]);
        expect(git("ls-remote", "--tags", "origin")).toContain("refs/tags/a/v1.1.0");
        expect(git("tag", "--list")).not.toContain("@");
    });
});
