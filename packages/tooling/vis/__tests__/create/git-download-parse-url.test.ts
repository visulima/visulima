import { describe, expect, it, vi } from "vitest";

// Mock spawnSync to avoid actual git ls-remote calls in getDefaultBranch
vi.mock("node:child_process", () => ({
    spawnSync: vi.fn(() => ({
        status: 0,
        stdout: "abc123\tHEAD\nabc123\trefs/heads/main\n",
        stderr: "",
    })),
}));

import { parseGitUrl } from "../../src/commands/create/git-download/parse-url";

describe("parseGitUrl", () => {
    // ── GitHub ────────────────────────────────────────────────────

    describe("GitHub", () => {
        it("should parse HTTPS URL", () => {
            expect.assertions(4);

            const config = parseGitUrl("https://github.com/user/repo");

            expect(config.host).toBe("github.com");
            expect(config.owner).toBe("user");
            expect(config.repository).toBe("repo");
            expect(config.type).toBe("repository");
        });

        it("should parse HTTPS URL with .git suffix", () => {
            expect.assertions(2);

            const config = parseGitUrl("https://github.com/user/repo.git");

            expect(config.repository).toBe("repo");
            expect(config.host).toBe("github.com");
        });

        it("should parse SSH URL", () => {
            expect.assertions(3);

            const config = parseGitUrl("git@github.com:user/repo");

            expect(config.host).toBe("github.com");
            expect(config.owner).toBe("user");
            expect(config.repository).toBe("repo");
        });

        it("should parse github: prefix shorthand", () => {
            expect.assertions(3);

            const config = parseGitUrl("github:user/repo");

            expect(config.host).toBe("github.com");
            expect(config.owner).toBe("user");
            expect(config.repository).toBe("repo");
        });

        it("should parse owner/repo shorthand as GitHub", () => {
            expect.assertions(3);

            const config = parseGitUrl("user/repo");

            expect(config.host).toBe("github.com");
            expect(config.owner).toBe("user");
            expect(config.repository).toBe("repo");
        });

        it("should parse /tree/branch/path URL (subdirectory)", () => {
            expect.assertions(4);

            const config = parseGitUrl("https://github.com/user/repo/tree/main/packages/cli");

            expect(config.type).toBe("tree");
            expect(config.branch).toBe("main");
            expect(config.path).toBe("packages/cli");
            expect(config.repository).toBe("repo");
        });

        it("should parse /blob/branch/path URL (single file)", () => {
            expect.assertions(3);

            const config = parseGitUrl("https://github.com/user/repo/blob/main/src/index.ts");

            expect(config.type).toBe("blob");
            expect(config.branch).toBe("main");
            expect(config.path).toBe("src/index.ts");
        });

        it("should parse /commit/hash URL", () => {
            expect.assertions(2);

            const config = parseGitUrl("https://github.com/user/repo/commit/abc123");

            expect(config.type).toBe("repository");
            expect(config.branch).toBe("abc123");
        });

        it("should use branch override when provided", () => {
            expect.assertions(1);

            const config = parseGitUrl("https://github.com/user/repo/tree/main/path", { branch: "dev" });

            expect(config.branch).toBe("dev");
        });

        it("should detect default branch for bare repo URLs", () => {
            expect.assertions(2);

            const config = parseGitUrl("https://github.com/user/repo");

            // Mocked spawnSync returns "main" as default branch
            expect(config.branch).toBe("main");
            expect(config.type).toBe("repository");
        });
    });

    // ── GitLab ────────────────────────────────────────────────────

    describe("GitLab", () => {
        it("should parse HTTPS URL", () => {
            expect.assertions(3);

            const config = parseGitUrl("https://gitlab.com/user/repo");

            expect(config.host).toBe("gitlab.com");
            expect(config.owner).toBe("user");
            expect(config.repository).toBe("repo");
        });

        it("should parse SSH URL", () => {
            expect.assertions(2);

            const config = parseGitUrl("git@gitlab.com:user/repo");

            expect(config.host).toBe("gitlab.com");
            expect(config.owner).toBe("user");
        });

        it("should parse gitlab: prefix shorthand", () => {
            expect.assertions(2);

            const config = parseGitUrl("gitlab:user/repo");

            expect(config.host).toBe("gitlab.com");
            expect(config.repository).toBe("repo");
        });

        it("should parse /-/tree/branch/path URL (subdirectory)", () => {
            expect.assertions(4);

            const config = parseGitUrl("https://gitlab.com/user/repo/-/tree/main/src/lib");

            expect(config.type).toBe("tree");
            expect(config.branch).toBe("main");
            expect(config.path).toBe("src/lib");
            expect(config.host).toBe("gitlab.com");
        });

        it("should parse /-/blob/branch/path URL (single file)", () => {
            expect.assertions(3);

            const config = parseGitUrl("https://gitlab.com/user/repo/-/blob/develop/README.md");

            expect(config.type).toBe("blob");
            expect(config.branch).toBe("develop");
            expect(config.path).toBe("README.md");
        });
    });

    // ── Bitbucket ─────────────────────────────────────────────────

    describe("Bitbucket", () => {
        it("should parse HTTPS URL", () => {
            expect.assertions(3);

            const config = parseGitUrl("https://bitbucket.org/user/repo");

            expect(config.host).toBe("bitbucket.org");
            expect(config.owner).toBe("user");
            expect(config.repository).toBe("repo");
        });

        it("should parse SSH URL", () => {
            expect.assertions(2);

            const config = parseGitUrl("git@bitbucket.org:user/repo");

            expect(config.host).toBe("bitbucket.org");
            expect(config.owner).toBe("user");
        });

        it("should parse bitbucket: prefix shorthand", () => {
            expect.assertions(2);

            const config = parseGitUrl("bitbucket:user/repo");

            expect(config.host).toBe("bitbucket.org");
            expect(config.repository).toBe("repo");
        });

        it("should parse /src/branch/path URL (subdirectory)", () => {
            expect.assertions(4);

            const config = parseGitUrl("https://bitbucket.org/user/repo/src/main/packages/core");

            expect(config.type).toBe("tree");
            expect(config.branch).toBe("main");
            expect(config.path).toBe("packages/core");
            expect(config.host).toBe("bitbucket.org");
        });
    });

    // ── Authentication ────────────────────────────────────────────

    describe("authentication", () => {
        it("should extract inline token from URL", () => {
            expect.assertions(3);

            const config = parseGitUrl("https://ghp_abc123@github.com/user/repo");

            expect(config.token).toBe("ghp_abc123");
            expect(config.host).toBe("github.com");
            expect(config.owner).toBe("user");
        });

        it("should read GITHUB_TOKEN from environment", () => {
            expect.assertions(1);

            process.env.GITHUB_TOKEN = "test-token-123";

            try {
                const config = parseGitUrl("https://github.com/user/repo");

                expect(config.token).toBe("test-token-123");
            } finally {
                delete process.env.GITHUB_TOKEN;
            }
        });

        it("should read GH_TOKEN as fallback", () => {
            expect.assertions(1);

            delete process.env.GITHUB_TOKEN;
            process.env.GH_TOKEN = "gh-token-456";

            try {
                const config = parseGitUrl("https://github.com/user/repo");

                expect(config.token).toBe("gh-token-456");
            } finally {
                delete process.env.GH_TOKEN;
            }
        });

        it("should read GITLAB_TOKEN for GitLab URLs", () => {
            expect.assertions(1);

            process.env.GITLAB_TOKEN = "gl-token-789";

            try {
                const config = parseGitUrl("https://gitlab.com/user/repo");

                expect(config.token).toBe("gl-token-789");
            } finally {
                delete process.env.GITLAB_TOKEN;
            }
        });

        it("should prefer inline token over environment", () => {
            expect.assertions(1);

            process.env.GITHUB_TOKEN = "env-token";

            try {
                const config = parseGitUrl("https://inline-token@github.com/user/repo");

                expect(config.token).toBe("inline-token");
            } finally {
                delete process.env.GITHUB_TOKEN;
            }
        });
    });

    // ── Edge cases ────────────────────────────────────────────────

    describe("edge cases", () => {
        it("should handle branch override for all URL types", () => {
            expect.assertions(1);

            const config = parseGitUrl("https://gitlab.com/user/repo/-/tree/main/path", { branch: "v2" });

            expect(config.branch).toBe("v2");
        });

        it("should return empty path for repository type", () => {
            expect.assertions(1);

            const config = parseGitUrl("https://github.com/user/repo");

            expect(config.path).toBe("");
        });

        it("should handle deeply nested subdirectory paths", () => {
            expect.assertions(1);

            const config = parseGitUrl("https://github.com/user/repo/tree/main/a/b/c/d/e");

            expect(config.path).toBe("a/b/c/d/e");
        });
    });
});
