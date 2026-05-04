import { describe, expect, it, vi } from "vitest";

import type { CiContext } from "../../src/ai/ci-context";
import { postPrComment } from "../../src/ai/pr-comment";

const githubContext = (overrides: Partial<CiContext> = {}): CiContext => {
    return {
        apiBaseUrl: undefined,
        prNumber: 42,
        provider: "github-actions",
        repo: "owner/repo",
        sha: "abc123",
        token: "ghs_test",
        ...overrides,
    };
};

const gitlabContext = (overrides: Partial<CiContext> = {}): CiContext => {
    return {
        apiBaseUrl: "https://gitlab.example.com/api/v4",
        prNumber: 7,
        provider: "gitlab-ci",
        repo: "group/proj",
        sha: "abc",
        token: "glpat-test",
        ...overrides,
    };
};

describe(postPrComment, () => {
    it("should skip when there is no PR number (GitHub push event)", async () => {
        expect.assertions(2);

        const result = await postPrComment({
            body: "hi",
            context: githubContext({ prNumber: undefined }),
            // ghBin = "false" so the CLI fallback is never relevant.
            ghBin: "false",
        });

        expect(result.posted).toBe(false);
        expect(result.method).toBe("skipped");
    });

    it("should skip when there is no MR IID (GitLab push pipeline)", async () => {
        expect.assertions(2);

        const result = await postPrComment({
            body: "hi",
            context: gitlabContext({ prNumber: undefined }),
        });

        expect(result.posted).toBe(false);
        expect(result.method).toBe("skipped");
    });

    it("should fall back to GitHub REST when gh CLI is missing", async () => {
        expect.assertions(3);

        const fetchImpl = vi.fn(async () => Response.json({ id: 1 }, { status: 201 }));

        const result = await postPrComment({
            body: "hello",
            context: githubContext(),
            fetchImpl: fetchImpl as unknown as typeof fetch,
            // /bin/false exits non-zero so the gh path "fails" and REST is tried.
            ghBin: "/bin/false",
        });

        expect(result.posted).toBe(true);
        expect(result.method).toBe("rest");
        expect(fetchImpl).toHaveBeenCalledWith(
            "https://api.github.com/repos/owner/repo/issues/42/comments",
            expect.objectContaining({ method: "POST" }),
        );
    });

    it("should report an error when GitHub REST returns non-2xx", async () => {
        expect.assertions(2);

        const fetchImpl = vi.fn(async () => new Response("nope", { status: 401 }));

        const result = await postPrComment({
            body: "hello",
            context: githubContext(),
            fetchImpl: fetchImpl as unknown as typeof fetch,
            ghBin: "/bin/false",
        });

        expect(result.posted).toBe(false);
        expect(result.error).toContain("401");
    });

    it("should encode the GitLab project path and target the notes endpoint", async () => {
        expect.assertions(3);

        const fetchImpl = vi.fn(async () => new Response("{}", { status: 201 }));

        const result = await postPrComment({
            body: "hi",
            context: gitlabContext(),
            fetchImpl: fetchImpl as unknown as typeof fetch,
        });

        expect(result.posted).toBe(true);

        const [url, init] = fetchImpl.mock.calls[0]!;

        expect(url).toBe("https://gitlab.example.com/api/v4/projects/group%2Fproj/merge_requests/7/notes");
        expect((init as RequestInit).headers).toMatchObject({ "PRIVATE-TOKEN": "glpat-test" });
    });

    it("should reject GitLab posts when no token is configured", async () => {
        expect.assertions(2);

        const result = await postPrComment({
            body: "hi",
            context: gitlabContext({ token: undefined }),
        });

        expect(result.posted).toBe(false);
        expect(result.error).toContain("no token");
    });

    it("should reject GitLab posts when CI_API_V4_URL is missing", async () => {
        expect.assertions(2);

        const result = await postPrComment({
            body: "hi",
            context: gitlabContext({ apiBaseUrl: undefined }),
        });

        expect(result.posted).toBe(false);
        expect(result.error).toContain("CI_API_V4_URL");
    });

    it("should skip when provider is unknown", async () => {
        expect.assertions(2);

        const result = await postPrComment({
            body: "hi",
            context: {
                apiBaseUrl: undefined,
                prNumber: undefined,
                provider: "unknown",
                repo: undefined,
                sha: undefined,
                token: undefined,
            },
        });

        expect(result.posted).toBe(false);
        expect(result.method).toBe("skipped");
    });
});
