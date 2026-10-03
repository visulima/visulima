import { describe, expect, it } from "vitest";

import { pushTags, resolvePushAuthEnv, verifyPushAccess } from "../../../src/release/core/git";
import type { CommandRunner } from "../../../src/release/core/package-managers/interface";

interface Call {
    args: ReadonlyArray<string>;
    env?: NodeJS.ProcessEnv;
}

type Result = { exitCode: number; stderr: string; stdout: string };

const ok = (stdout = ""): Result => {
    return { exitCode: 0, stderr: "", stdout };
};

/**
 * Runner that answers `git config --get-regexp` (configured extraheaders),
 * `git remote get-url` and `git push`, and records every call with its env.
 */
const createRunner = (
    options: { branch?: string; extraheader?: string; push?: (args: ReadonlyArray<string>) => Result; remoteUrl?: string } = {},
): { calls: Call[]; runner: CommandRunner } => {
    const calls: Call[] = [];

    const runner: CommandRunner = {
        run: async (_command, args, runOptions) => {
            calls.push({ args, env: runOptions.env });

            if (args[0] === "config") {
                return options.extraheader ? ok(options.extraheader) : { exitCode: 1, stderr: "", stdout: "" };
            }

            if (args[0] === "remote") {
                return options.remoteUrl === undefined ? { exitCode: 2, stderr: "error: No such remote 'origin'", stdout: "" } : ok(`${options.remoteUrl}\n`);
            }

            if (args[0] === "rev-parse") {
                return ok(`${options.branch ?? "main"}\n`);
            }

            if (args[0] === "push") {
                return options.push ? options.push(args) : ok();
            }

            return ok();
        },
    };

    return { calls, runner };
};

// An https remote URL carrying a username and password, built at runtime so
// secretlint doesn't flag a literal.
const urlWithCredentials = ((): string => {
    const url = new URL("https://github.com/acme/repo.git");

    url.username = "ci";
    url.password = "placeholder";

    return url.href;
})();

const basic = (credentials: string): string => `AUTHORIZATION: basic ${Buffer.from(credentials).toString("base64")}`;

describe("git: resolvePushAuthEnv", () => {
    it("injects the GitHub token as an env-only extraheader for an https remote", async () => {
        expect.hasAssertions();

        const { runner } = createRunner({ remoteUrl: "https://github.com/acme/repo.git" });

        const env = await resolvePushAuthEnv({ cwd: "/r", env: { GITHUB_TOKEN: "ghs_abc" }, runner });

        expect(env).toStrictEqual({
            GIT_CONFIG_COUNT: "1",
            GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
            GIT_CONFIG_VALUE_0: basic("x-access-token:ghs_abc"),
        });
    });

    it("prefers VIS_GH_TOKEN over GITHUB_TOKEN and GH_TOKEN", async () => {
        expect.hasAssertions();

        const { runner } = createRunner({ remoteUrl: "https://github.com/acme/repo.git" });

        const env = await resolvePushAuthEnv({ cwd: "/r", env: { GH_TOKEN: "gh", GITHUB_TOKEN: "github", VIS_GH_TOKEN: "vis" }, runner });

        expect(env?.["GIT_CONFIG_VALUE_0"]).toBe(basic("x-access-token:vis"));
    });

    it("uses oauth2 with GITLAB_TOKEN for GitLab hosts", async () => {
        expect.hasAssertions();

        const { runner } = createRunner({ remoteUrl: "https://gitlab.example.com/acme/repo.git" });

        const env = await resolvePushAuthEnv({ cwd: "/r", env: { GITHUB_TOKEN: "github", GITLAB_TOKEN: "glpat" }, runner });

        expect(env).toStrictEqual({
            GIT_CONFIG_COUNT: "1",
            GIT_CONFIG_KEY_0: "http.https://gitlab.example.com/.extraheader",
            GIT_CONFIG_VALUE_0: basic("oauth2:glpat"),
        });
    });

    it("appends after GIT_CONFIG_* entries the caller already set", async () => {
        expect.hasAssertions();

        const { runner } = createRunner({ remoteUrl: "https://github.com/acme/repo.git" });

        const env = await resolvePushAuthEnv({ cwd: "/r", env: { GIT_CONFIG_COUNT: "2", GITHUB_TOKEN: "t" }, runner });

        expect(env).toStrictEqual({
            GIT_CONFIG_COUNT: "3",
            GIT_CONFIG_KEY_2: "http.https://github.com/.extraheader",
            GIT_CONFIG_VALUE_2: basic("x-access-token:t"),
        });
    });

    it.each([
        ["an ssh remote", { remoteUrl: "git@github.com:acme/repo.git" }, { GITHUB_TOKEN: "t" }],
        ["a remote url with credentials", { remoteUrl: urlWithCredentials }, { GITHUB_TOKEN: "t" }],
        ["no token in the env", { remoteUrl: "https://github.com/acme/repo.git" }, {}],
        ["an empty token", { remoteUrl: "https://github.com/acme/repo.git" }, { GITHUB_TOKEN: "" }],
        ["a missing remote", {}, { GITHUB_TOKEN: "t" }],
        [
            "an already configured extraheader",
            { extraheader: "http.https://github.com/.extraheader AUTHORIZATION: basic xyz", remoteUrl: "https://github.com/acme/repo.git" },
            { GITHUB_TOKEN: "t" },
        ],
    ])("leaves git alone for %s", async (_label, runnerOptions, env) => {
        expect.hasAssertions();

        const { runner } = createRunner(runnerOptions);

        await expect(resolvePushAuthEnv({ cwd: "/r", env, runner })).resolves.toBeUndefined();
    });
});

describe("git: authenticated pushes", () => {
    it("pushTags passes the auth env to git push", async () => {
        expect.hasAssertions();

        const { calls, runner } = createRunner({ remoteUrl: "https://github.com/acme/repo.git" });

        await pushTags({ cwd: "/r", env: { GITHUB_TOKEN: "t" }, runner });

        const pushCall = calls.find((call) => call.args[0] === "push");

        expect(pushCall?.args).toStrictEqual(["push", "origin", "--tags"]);
        expect(pushCall?.env?.["GIT_CONFIG_VALUE_0"]).toBe(basic("x-access-token:t"));
    });
});

describe("git: verifyPushAccess", () => {
    it("dry-run pushes HEAD to the current branch with auth", async () => {
        expect.hasAssertions();

        const { calls, runner } = createRunner({ remoteUrl: "https://github.com/acme/repo.git" });

        await expect(verifyPushAccess({ cwd: "/r", env: { GITHUB_TOKEN: "t" }, runner })).resolves.toBeUndefined();

        const pushCall = calls.find((call) => call.args[0] === "push");

        expect(pushCall?.args).toStrictEqual(["push", "origin", "--dry-run", "HEAD:refs/heads/main"]);
        expect(pushCall?.env?.["GIT_CONFIG_KEY_0"]).toBe("http.https://github.com/.extraheader");
    });

    it("probes a placeholder branch on a detached HEAD", async () => {
        expect.hasAssertions();

        const { calls, runner } = createRunner({ branch: "HEAD", remoteUrl: "https://github.com/acme/repo.git" });

        await expect(verifyPushAccess({ cwd: "/r", env: {}, runner })).resolves.toBeUndefined();

        expect(calls.find((call) => call.args[0] === "push")?.args).toStrictEqual(["push", "origin", "--dry-run", "HEAD:refs/heads/vis-release-push-check"]);
    });

    it("treats a non-fast-forward rejection as access", async () => {
        expect.hasAssertions();

        const { runner } = createRunner({
            push: () => {
                return { exitCode: 1, stderr: " ! [rejected]        HEAD -> main (fetch first)", stdout: "" };
            },
            remoteUrl: "https://github.com/acme/repo.git",
        });

        await expect(verifyPushAccess({ cwd: "/r", env: {}, runner })).resolves.toBeUndefined();
    });

    it("returns git's error when authentication fails", async () => {
        expect.hasAssertions();

        const { runner } = createRunner({
            push: () => {
                return { exitCode: 128, stderr: "fatal: Authentication failed for 'https://github.com/acme/repo.git/'\n", stdout: "" };
            },
            remoteUrl: "https://github.com/acme/repo.git",
        });

        await expect(verifyPushAccess({ cwd: "/r", env: {}, runner })).resolves.toBe("fatal: Authentication failed for 'https://github.com/acme/repo.git/'");
    });
});
