import { describe, expect, it, vi } from "vitest";

import type { CiContext } from "../../src/ai/ci-context";
import { postPrComment } from "../../src/ai/pr-comment";

const githubContext = (overrides: Partial<CiContext> = {}): CiContext => {
    return {
        apiBaseUrl: undefined,
        buildId: undefined,
        buildNumber: undefined,
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
        buildId: undefined,
        buildNumber: undefined,
        prNumber: 7,
        provider: "gitlab-ci",
        repo: "group/proj",
        sha: "abc",
        token: "glpat-test",
        ...overrides,
    };
};

const buildkiteContext = (overrides: Partial<CiContext> = {}): CiContext => {
    return {
        apiBaseUrl: "https://api.buildkite.com",
        buildId: "01HXYZ-build-id",
        buildNumber: 123,
        prNumber: 42,
        provider: "buildkite",
        repo: "acme/web",
        sha: "abc123",
        token: "bkua_test",
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
            fetchImpl,
            // /bin/false exits non-zero so the gh path "fails" and REST is tried.
            ghBin: "/bin/false",
        });

        expect(result.posted).toBe(true);
        expect(result.method).toBe("rest");
        expect(fetchImpl).toHaveBeenCalledWith("https://api.github.com/repos/owner/repo/issues/42/comments", expect.objectContaining({ method: "POST" }));
    });

    it("should report an error when GitHub REST returns non-2xx", async () => {
        expect.assertions(2);

        const fetchImpl = vi.fn(async () => new Response("nope", { status: 401 }));

        const result = await postPrComment({
            body: "hello",
            context: githubContext(),
            fetchImpl,
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
            fetchImpl,
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

    it("should annotate via buildkite-agent CLI when it succeeds", async () => {
        expect.assertions(3);

        const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

        const result = await postPrComment({
            body: "vis ai heal proposed a patch",
            // /bin/true exits 0 — the CLI path "succeeds" so REST is never hit.
            buildkiteAgentBin: "/bin/true",
            context: buildkiteContext(),
            fetchImpl,
        });

        expect(result.posted).toBe(true);
        expect(result.method).toBe("buildkite-cli");
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("should fall back to Buildkite REST when buildkite-agent is missing", async () => {
        expect.assertions(4);

        const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

        const result = await postPrComment({
            body: "hello",
            // /bin/false exits 1 → CLI fails → REST fallback.
            buildkiteAgentBin: "/bin/false",
            context: buildkiteContext(),
            fetchImpl,
        });

        expect(result.posted).toBe(true);
        expect(result.method).toBe("rest");

        const [url, init] = fetchImpl.mock.calls[0]!;

        expect(url).toBe("https://api.buildkite.com/v2/organizations/acme/pipelines/web/builds/123/annotations");
        expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer bkua_test" });
    });

    it("should refuse REST fallback when BUILDKITE_API_TOKEN is missing", async () => {
        expect.assertions(2);

        const result = await postPrComment({
            body: "hi",
            buildkiteAgentBin: "/bin/false",
            context: buildkiteContext({ token: undefined }),
        });

        expect(result.posted).toBe(false);
        expect(result.error).toContain("BUILDKITE_API_TOKEN");
    });

    it("should pass build-id-scoped context so reruns update the same annotation", async () => {
        expect.assertions(1);

        const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

        await postPrComment({
            body: "hello",
            buildkiteAgentBin: "/bin/false",
            context: buildkiteContext(),
            fetchImpl,
        });

        const [, init] = fetchImpl.mock.calls[0]!;
        const body = JSON.parse((init as RequestInit).body as string) as { context: string };

        expect(body.context).toBe("vis-ai-heal-01HXYZ-build-id");
    });

    it("should always send Buildkite annotation style=info (heal posts only on success today)", async () => {
        expect.assertions(1);

        const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

        await postPrComment({
            body: "hello",
            buildkiteAgentBin: "/bin/false",
            context: buildkiteContext(),
            fetchImpl,
        });

        const [, init] = fetchImpl.mock.calls[0]!;
        const body = JSON.parse((init as RequestInit).body as string) as { style: string };

        expect(body.style).toBe("info");
    });

    it("should rebase the Buildkite REST URL onto BUILDKITE_API_BASE_URL for self-hosted Enterprise", async () => {
        expect.assertions(1);

        const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

        await postPrComment({
            body: "hi",
            buildkiteAgentBin: "/bin/false",
            context: buildkiteContext({ apiBaseUrl: "https://buildkite.acme.internal/api" }),
            fetchImpl,
        });

        const [url] = fetchImpl.mock.calls[0]!;

        expect(url).toBe("https://buildkite.acme.internal/api/v2/organizations/acme/pipelines/web/builds/123/annotations");
    });

    it("should skip when provider is unknown", async () => {
        expect.assertions(2);

        const result = await postPrComment({
            body: "hi",
            context: {
                apiBaseUrl: undefined,
                buildId: undefined,
                buildNumber: undefined,
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
