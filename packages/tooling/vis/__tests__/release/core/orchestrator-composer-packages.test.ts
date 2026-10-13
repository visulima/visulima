import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyContext, buildContext, publishContext } from "../../../src/release/core/orchestrator";

/**
 * End to end through buildContext, applyContext and publishContext, with Composer package
 * discovery on. The root `composer.json` is released at its tag: a patch bump plans 1.0.1,
 * the file stays byte-identical (Composer has no version field), and the only tag created
 * is `v1.0.1`, with no `acme/tool@1.0.1` next to it.
 */
// git hooks export these; a temp repo must not inherit the outer repository.
delete process.env.GIT_DIR;
delete process.env.GIT_INDEX_FILE;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_PREFIX;

describe.skipIf(process.platform === "win32")("orchestrator: opt-in Composer package releases", () => {
    let cwd: string;
    let remote: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const git = (...args: string[]): string => execFileSync("git", ["-c", "tag.gpgsign=false", "-c", "commit.gpgsign=false", ...args], { cwd }).toString();

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-orch-composer-")));
        remote = realpathSync(mkdtempSync(join(tmpdir(), "vis-orch-composer-remote-")));

        write("package.json", "{\n    \"name\": \"root\",\n    \"private\": true,\n    \"version\": \"0.0.0\"\n}\n");
        write("pnpm-workspace.yaml", "packages: []\n");
        write("composer.json", "{\n    \"name\": \"acme/tool\",\n    \"require\": {\n        \"php\": \"^8.2\"\n    }\n}\n");
        write(".vis/release/x.md", "---\n\"acme/tool\": patch\n---\n### Patch tool\n\nBody\n");
        write("vis.config.cjs", "module.exports = { release: { acknowledgeUnstable: true, composer: { discover: true } } };\n");

        git("init", "-q");
        git("config", "user.email", "ci@example.invalid");
        git("config", "user.name", "ci");
        git("add", ".");
        git("commit", "-q", "-m", "init");
        git("tag", "v1.0.0");
        execFileSync("git", ["init", "-q", "--bare", remote]);
        git("remote", "add", "origin", remote);
        git("push", "-q", "origin", "HEAD");
        git("push", "-q", "origin", "v1.0.0");
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
        rmSync(remote, { force: true, recursive: true });
    });

    it("plans the patch from the tag, leaves composer.json alone, and tags v-prefixed only", async () => {
        expect.hasAssertions();

        const manifest = readFileSync(join(cwd, "composer.json"), "utf8");
        const ctx = await buildContext({ cwd });

        expect(ctx.plan.releases.map((r) => [r.name, r.newVersion])).toStrictEqual([["acme/tool", "1.0.1"]]);

        await applyContext(ctx, { dryRun: false });

        expect(readFileSync(join(cwd, "composer.json"), "utf8")).toBe(manifest);

        const published = await publishContext(ctx, {});

        expect(published.tags).toStrictEqual(["v1.0.1"]);
        expect(git("tag", "--list").trim().split("\n").sort()).toStrictEqual(["v1.0.0", "v1.0.1"]);
        expect(git("ls-remote", "--tags", "origin")).toContain("refs/tags/v1.0.1");
        expect(git("tag", "--list")).not.toContain("@");
    });

    it("records a failed tag creation in failed, so the publish is not reported as a success", async () => {
        expect.hasAssertions();

        const ctx = await buildContext({ cwd });

        await applyContext(ctx, { dryRun: false });

        // The tag exists only on the remote, so createTag's remote pre-check throws TAG_COLLISION.
        git("tag", "v1.0.1");
        git("push", "-q", "origin", "v1.0.1");
        git("tag", "-d", "v1.0.1");

        const published = await publishContext(ctx, {});

        expect(published.tags).toStrictEqual([]);
        expect(published.failed).toContainEqual(expect.objectContaining({ name: "v1.0.1", reason: expect.stringContaining("tag-creation") }));
    });
});
