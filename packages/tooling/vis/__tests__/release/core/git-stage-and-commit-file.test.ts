import { describe, expect, it } from "vitest";

import { stageAndCommitFile } from "../../../src/release/core/git";
import { MockRunner } from "../../../src/release/core/shell-runner";

/**
 * Coverage for the housekeeping-commit helper used by the publish flow to
 * persist the staged-publish registry. The interesting behaviour is the
 * no-op short-circuit: if nothing is actually different on disk, we must
 * NOT call `git commit` — otherwise every publish wave would create a
 * `chore(release): record 0 pending stages [skip ci]` noise commit.
 */
describe("git: stageAndCommitFile", () => {
    it("no-op when `git diff --cached` reports no change after staging", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        const calls: string[] = [];

        runner.on("git", ["add"], (cwd) => {
            calls.push(`add@${cwd}`);

            return { exitCode: 0, stderr: "", stdout: "" };
        });

        runner.on("git", ["diff", "--cached", "--quiet"], () => {
            calls.push("diff");

            // exit 0 → nothing staged
            return { exitCode: 0, stderr: "", stdout: "" };
        });

        runner.on("git", ["commit"], () => {
            calls.push("commit");

            return { exitCode: 0, stderr: "", stdout: "" };
        });

        const result = await stageAndCommitFile(
            { cwd: "/r", runner },
            ".vis/release/staged.json",
            "chore(release): noop [skip ci]",
        );

        expect(result.committed).toBe(false);
        expect(result.pushed).toBe(false);
        expect(calls).not.toContain("commit");
    });

    it("commits when the file has staged changes", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        let committed = false;

        runner.on("git", ["add"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        // exit 1 from `git diff --cached --quiet` => something IS staged
        runner.on("git", ["diff", "--cached", "--quiet"], () => { return { exitCode: 1, stderr: "", stdout: "" }; });
        runner.on("git", ["commit"], () => {
            committed = true;

            return { exitCode: 0, stderr: "", stdout: "" };
        });

        const result = await stageAndCommitFile(
            { cwd: "/r", runner },
            ".vis/release/staged.json",
            "chore(release): record 1 pending stage [skip ci]",
        );

        expect(committed).toBe(true);
        expect(result.committed).toBe(true);
        expect(result.pushed).toBe(false);
    });

    it("pushes when `push: true` and a branch is resolvable", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        let pushed = false;

        runner.on("git", ["add"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        runner.on("git", ["diff", "--cached", "--quiet"], () => { return { exitCode: 1, stderr: "", stdout: "" }; });
        runner.on("git", ["commit"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        runner.on("git", ["rev-parse", "--abbrev-ref", "HEAD"], () => { return { exitCode: 0, stderr: "", stdout: "alpha\n" }; });
        runner.on("git", ["push", "origin", "HEAD:alpha"], () => {
            pushed = true;

            return { exitCode: 0, stderr: "", stdout: "" };
        });

        const result = await stageAndCommitFile(
            { cwd: "/r", runner },
            ".vis/release/staged.json",
            "chore: [skip ci]",
            { push: true },
        );

        expect(pushed).toBe(true);
        expect(result.pushed).toBe(true);
    });

    it("commits but does NOT push when push is false", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        let pushed = false;

        runner.on("git", ["add"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        runner.on("git", ["diff", "--cached", "--quiet"], () => { return { exitCode: 1, stderr: "", stdout: "" }; });
        runner.on("git", ["commit"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        runner.on("git", ["push"], () => {
            pushed = true;

            return { exitCode: 0, stderr: "", stdout: "" };
        });

        const result = await stageAndCommitFile(
            { cwd: "/r", runner },
            ".vis/release/staged.json",
            "chore: [skip ci]",
            { push: false },
        );

        expect(result.committed).toBe(true);
        expect(result.pushed).toBe(false);
        expect(pushed).toBe(false);
    });

    it("returns pushed=false when push attempt fails (soft-fail)", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("git", ["add"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        runner.on("git", ["diff", "--cached", "--quiet"], () => { return { exitCode: 1, stderr: "", stdout: "" }; });
        runner.on("git", ["commit"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        runner.on("git", ["rev-parse", "--abbrev-ref", "HEAD"], () => { return { exitCode: 0, stderr: "", stdout: "alpha\n" }; });
        runner.on("git", ["push", "origin", "HEAD:alpha"], () => {
            return {
                exitCode: 1,
                stderr: "remote rejected",
                stdout: "",
            };
        });

        const result = await stageAndCommitFile(
            { cwd: "/r", runner },
            ".vis/release/staged.json",
            "chore: [skip ci]",
            { push: true },
        );

        expect(result.committed).toBe(true);
        expect(result.pushed).toBe(false);
    });

    it("skips the push step when no branch is resolvable (detached HEAD)", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        let pushed = false;

        runner.on("git", ["add"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        runner.on("git", ["diff", "--cached", "--quiet"], () => { return { exitCode: 1, stderr: "", stdout: "" }; });
        runner.on("git", ["commit"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        runner.on("git", ["rev-parse", "--abbrev-ref", "HEAD"], () => { return { exitCode: 0, stderr: "", stdout: "HEAD\n" }; });
        runner.on("git", ["push"], () => {
            pushed = true;

            return { exitCode: 0, stderr: "", stdout: "" };
        });

        const result = await stageAndCommitFile(
            { cwd: "/r", runner },
            ".vis/release/staged.json",
            "chore: [skip ci]",
            { push: true },
        );

        expect(result.committed).toBe(true);
        expect(result.pushed).toBe(false);
        expect(pushed).toBe(false);
    });

    it("commits with author when provided (smoke test — env propagation is exercised by stageAndCommit's test)", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        let committed = false;

        runner.on("git", ["add"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        runner.on("git", ["diff", "--cached", "--quiet"], () => { return { exitCode: 1, stderr: "", stdout: "" }; });
        runner.on("git", ["commit"], () => {
            committed = true;

            return { exitCode: 0, stderr: "", stdout: "" };
        });

        await stageAndCommitFile(
            { cwd: "/r", runner },
            ".vis/release/staged.json",
            "chore: [skip ci]",
            { author: { email: "bot@example.com", name: "Bot" } },
        );

        expect(committed).toBe(true);
    });
});
