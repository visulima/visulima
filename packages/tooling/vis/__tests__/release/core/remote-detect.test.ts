import { describe, expect, it } from "vitest";

import { createRemoteClient, detectRemoteProvider } from "../../../src/release/core/remote/detect";
import { MockRunner } from "../../../src/release/core/shell-runner";

const mockRunnerWithRemote = (url: string): MockRunner => {
    const runner = new MockRunner();

    runner.on("git", ["config", "--get", "remote.origin.url"], () => {
        return {
            exitCode: 0,
            stderr: "",
            stdout: url,
        };
    });

    return runner;
};

describe(detectRemoteProvider, () => {
    it("respects explicit github config", async () => {
        const runner = new MockRunner();
        const result = await detectRemoteProvider("/r", runner, "github", {});

        expect(result).toBe("github");
    });

    it("respects explicit gitlab config", async () => {
        const runner = new MockRunner();
        const result = await detectRemoteProvider("/r", runner, "gitlab", {});

        expect(result).toBe("gitlab");
    });

    it("treats `auto` as falling through to detection", async () => {
        const runner = mockRunnerWithRemote("https://github.com/owner/repo.git");
        const result = await detectRemoteProvider("/r", runner, "auto", {});

        expect(result).toBe("github");
    });

    it("detects github from GITHUB_ACTIONS env", async () => {
        const runner = new MockRunner();
        const result = await detectRemoteProvider("/r", runner, undefined, { GITHUB_ACTIONS: "true" });

        expect(result).toBe("github");
    });

    it("detects gitlab from GITLAB_CI env", async () => {
        const runner = new MockRunner();
        const result = await detectRemoteProvider("/r", runner, undefined, { GITLAB_CI: "true" });

        expect(result).toBe("gitlab");
    });

    it("falls back to git remote URL when env signal is absent", async () => {
        const runner = mockRunnerWithRemote("git@gitlab.com:owner/repo.git");
        const result = await detectRemoteProvider("/r", runner, undefined, {});

        expect(result).toBe("gitlab");
    });

    it("falls back to github when nothing matches (incl. bitbucket — explicitly unsupported)", async () => {
        const runner = mockRunnerWithRemote("git@bitbucket.org:owner/repo.git");
        const result = await detectRemoteProvider("/r", runner, undefined, {});

        expect(result).toBe("github");
    });

    it("falls back to github when remote URL is unrecognised", async () => {
        const runner = mockRunnerWithRemote("git@example.com:owner/repo.git");
        const result = await detectRemoteProvider("/r", runner, undefined, {});

        expect(result).toBe("github");
    });
});

describe(createRemoteClient, () => {
    it("returns the github client by id", () => {
        expect(createRemoteClient("github").id).toBe("github");
    });

    it("returns the gitlab client by id", () => {
        expect(createRemoteClient("gitlab").id).toBe("gitlab");
    });

    it("gitlab adapter shells out to glab for sticky-comment upsert", async () => {
        const gitlab = createRemoteClient("gitlab");
        const runner = new MockRunner();

        // No glab handler registered → MockRunner returns exitCode !== 0 → adapter
        // returns undefined (soft-fail). The point of this test is to confirm the
        // adapter is wired up (no throw); the per-call retry semantics live in
        // the dedicated remote-gitlab.test.ts suite.
        const result = await gitlab.upsertStickyComment(runner, { body: "hi", cwd: "/r", issueNumber: 1, marker: "<!--m-->", repo: "owner/repo" });

        expect(result).toBeUndefined();
    });

    it("gitlab adapter detects MR id from CI_MERGE_REQUEST_IID", () => {
        expect(createRemoteClient("gitlab").detectPullRequestNumber({ CI_MERGE_REQUEST_IID: "42" })).toBe(42);
    });
});
