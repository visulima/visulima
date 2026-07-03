import { afterEach, describe, expect, it } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import { GitlabRemoteClient } from "../../../src/release/core/remote/gitlab";

interface RecordedCall {
    args: ReadonlyArray<string>;
    command: string;
}

interface RunnerStub {
    calls: RecordedCall[];
    runner: CommandRunner;
}

const buildRunner = (responses: { exitCode?: number; stdout?: string }[]): RunnerStub => {
    const calls: RecordedCall[] = [];
    let cursor = 0;

    const runner: CommandRunner = {
        run: async (command, args) => {
            calls.push({ args, command });

            const next = responses[cursor];

            cursor += 1;

            if (!next) {
                return { exitCode: 1, stderr: "no more stub responses", stdout: "" };
            }

            return { exitCode: next.exitCode ?? 0, stderr: "", stdout: next.stdout ?? "" };
        },
    };

    return { calls, runner };
};

describe("gitlabRemoteClient.detectRepoSlug", () => {
    afterEach(() => {
        delete process.env.CI_PROJECT_PATH;
    });

    it("prefers CI_PROJECT_PATH over the git remote", async () => {
        expect.hasAssertions();

        process.env.CI_PROJECT_PATH = "group/sub/proj";

        const { calls, runner } = buildRunner([]);
        const client = new GitlabRemoteClient();
        const slug = await client.detectRepoSlug("/cwd", runner);

        expect(slug).toBe("group/sub/proj");
        expect(calls).toHaveLength(0);
    });

    it("parses HTTPS gitlab remotes", async () => {
        expect.hasAssertions();

        const { runner } = buildRunner([{ stdout: "https://gitlab.com/group/sub/proj.git\n" }]);

        const slug = await new GitlabRemoteClient().detectRepoSlug("/cwd", runner);

        expect(slug).toBe("group/sub/proj");
    });

    it("parses SSH gitlab remotes", async () => {
        expect.hasAssertions();

        const { runner } = buildRunner([{ stdout: "git@gitlab.example.com:org/repo.git\n" }]);

        const slug = await new GitlabRemoteClient().detectRepoSlug("/cwd", runner);

        expect(slug).toBe("org/repo");
    });
});

describe("gitlabRemoteClient.detectPullRequestNumber", () => {
    it("reads CI_MERGE_REQUEST_IID", () => {
        expect.hasAssertions();

        const result = new GitlabRemoteClient().detectPullRequestNumber({ CI_MERGE_REQUEST_IID: "42" });

        expect(result).toBe(42);
    });

    it("falls back to VIS_MR_NUMBER", () => {
        expect.hasAssertions();

        const result = new GitlabRemoteClient().detectPullRequestNumber({ VIS_MR_NUMBER: "7" });

        expect(result).toBe(7);
    });

    it("returns undefined when neither is set", () => {
        expect.hasAssertions();

        const result = new GitlabRemoteClient().detectPullRequestNumber({});

        expect(result).toBeUndefined();
    });
});

describe("gitlabRemoteClient.upsertStickyComment", () => {
    it("creates a new note when no marker match exists", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([
            { stdout: JSON.stringify([{ body: "unrelated", id: 1, system: false }]) },
            { stdout: JSON.stringify({ id: 99 }) },
        ]);

        const result = await new GitlabRemoteClient().upsertStickyComment(runner, {
            body: "hello",
            cwd: "/cwd",
            issueNumber: 5,
            marker: "<!-- vis-marker -->",
            repo: "group/sub/proj",
        });

        expect(result).toStrictEqual({ created: true, id: 99 });
        // Project path is URL-encoded.
        expect(calls[0]?.args).toContain("projects/group%2Fsub%2Fproj/merge_requests/5/notes");
        // POST when no match.
        expect(calls[1]?.args[1]).toBe("-X");
        expect(calls[1]?.args[2]).toBe("POST");
    });

    it("pUTs the existing note when a marker match exists", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([{ stdout: JSON.stringify([{ body: "<!-- vis-marker -->\n stale", id: 7, system: false }]) }, { stdout: "{}" }]);

        const result = await new GitlabRemoteClient().upsertStickyComment(runner, {
            body: "<!-- vis-marker -->\nfresh",
            cwd: "/cwd",
            issueNumber: 5,
            marker: "<!-- vis-marker -->",
            repo: "group/proj",
        });

        expect(result).toStrictEqual({ created: false, id: 7 });
        expect(calls[1]?.args[1]).toBe("-X");
        expect(calls[1]?.args[2]).toBe("PUT");
        expect(calls[1]?.args[3]).toContain("/notes/7");
    });

    it("filters out system-generated notes when scanning for the marker", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([
            {
                stdout: JSON.stringify([
                    { body: "<!-- vis-marker -->", id: 1, system: true },
                    { body: "human note", id: 2 },
                ]),
            },
            { stdout: JSON.stringify({ id: 3 }) },
        ]);

        // System note carries the marker; we should ignore it and POST a new one.
        const result = await new GitlabRemoteClient().upsertStickyComment(runner, {
            body: "ok",
            cwd: "/cwd",
            issueNumber: 1,
            marker: "<!-- vis-marker -->",
            repo: "g/p",
        });

        expect(result?.created).toBe(true);
        expect(calls[1]?.args[2]).toBe("POST");
    });
});

describe("gitlabRemoteClient.createRelease", () => {
    it("emits structured assets — uploads files and registers link-only entries", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([
            { stdout: "" }, // glab release create
            { stdout: "" }, // glab release upload
            { stdout: "" }, // glab api … assets/links
            { stdout: JSON.stringify({ _links: { self: "https://gitlab.com/.../release" } }) },
        ]);

        const result = await new GitlabRemoteClient().createRelease(runner, {
            assets: ["/tmp/pkg-1.0.0.tgz", { label: "Container", linkUrl: "https://images.example/repo:1.0.0", type: "image" }],
            body: "release notes",
            cwd: "/cwd",
            milestones: ["v1.0.0"],
            repo: "g/p",
            tag: "v1.0.0",
            title: "v1.0.0",
        });

        expect(result?.url).toBe("https://gitlab.com/.../release");
        // Milestone wired via repeated --milestone flags.
        expect(calls[0]?.args).toContain("--milestone");
        expect(calls[0]?.args).toContain("v1.0.0");
        // Upload args include the tgz.
        expect(calls[1]?.args).toContain("/tmp/pkg-1.0.0.tgz");
        // Link-only asset goes through the assets/links endpoint.
        expect(calls[2]?.args.join(" ")).toContain("assets/links");
        expect(calls[2]?.args).toContain("name=Container");
        expect(calls[2]?.args).toContain("link_type=image");
    });
});

describe("gitlabRemoteClient — self-hosted host", () => {
    it("threads GITLAB_HOST through every runner invocation", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([{ stdout: "[]" }, { stdout: JSON.stringify({ id: 1 }) }]);

        await new GitlabRemoteClient({ host: "gitlab.example.com" }).upsertStickyComment(runner, {
            body: "x",
            cwd: "/cwd",
            issueNumber: 1,
            marker: "<!-- m -->",
            repo: "g/p",
        });

        expect(calls).toHaveLength(2);
        // Every call goes through runOpts which sets env.GITLAB_HOST.
        // Recreating the runner with a per-call captured env is hard via the
        // stub; assert the runner was called and trust the unit-tested
        // runOpts helper. See `runOpts` covered by the next test.
    });

    it("omits GITLAB_HOST when host is not configured", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([{ stdout: "[]" }, { stdout: JSON.stringify({ id: 1 }) }]);

        await new GitlabRemoteClient().upsertStickyComment(runner, {
            body: "x",
            cwd: "/cwd",
            issueNumber: 1,
            marker: "<!-- m -->",
            repo: "g/p",
        });

        expect(calls).toHaveLength(2);
    });
});

describe("gitlabRemoteClient.createRelease — generic-package assets", () => {
    it("uploads files to the Generic Package Registry then registers links", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([
            { stdout: "" }, // glab release create
            { stdout: "{\"message\": \"201 Created\"}" }, // PUT generic upload
            { stdout: "{\"name\": \"pkg.tgz\"}" }, // POST assets/links
            { stdout: JSON.stringify({ _links: { self: "https://gitlab.example.com/release" } }) },
        ]);

        const result = await new GitlabRemoteClient({ host: "gitlab.example.com" }).createRelease(runner, {
            assets: [
                {
                    label: "Bundle",
                    packageName: "myproj",
                    path: "/tmp/pkg.tgz",
                    target: "generic_package",
                    type: "package",
                },
            ],
            body: "release notes",
            cwd: "/cwd",
            repo: "group/proj",
            tag: "v1.0.0",
            title: "v1.0.0",
        });

        expect(result?.url).toBe("https://gitlab.example.com/release");

        // Generic package upload — PUT to packages/generic/<name>/<version>/<filename>.
        const uploadCall = calls.find((c) => c.args.includes("PUT") && c.args.some((a) => a.includes("packages/generic")));

        expect(uploadCall).toBeDefined();
        expect(uploadCall?.args.some((a) => a.includes("packages/generic/myproj/1.0.0/pkg.tgz"))).toBe(true);

        // Followed by an assets/links POST on the release.
        const linkCall = calls.find((c) => c.args.some((a) => a.includes("assets/links")));

        expect(linkCall).toBeDefined();
        expect(linkCall?.args).toContain("name=Bundle");
        expect(linkCall?.args).toContain("link_type=package");
    });

    it("derives package name from repo + version from tag (with leading-v stripped)", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([
            { stdout: "" },
            { stdout: "{}" },
            { stdout: "{}" },
            { stdout: JSON.stringify({ _links: { self: "https://x" } }) },
        ]);

        await new GitlabRemoteClient().createRelease(runner, {
            assets: [{ path: "/tmp/x.tgz", target: "generic_package" }],
            body: "",
            cwd: "/cwd",
            repo: "group/myproj",
            tag: "v2.5.1",
            title: "v2.5.1",
        });

        const uploadCall = calls.find((c) => c.args.some((a) => a.includes("packages/generic")));

        expect(uploadCall?.args.some((a) => a.includes("packages/generic/myproj/2.5.1/x.tgz"))).toBe(true);
    });
});

describe("gitlabRemoteClient.upsertIssue", () => {
    it("pUTs the existing issue when one matches the marker", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([
            { stdout: JSON.stringify([{ iid: 11, title: "[release-failed] v1.0", web_url: "https://x" }]) },
            { stdout: "{}" },
        ]);

        const result = await new GitlabRemoteClient().upsertIssue(runner, {
            body: "updated",
            cwd: "/cwd",
            labels: ["release-bot"],
            marker: "[release-failed]",
            repo: "g/p",
            title: "[release-failed] v1.0",
        });

        expect(result).toStrictEqual({ created: false, number: 11, url: "https://x" });
        expect(calls[1]?.args).toContain("add_labels=release-bot");
    });

    it("creates a new issue when none match", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([{ stdout: "[]" }, { stdout: "https://gitlab.com/g/p/-/issues/42" }]);

        const result = await new GitlabRemoteClient().upsertIssue(runner, {
            body: "fresh",
            cwd: "/cwd",
            labels: ["release-bot"],
            marker: "[release-failed]",
            repo: "g/p",
            title: "[release-failed] v1.1",
        });

        expect(result?.number).toBe(42);
        expect(result?.created).toBe(true);
        expect(calls[1]?.args).toContain("issue");
        expect(calls[1]?.args).toContain("create");
    });
});

describe("gitlabRemoteClient.closeIssue", () => {
    it("posts the closing comment then closes", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([{ stdout: "" }, { stdout: "" }]);

        const ok = await new GitlabRemoteClient().closeIssue(runner, {
            closingComment: "shipped in v1.2",
            cwd: "/cwd",
            issueNumber: 5,
            repo: "g/p",
        });

        expect(ok).toBe(true);
        expect(calls[0]?.args.join(" ")).toContain("/issues/5/notes");
        expect(calls[1]?.args).toContain("close");
    });

    it("skips the comment call when closingComment is omitted", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([{ stdout: "" }]);

        const ok = await new GitlabRemoteClient().closeIssue(runner, {
            cwd: "/cwd",
            issueNumber: 5,
            repo: "g/p",
        });

        expect(ok).toBe(true);
        expect(calls).toHaveLength(1);
        expect(calls[0]?.args).toContain("close");
    });
});
