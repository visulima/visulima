import { describe, expect, it, vi } from "vitest";

import type { ResolveAffectedShasOptions } from "../../src/runtime/affected-shas";
import { resolveAffectedShas } from "../../src/runtime/affected-shas";

const makeOptions = (overrides: Partial<ResolveAffectedShasOptions>): ResolveAffectedShasOptions => {
    return {
        env: {},
        readEventPayload: () => undefined,
        runGit: () => undefined,
        workspaceRoot: "/tmp/ws",
        ...overrides,
    };
};

describe(resolveAffectedShas, () => {
    describe("gitHub Actions provider", () => {
        it("uses GITHUB_BASE_REF on pull_request events", () => {
            expect.assertions(4);

            const result = resolveAffectedShas(
                makeOptions({
                    env: { GITHUB_ACTIONS: "true", GITHUB_BASE_REF: "main", GITHUB_SHA: "abc123" },
                }),
            );

            expect(result.provider).toBe("github");
            expect(result.base).toBe("origin/main");
            expect(result.head).toBe("abc123");
            expect(result.notes[0]).toMatch(/pull_request: \$GITHUB_BASE_REF=main/u);
        });

        it("reads event.before from GITHUB_EVENT_PATH on push events", () => {
            expect.assertions(4);

            const readEventPayload = vi.fn(() => { return { after: "newSha", before: "deadbeef" }; });

            const result = resolveAffectedShas(
                makeOptions({
                    env: { GITHUB_ACTIONS: "true", GITHUB_EVENT_PATH: "/tmp/event.json", GITHUB_SHA: "newSha" },
                    readEventPayload,
                }),
            );

            expect(result.provider).toBe("github");
            expect(result.base).toBe("deadbeef");
            expect(result.head).toBe("newSha");
            expect(readEventPayload).toHaveBeenCalledWith("/tmp/event.json");
        });

        it("ignores all-zero before SHA (new branch push) and falls back to defaultBase", () => {
            expect.assertions(2);

            const result = resolveAffectedShas(
                makeOptions({
                    defaultBase: "trunk",
                    env: { GITHUB_ACTIONS: "true", GITHUB_EVENT_PATH: "/tmp/event.json", GITHUB_SHA: "newSha" },
                    readEventPayload: () => { return { before: "0000000000000000000000000000000000000000" }; },
                }),
            );

            expect(result.base).toBe("origin/trunk");
            expect(result.notes[0]).toBe("fallback: origin/trunk");
        });

        it("falls back to origin/<defaultBase> when neither base ref nor event payload is available", () => {
            expect.assertions(2);

            const result = resolveAffectedShas(
                makeOptions({
                    defaultBase: "develop",
                    env: { GITHUB_ACTIONS: "true", GITHUB_SHA: "headSha" },
                }),
            );

            expect(result.base).toBe("origin/develop");
            expect(result.head).toBe("headSha");
        });
    });

    describe("gitLab CI provider", () => {
        it("uses CI_MERGE_REQUEST_DIFF_BASE_SHA on merge_request events", () => {
            expect.assertions(3);

            const result = resolveAffectedShas(
                makeOptions({
                    env: {
                        CI_COMMIT_SHA: "mrHead",
                        CI_MERGE_REQUEST_DIFF_BASE_SHA: "mrBase",
                        CI_PIPELINE_SOURCE: "merge_request_event",
                        GITLAB_CI: "true",
                    },
                }),
            );

            expect(result.provider).toBe("gitlab");
            expect(result.base).toBe("mrBase");
            expect(result.head).toBe("mrHead");
        });

        it("falls back to CI_MERGE_REQUEST_TARGET_BRANCH_NAME when diff base SHA is unavailable", () => {
            expect.assertions(2);

            const result = resolveAffectedShas(
                makeOptions({
                    env: {
                        CI_COMMIT_SHA: "mrHead",
                        CI_MERGE_REQUEST_TARGET_BRANCH_NAME: "main",
                        CI_PIPELINE_SOURCE: "merge_request_event",
                        GITLAB_CI: "true",
                    },
                }),
            );

            expect(result.base).toBe("origin/main");
            expect(result.head).toBe("mrHead");
        });

        it("uses CI_COMMIT_BEFORE_SHA on push events", () => {
            expect.assertions(2);

            const result = resolveAffectedShas(
                makeOptions({
                    env: {
                        CI_COMMIT_BEFORE_SHA: "deadbeef",
                        CI_COMMIT_SHA: "newSha",
                        CI_PIPELINE_SOURCE: "push",
                        GITLAB_CI: "true",
                    },
                }),
            );

            expect(result.base).toBe("deadbeef");
            expect(result.head).toBe("newSha");
        });

        it("falls back to CI_DEFAULT_BRANCH when no before SHA is available", () => {
            expect.assertions(2);

            const result = resolveAffectedShas(
                makeOptions({
                    env: {
                        CI_COMMIT_BEFORE_SHA: "0000000000000000000000000000000000000000",
                        CI_COMMIT_SHA: "newSha",
                        CI_DEFAULT_BRANCH: "develop",
                        GITLAB_CI: "true",
                    },
                }),
            );

            expect(result.base).toBe("origin/develop");
            expect(result.head).toBe("newSha");
        });
    });

    describe("buildkite provider (naive)", () => {
        it("uses BUILDKITE_PULL_REQUEST_BASE_BRANCH on PR builds", () => {
            expect.assertions(3);

            const result = resolveAffectedShas(
                makeOptions({
                    env: {
                        BUILDKITE: "true",
                        BUILDKITE_COMMIT: "bkSha",
                        BUILDKITE_PULL_REQUEST_BASE_BRANCH: "main",
                    },
                }),
            );

            expect(result.provider).toBe("buildkite");
            expect(result.base).toBe("origin/main");
            expect(result.head).toBe("bkSha");
        });

        it("falls back to origin/<defaultBase> on non-PR builds", () => {
            expect.assertions(2);

            const result = resolveAffectedShas(
                makeOptions({
                    defaultBase: "trunk",
                    env: { BUILDKITE: "true", BUILDKITE_COMMIT: "bkSha" },
                }),
            );

            expect(result.base).toBe("origin/trunk");
            expect(result.notes[0]).toMatch(/buildkite has no canonical previous-build SHA env/u);
        });
    });

    describe("circleCI provider (naive)", () => {
        it("uses CIRCLE_PR_BASE_BRANCH on PR builds", () => {
            expect.assertions(3);

            const result = resolveAffectedShas(
                makeOptions({
                    env: { CIRCLE_PR_BASE_BRANCH: "main", CIRCLE_SHA1: "ccSha", CIRCLECI: "true" },
                }),
            );

            expect(result.provider).toBe("circleci");
            expect(result.base).toBe("origin/main");
            expect(result.head).toBe("ccSha");
        });

        it("falls back to origin/<defaultBase> on non-PR builds", () => {
            expect.assertions(2);

            const result = resolveAffectedShas(
                makeOptions({
                    defaultBase: "master",
                    env: { CIRCLE_SHA1: "ccSha", CIRCLECI: "true" },
                }),
            );

            expect(result.base).toBe("origin/master");
            expect(result.head).toBe("ccSha");
        });
    });

    describe("local provider", () => {
        it("uses git merge-base when no CI is detected", () => {
            expect.assertions(4);

            const runGit = vi.fn(() => "mergeBaseSha");

            const result = resolveAffectedShas(makeOptions({ defaultBase: "main", runGit }));

            expect(result.provider).toBe("local");
            expect(result.base).toBe("mergeBaseSha");
            expect(result.head).toBe("HEAD");
            expect(runGit).toHaveBeenCalledWith(["merge-base", "HEAD", "origin/main"], "/tmp/ws");
        });

        it("falls back to origin/<defaultBase> when merge-base fails (shallow clone, no upstream)", () => {
            expect.assertions(2);

            const result = resolveAffectedShas(makeOptions({ defaultBase: "main", runGit: () => undefined }));

            expect(result.base).toBe("origin/main");
            expect(result.notes[0]).toMatch(/local fallback: origin\/main/u);
        });

        it("honours a custom defaultBase", () => {
            expect.assertions(2);

            const runGit = vi.fn(() => "anchor");

            const result = resolveAffectedShas(makeOptions({ defaultBase: "trunk", runGit }));

            expect(result.base).toBe("anchor");
            expect(runGit).toHaveBeenCalledWith(["merge-base", "HEAD", "origin/trunk"], "/tmp/ws");
        });
    });

    describe("provider precedence", () => {
        it("prefers GitHub over GitLab when both env vars are set", () => {
            expect.assertions(1);

            const result = resolveAffectedShas(
                makeOptions({
                    env: { GITHUB_ACTIONS: "true", GITHUB_SHA: "x", GITLAB_CI: "true" },
                }),
            );

            expect(result.provider).toBe("github");
        });
    });

    describe("defaultBase default", () => {
        it("defaults to `main` when no defaultBase is provided", () => {
            expect.assertions(1);

            const result = resolveAffectedShas(
                makeOptions({
                    env: { GITHUB_ACTIONS: "true", GITHUB_SHA: "x" },
                }),
            );

            expect(result.base).toBe("origin/main");
        });
    });
});
