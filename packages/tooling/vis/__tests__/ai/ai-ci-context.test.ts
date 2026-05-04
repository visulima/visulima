import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { detectCiContext } from "../../src/ai/ci-context";

const baseEnv: NodeJS.ProcessEnv = {};

describe(detectCiContext, () => {
    it("should return unknown provider when no CI env is set", async () => {
        expect.assertions(1);

        const ctx = await detectCiContext(baseEnv);

        expect(ctx.provider).toBe("unknown");
    });

    describe("github actions", () => {
        it("should parse PR number from refs/pull/<n>/merge", async () => {
            expect.assertions(3);

            const ctx = await detectCiContext({
                GITHUB_ACTIONS: "true",
                GITHUB_REF: "refs/pull/1234/merge",
                GITHUB_REPOSITORY: "owner/repo",
                GITHUB_SHA: "abc123",
                GITHUB_TOKEN: "ghs_xxx",
            });

            expect(ctx.provider).toBe("github-actions");
            expect(ctx.prNumber).toBe(1234);
            expect(ctx.repo).toBe("owner/repo");
        });

        it("should fall back to GITHUB_EVENT_PATH when GITHUB_REF is not a PR ref", async () => {
            expect.assertions(2);

            const dir = mkdtempSync(join(tmpdir(), "vis-ci-context-"));

            try {
                const eventPath = join(dir, "event.json");

                writeFileSync(eventPath, JSON.stringify({ pull_request: { head: { sha: "deadbeef" }, number: 99 } }));

                const ctx = await detectCiContext({
                    GITHUB_ACTIONS: "true",
                    GITHUB_EVENT_PATH: eventPath,
                    GITHUB_REF: "refs/heads/main",
                    GITHUB_REPOSITORY: "owner/repo",
                    GITHUB_SHA: "synthetic-merge-sha",
                });

                expect(ctx.prNumber).toBe(99);
                // Prefers PR head SHA from event payload over the synthetic merge SHA in GITHUB_SHA.
                expect(ctx.sha).toBe("deadbeef");
            } finally {
                rmSync(dir, { force: true, recursive: true });
            }
        });

        it("should leave prNumber undefined for push-event runs", async () => {
            expect.assertions(2);

            const ctx = await detectCiContext({
                GITHUB_ACTIONS: "true",
                GITHUB_REF: "refs/heads/main",
                GITHUB_REPOSITORY: "owner/repo",
                GITHUB_SHA: "abc123",
            });

            expect(ctx.prNumber).toBeUndefined();
            expect(ctx.sha).toBe("abc123");
        });

        it("should not crash when GITHUB_EVENT_PATH points at a missing file", async () => {
            expect.assertions(2);

            const ctx = await detectCiContext({
                GITHUB_ACTIONS: "true",
                GITHUB_EVENT_PATH: "/nonexistent/path/event.json",
                GITHUB_REF: "refs/heads/main",
                GITHUB_REPOSITORY: "owner/repo",
            });

            expect(ctx.provider).toBe("github-actions");
            expect(ctx.prNumber).toBeUndefined();
        });
    });

    describe("gitlab CI", () => {
        it("should parse MR IID and prefer GITLAB_TOKEN over CI_TOKEN", async () => {
            expect.assertions(5);

            const ctx = await detectCiContext({
                CI_API_V4_URL: "https://gitlab.example.com/api/v4",
                CI_COMMIT_SHA: "abc123",
                CI_MERGE_REQUEST_IID: "42",
                CI_PROJECT_ID: "999",
                CI_TOKEN: "ci-token-fallback",
                GITLAB_CI: "true",
                GITLAB_TOKEN: "preferred-token",
            });

            expect(ctx.provider).toBe("gitlab-ci");
            expect(ctx.prNumber).toBe(42);
            expect(ctx.apiBaseUrl).toBe("https://gitlab.example.com/api/v4");
            expect(ctx.repo).toBe("999");
            expect(ctx.token).toBe("preferred-token");
        });

        it("should fall back to CI_PROJECT_PATH when CI_PROJECT_ID is missing", async () => {
            expect.assertions(2);

            const ctx = await detectCiContext({
                CI_API_V4_URL: "https://gitlab.com/api/v4",
                CI_COMMIT_SHA: "abc",
                CI_MERGE_REQUEST_IID: "1",
                CI_PROJECT_PATH: "group/proj",
                GITLAB_CI: "true",
            });

            expect(ctx.repo).toBe("group/proj");
            expect(ctx.token).toBeUndefined();
        });

        it("should not include CI_JOB_TOKEN as a token (it cannot post MR notes)", async () => {
            expect.assertions(1);

            const ctx = await detectCiContext({
                CI_API_V4_URL: "https://gitlab.com/api/v4",
                CI_JOB_TOKEN: "job-token-rejected",
                CI_MERGE_REQUEST_IID: "1",
                CI_PROJECT_ID: "1",
                GITLAB_CI: "true",
            });

            expect(ctx.token).toBeUndefined();
        });

        it("should leave prNumber undefined for push pipelines", async () => {
            expect.assertions(1);

            const ctx = await detectCiContext({
                CI_API_V4_URL: "https://gitlab.com/api/v4",
                CI_COMMIT_SHA: "abc",
                CI_PROJECT_ID: "1",
                GITLAB_CI: "true",
            });

            expect(ctx.prNumber).toBeUndefined();
        });
    });
});
