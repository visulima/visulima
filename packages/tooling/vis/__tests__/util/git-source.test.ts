import { afterEach, describe, expect, it, vi } from "vitest";

const downloadTemplate = vi.hoisted(() => vi.fn());

vi.mock(import("giget"), () => { return { downloadTemplate }; });

const { downloadGitSource, resolveGitSource } = await import("../../src/util/git-source");

describe(resolveGitSource, () => {
    it.each([
        ["https://github.com/user/repo", "github:user/repo"],
        ["https://github.com/user/repo.git#dev", "github:user/repo#dev"],
        ["https://github.com/user/repo/tree/main/packages/tpl", "github:user/repo/packages/tpl#main"],
        ["github.com/user/repo", "github:user/repo"],
        ["user/repo/tree/main/packages/tpl", "github:user/repo/packages/tpl#main"],
        ["git@github.com:user/repo.git", "github:user/repo"],
        ["https://gitlab.com/group/subgroup/repo", "gitlab:group/subgroup/repo"],
        ["https://gitlab.com/group/repo/-/tree/main/sub", "gitlab:group/repo/sub#main"],
        ["gitlab.com/group/repo", "gitlab:group/repo"],
        ["git@gitlab.com:group/repo", "gitlab:group/repo"],
        ["https://bitbucket.org/team/repo", "bitbucket:team/repo"],
        ["https://git.sr.ht/~user/repo", "sourcehut:user/repo"],
        ["sourcehut:~user/repo", "sourcehut:user/repo"],
        ["git.sr.ht/~user/repo", "sourcehut:user/repo"],
    ])("rewrites %s to %s", (input, expected) => {
        expect.assertions(1);

        expect(resolveGitSource(input).source).toBe(expected);
    });

    it.each([
        "user/repo",
        "user/repo#dev",
        "github:user/repo/sub#main",
        "gitlab:gitlab-org/project-templates/express",
        "sourcehut:user/repo",
        "git:git@github.com:user/repo",
        "https://example.com/templates/starter.tar.gz",
        "https://github.com/user/repo/archive/main.tgz",
    ])("passes %s through unchanged", (input) => {
        expect.assertions(1);

        expect(resolveGitSource(input)).toStrictEqual({ source: input });
    });

    it("clones unknown scp-style hosts over ssh", () => {
        expect.assertions(1);

        expect(resolveGitSource("git@git.example.com:group/repo").source).toBe("git:git@git.example.com:group/repo");
    });

    it("extracts the base URL of a self-hosted GitLab", () => {
        expect.assertions(1);

        expect(resolveGitSource("gitlab://git.example.com/group/sub/repo.git#v1")).toStrictEqual({
            gitlabUrl: "https://git.example.com",
            source: "gitlab:group/sub/repo#v1",
        });
    });

    it("lifts a token out of the URL instead of leaving it in the source", () => {
        expect.assertions(2);

        const resolved = resolveGitSource("https://ghp_secret@github.com/org/private");

        expect(resolved.source).toBe("github:org/private");
        expect(resolved.auth).toBe("ghp_secret");
    });
});

describe(downloadGitSource, () => {
    const saved = { ...process.env };

    afterEach(() => {
        process.env = { ...saved };
        downloadTemplate.mockReset();
    });

    const authSentFor = async (input: string, options: Record<string, unknown> = {}): Promise<string | undefined> => {
        downloadTemplate.mockReset();
        downloadTemplate.mockResolvedValue({ dir: "out" });
        await downloadGitSource(input, { dir: "out", ...options });

        return (downloadTemplate.mock.calls[0] as [string, { auth?: string }])[1].auth;
    };

    it("sends only the token that belongs to the host", async () => {
        expect.assertions(3);

        process.env.GITHUB_TOKEN = "gh-token";
        process.env.GITLAB_TOKEN = "gl-token";

        await expect(authSentFor("gitlab:group/repo")).resolves.toBe("gl-token");

        await expect(authSentFor("user/repo")).resolves.toBe("gh-token");

        await expect(authSentFor("https://example.com/starter.tar.gz")).resolves.toBeUndefined();
    });

    it("prefers explicit auth over a URL token over the environment", async () => {
        expect.assertions(2);

        process.env.GITHUB_TOKEN = "env";

        await expect(authSentFor("https://url-token@github.com/o/r", { auth: "explicit" })).resolves.toBe("explicit");

        await expect(authSentFor("https://url-token@github.com/o/r")).resolves.toBe("url-token");
    });

    it("scopes the self-hosted GitLab URL to a single download", async () => {
        expect.assertions(2);

        delete process.env.GIGET_GITLAB_URL;

        let seen: string | undefined;

        downloadTemplate.mockImplementation(() => {
            seen = process.env.GIGET_GITLAB_URL;

            return { dir: "out" };
        });

        await downloadGitSource("gitlab://git.example.com/group/repo", { dir: "out" });

        expect(seen).toBe("https://git.example.com");
        expect(process.env.GIGET_GITLAB_URL).toBeUndefined();
    });
});
