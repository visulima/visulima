import { describe, expect, it, vi } from "vitest";

import type { CiContext } from "../src/ai/ci-context";
import {
    apiBaseToHostForTesting,
    commitFiles,
    splitGithubRepoForTesting,
} from "../src/ai/git-commit";

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

describe(splitGithubRepoForTesting, () => {
    it("should split owner/repo on the first slash", () => {
        expect.assertions(1);
        expect(splitGithubRepoForTesting("owner/repo")).toEqual({ owner: "owner", repo: "repo" });
    });

    it("should support repos containing dots and dashes", () => {
        expect.assertions(1);
        expect(splitGithubRepoForTesting("acme-corp/some.repo")).toEqual({ owner: "acme-corp", repo: "some.repo" });
    });

    it("should reject malformed values that lack a slash", () => {
        expect.assertions(1);
        expect(() => splitGithubRepoForTesting("nope")).toThrow(/owner\/repo/);
    });

    it("should reject values with an empty owner or repo segment", () => {
        expect.assertions(2);
        expect(() => splitGithubRepoForTesting("/repo")).toThrow(/owner\/repo/);
        expect(() => splitGithubRepoForTesting("owner/")).toThrow(/owner\/repo/);
    });
});

describe(apiBaseToHostForTesting, () => {
    it("should strip the /api/v4 suffix", () => {
        expect.assertions(1);
        expect(apiBaseToHostForTesting("https://gitlab.example.com/api/v4")).toBe("https://gitlab.example.com");
    });

    it("should strip a trailing slash on the api path", () => {
        expect.assertions(1);
        expect(apiBaseToHostForTesting("https://gitlab.example.com/api/v4/")).toBe("https://gitlab.example.com");
    });

    it("should leave hosts without an /api/vN suffix untouched", () => {
        expect.assertions(1);
        expect(apiBaseToHostForTesting("https://gitlab.example.com")).toBe("https://gitlab.example.com");
    });
});

describe(commitFiles, () => {
    it("should reject empty file lists before contacting the SDK", async () => {
        expect.assertions(1);

        await expect(
            commitFiles({
                branch: "main",
                ciContext: githubContext(),
                files: [],
                message: "noop",
                workspaceRoot: "/ws",
            }),
        ).rejects.toThrow(/no files/i);
    });

    it("should reject unknown CI providers", async () => {
        expect.assertions(1);

        await expect(
            commitFiles({
                branch: "main",
                ciContext: { apiBaseUrl: undefined, prNumber: undefined, provider: "unknown", repo: undefined, sha: undefined, token: undefined },
                files: ["a.ts"],
                message: "noop",
                workspaceRoot: "/ws",
            }),
        ).rejects.toThrow(/unsupported CI provider/);
    });

    it("should reject GitHub commits when the token is missing", async () => {
        expect.assertions(1);

        await expect(
            commitFiles({
                branch: "main",
                ciContext: githubContext({ token: undefined }),
                files: ["a.ts"],
                message: "noop",
                workspaceRoot: "/ws",
            }),
        ).rejects.toThrow(/GITHUB_TOKEN/);
    });

    it("should drive the GitHub Git Trees API end-to-end", async () => {
        expect.assertions(6);

        const calls: string[] = [];
        const fakeOctokit = {
            rest: {
                git: {
                    createBlob: vi.fn(async (parameters: { content: string; encoding: string }) => {
                        calls.push(`blob:${parameters.encoding}`);
                        // Decoding to verify base64 round-trips the file content.
                        const decoded = Buffer.from(parameters.content, "base64").toString("utf8");

                        expect(decoded).toBe("file body\n");

                        return { data: { sha: "blob-sha" } };
                    }),
                    createCommit: vi.fn(async (parameters: { parents: string[]; tree: string }) => {
                        calls.push("commit");
                        expect(parameters).toMatchObject({ parents: ["parent-sha"], tree: "tree-sha" });

                        return { data: { html_url: "https://github.com/owner/repo/commit/new-sha", sha: "new-sha" } };
                    }),
                    createTree: vi.fn(async (parameters: { base_tree?: string; tree: Array<{ mode: string; path: string; sha: string; type: string }> }) => {
                        calls.push("tree");
                        expect(parameters.base_tree).toBe("base-tree-sha");
                        expect(parameters.tree).toEqual([{ mode: "100644", path: "src/a.ts", sha: "blob-sha", type: "blob" }]);

                        return { data: { sha: "tree-sha" } };
                    }),
                    getCommit: vi.fn(async () => {
                        calls.push("getCommit");

                        return { data: { tree: { sha: "base-tree-sha" } } };
                    }),
                    getRef: vi.fn(async () => {
                        calls.push("getRef");

                        return { data: { object: { sha: "parent-sha" } } };
                    }),
                    updateRef: vi.fn(async () => {
                        calls.push("updateRef");

                        return { data: { object: { sha: "new-sha" } } };
                    }),
                },
            },
        };

        const result = await commitFiles({
            branch: "feature/x",
            ciContext: githubContext(),
            files: ["src/a.ts"],
            githubClient: fakeOctokit,
            message: "fix: heal accept",
            readFile: async () => "file body\n",
            workspaceRoot: "/ws",
        });

        // Calls happen in the canonical Git-Trees-API order.
        expect(calls).toEqual(["getRef", "getCommit", "blob:base64", "tree", "commit", "updateRef"]);
        expect(result).toEqual({ sha: "new-sha", url: "https://github.com/owner/repo/commit/new-sha" });
    });

    it("should commit to GitLab via Commits.create with update actions", async () => {
        expect.assertions(4);

        const create = vi.fn(async (
            projectId: number | string,
            branch: string,
            _message: string,
            actions: Array<{ action: string; content?: string; filePath: string }>,
        ) => {
            expect(projectId).toBe("group/proj");
            expect(branch).toBe("topic/x");
            expect(actions).toEqual([{ action: "update", content: "file body\n", filePath: "src/a.ts" }]);

            return { id: "gitlab-sha", web_url: "https://gitlab.example.com/group/proj/-/commit/gitlab-sha" };
        });

        const result = await commitFiles({
            branch: "topic/x",
            ciContext: gitlabContext(),
            files: ["src/a.ts"],
            gitlabClient: { Commits: { create } },
            message: "fix: heal accept",
            readFile: async () => "file body\n",
            workspaceRoot: "/ws",
        });

        expect(result).toEqual({ sha: "gitlab-sha", url: "https://gitlab.example.com/group/proj/-/commit/gitlab-sha" });
    });

    it("should reject GitLab commits when CI_API_V4_URL is missing", async () => {
        expect.assertions(1);

        await expect(
            commitFiles({
                branch: "topic/x",
                ciContext: gitlabContext({ apiBaseUrl: undefined }),
                files: ["src/a.ts"],
                gitlabClient: { Commits: { create: vi.fn() } },
                message: "noop",
                readFile: async () => "x",
                workspaceRoot: "/ws",
            }),
        ).rejects.toThrow(/CI_API_V4_URL/);
    });

    it("should reject GitLab commits when no token is configured", async () => {
        expect.assertions(1);

        await expect(
            commitFiles({
                branch: "topic/x",
                ciContext: gitlabContext({ token: undefined }),
                files: ["src/a.ts"],
                gitlabClient: { Commits: { create: vi.fn() } },
                message: "noop",
                readFile: async () => "x",
                workspaceRoot: "/ws",
            }),
        ).rejects.toThrow(/GITLAB_TOKEN/);
    });

    it("should fall back to webUrl (camelCase) when GitLab returns it", async () => {
        expect.assertions(1);

        const create = vi.fn(async () => ({ id: "abc", webUrl: "https://gitlab.example.com/x" }));

        const result = await commitFiles({
            branch: "topic/x",
            ciContext: gitlabContext(),
            files: ["src/a.ts"],
            gitlabClient: { Commits: { create } },
            message: "msg",
            readFile: async () => "x",
            workspaceRoot: "/ws",
        });

        expect(result.url).toBe("https://gitlab.example.com/x");
    });
});
