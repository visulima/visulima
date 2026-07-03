import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { OrchestratorContext } from "../../../src/release/core/orchestrator";
import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import { buildTrustArgs, composePlaceholderManifest, parseRemoteUrl, runPretrust } from "../../../src/release/core/pretrust";

interface RunCall {
    args: string[];
    cmd: string;
}

const makeRunner = (
    options: {
        existing?: Set<string>;
        publishConflict?: Set<string>;
        publishFail?: Set<string>;
        remoteUrl?: string;
        trustFail?: Set<string>;
    } = {},
): { calls: RunCall[]; runner: CommandRunner } => {
    const calls: RunCall[] = [];
    const existing = options.existing ?? new Set<string>();
    const conflict = options.publishConflict ?? new Set<string>();
    const fail = options.publishFail ?? new Set<string>();
    const trustFail = options.trustFail ?? new Set<string>();

    const runner: CommandRunner = {
        run: async (cmd, args, opts) => {
            calls.push({ args: [...args], cmd });

            if (cmd === "git" && args[0] === "config") {
                return options.remoteUrl ? { exitCode: 0, stderr: "", stdout: `${options.remoteUrl}\n` } : { exitCode: 1, stderr: "", stdout: "" };
            }

            if (args[0] === "trust") {
                // `npm trust <provider> <packageName> …`
                const name = args[2] ?? "";

                return trustFail.has(name) ? { exitCode: 1, stderr: "npm ERR! OTP required", stdout: "" } : { exitCode: 0, stderr: "", stdout: "trusted" };
            }

            if (args[0] === "view") {
                const name = args[1] ?? "";

                return existing.has(name) ? { exitCode: 0, stderr: "", stdout: "1.2.3\n" } : { exitCode: 1, stderr: "E404", stdout: "" };
            }

            if (args[0] === "publish") {
                // The placeholder name lives in the temp package.json that
                // runPretrust just wrote into opts.cwd — read it back.
                const manifest = JSON.parse(readFileSync(join(opts.cwd, "package.json"), "utf8")) as { name: string };
                const { name } = manifest;

                if (conflict.has(name)) {
                    return { exitCode: 1, stderr: "npm ERR! EPUBLISHCONFLICT cannot publish over the previously published versions", stdout: "" };
                }

                if (fail.has(name)) {
                    return { exitCode: 1, stderr: "npm ERR! 403 Forbidden", stdout: "" };
                }

                return { exitCode: 0, stderr: "", stdout: "+ published" };
            }

            return { exitCode: 0, stderr: "", stdout: "" };
        },
    };

    return { calls, runner };
};

const mkPkg = (
    name: string,
    isPrivate = false,
): { dir: string; manifest: Record<string, unknown>; manifestPath: string; name: string; private: boolean; version: string } => {
    return {
        dir: `/repo/packages/${name}`,
        manifest: { license: "MIT", name, version: "0.0.0" },
        manifestPath: `/repo/packages/${name}/package.json`,
        name,
        private: isPrivate,
        version: "0.0.0",
    };
};

const mkCtx = (packages: ReturnType<typeof mkPkg>[]): OrchestratorContext => ({ cwd: "/repo", packages }) as unknown as OrchestratorContext;

describe("pretrust: composePlaceholderManifest", () => {
    it("produces a minimal, README-only manifest with publishConfig.access", () => {
        expect.hasAssertions();

        const manifest = composePlaceholderManifest(
            { manifest: { license: "Apache-2.0", name: "@scope/a", repository: "git+https://x/y.git", version: "1.0.0" } },
            "@scope/a",
            "0.0.0",
            "public",
        );

        expect(manifest).toMatchObject({
            files: ["README.md"],
            license: "Apache-2.0",
            name: "@scope/a",
            publishConfig: { access: "public" },
            repository: "git+https://x/y.git",
            version: "0.0.0",
        });
    });

    it("defaults license to MIT and omits repository when absent", () => {
        expect.hasAssertions();

        const manifest = composePlaceholderManifest({ manifest: { name: "a", version: "1.0.0" } }, "a", "0.0.0", "restricted");

        expect(manifest["license"]).toBe("MIT");
        expect(manifest).not.toHaveProperty("repository");
        expect(manifest["publishConfig"]).toStrictEqual({ access: "restricted" });
    });
});

describe("pretrust: runPretrust", () => {
    it("publishes placeholders for packages missing from the registry", async () => {
        expect.hasAssertions();

        const { calls, runner } = makeRunner();
        const result = await runPretrust({ context: mkCtx([mkPkg("@scope/a"), mkPkg("@scope/b")]), runner });

        expect(result.published.map((p) => p.name)).toStrictEqual(["@scope/a", "@scope/b"]);
        expect(result.published[0]?.accessUrl).toBe("https://www.npmjs.com/package/%40scope%2Fa/access");
        expect(calls.filter((c) => c.args[0] === "publish")).toHaveLength(2);
    });

    it("skips packages that already exist on the registry", async () => {
        expect.hasAssertions();

        const { calls, runner } = makeRunner({ existing: new Set(["@scope/a"]) });
        const result = await runPretrust({ context: mkCtx([mkPkg("@scope/a"), mkPkg("@scope/b")]), runner });

        expect(result.skipped).toStrictEqual([{ name: "@scope/a", reason: "already-on-registry" }]);
        expect(result.published.map((p) => p.name)).toStrictEqual(["@scope/b"]);
        // No publish attempt for the existing package.
        expect(calls.filter((c) => c.args[0] === "publish")).toHaveLength(1);
    });

    it("force-publishes even when the package exists", async () => {
        expect.hasAssertions();

        const { calls, runner } = makeRunner({ existing: new Set(["@scope/a"]) });
        const result = await runPretrust({ context: mkCtx([mkPkg("@scope/a")]), force: true, runner });

        expect(result.published.map((p) => p.name)).toStrictEqual(["@scope/a"]);
        expect(calls.some((c) => c.args[0] === "view")).toBe(false);
    });

    it("skips private packages", async () => {
        expect.hasAssertions();

        const { runner } = makeRunner();
        const result = await runPretrust({ context: mkCtx([mkPkg("@scope/a", true), mkPkg("@scope/b")]), runner });

        expect(result.published.map((p) => p.name)).toStrictEqual(["@scope/b"]);
    });

    it("honours a CSV glob filter", async () => {
        expect.hasAssertions();

        const { runner } = makeRunner();
        const result = await runPretrust({ context: mkCtx([mkPkg("@scope/a"), mkPkg("@other/b")]), filter: "@scope/*", runner });

        expect(result.published.map((p) => p.name)).toStrictEqual(["@scope/a"]);
    });

    it("does not publish on dry-run", async () => {
        expect.hasAssertions();

        const { calls, runner } = makeRunner();
        const result = await runPretrust({ context: mkCtx([mkPkg("@scope/a")]), dryRun: true, runner });

        expect(result.published.map((p) => p.name)).toStrictEqual(["@scope/a"]);
        expect(calls.some((c) => c.args[0] === "publish")).toBe(false);
    });

    it("treats EPUBLISHCONFLICT as an already-on-registry skip", async () => {
        expect.hasAssertions();

        const { runner } = makeRunner({ publishConflict: new Set(["@scope/a"]) });
        const result = await runPretrust({ context: mkCtx([mkPkg("@scope/a")]), force: true, runner });

        expect(result.skipped).toStrictEqual([{ name: "@scope/a", reason: "already-on-registry" }]);
        expect(result.published).toHaveLength(0);
    });

    it("records a real publish failure", async () => {
        expect.hasAssertions();

        const { runner } = makeRunner({ publishFail: new Set(["@scope/a"]) });
        const result = await runPretrust({ context: mkCtx([mkPkg("@scope/a")]), force: true, runner });

        expect(result.failed).toHaveLength(1);
        expect(result.failed[0]?.name).toBe("@scope/a");
    });
});

describe("pretrust: buildTrustArgs", () => {
    it("builds a github trust command with repo, env and stage permission", () => {
        expect.hasAssertions();

        const args = buildTrustArgs("@scope/a", {
            allowStagePublish: true,
            env: "release",
            provider: "github",
            repo: "owner/repo",
            workflow: "vis-release.yml",
        });

        expect(args).toStrictEqual([
            "trust",
            "github",
            "@scope/a",
            "--file",
            "vis-release.yml",
            "--repo",
            "owner/repo",
            "--env",
            "release",
            "--allow-publish",
            "--allow-stage-publish",
            "-y",
        ]);
    });

    it("uses --project for gitlab and omits optional flags", () => {
        expect.hasAssertions();

        const args = buildTrustArgs("pkg", { provider: "gitlab", repo: "group/project", workflow: ".gitlab-ci.yml" });

        expect(args).toStrictEqual(["trust", "gitlab", "pkg", "--file", ".gitlab-ci.yml", "--project", "group/project", "--allow-publish", "-y"]);
    });
});

describe("pretrust: parseRemoteUrl", () => {
    it("parses https + ssh github and gitlab remotes", () => {
        expect.hasAssertions();

        expect(parseRemoteUrl("https://github.com/owner/repo.git")).toStrictEqual({ provider: "github", repo: "owner/repo" });
        expect(parseRemoteUrl("git@github.com:owner/repo.git")).toStrictEqual({ provider: "github", repo: "owner/repo" });
        expect(parseRemoteUrl("https://gitlab.com/group/project")).toStrictEqual({ provider: "gitlab", repo: "group/project" });
        expect(parseRemoteUrl("https://example.com/x/y")).toBeUndefined();
    });

    it("handles ssh:// remotes with an explicit port", () => {
        expect.hasAssertions();

        expect(parseRemoteUrl("ssh://git@gitlab.example.com:2222/group/project.git")).toStrictEqual({ provider: "gitlab", repo: "group/project" });
        expect(parseRemoteUrl("ssh://git@github.com/owner/repo.git")).toStrictEqual({ provider: "github", repo: "owner/repo" });
    });
});

describe("pretrust: trust step", () => {
    it("runs npm trust after a successful publish (explicit claim)", async () => {
        expect.hasAssertions();

        const { calls, runner } = makeRunner();
        const result = await runPretrust({
            context: mkCtx([mkPkg("@scope/a")]),
            provider: "github",
            repo: "owner/repo",
            runner,
            workflow: "vis-release.yml",
        });

        expect(result.published[0]?.trusted).toBe(true);

        const trustCall = calls.find((c) => c.args[0] === "trust");

        expect(trustCall?.args).toStrictEqual(["trust", "github", "@scope/a", "--file", "vis-release.yml", "--repo", "owner/repo", "--allow-publish", "-y"]);
    });

    it("auto-detects provider + repo from the git remote", async () => {
        expect.hasAssertions();

        const { calls, runner } = makeRunner({ remoteUrl: "git@github.com:owner/repo.git" });
        const result = await runPretrust({ context: mkCtx([mkPkg("@scope/a")]), runner, workflow: "ci.yml" });

        expect(result.published[0]?.trusted).toBe(true);
        expect(calls.find((c) => c.args[0] === "trust")?.args).toContain("owner/repo");
    });

    it("does not run npm trust when trust is disabled", async () => {
        expect.hasAssertions();

        const { calls, runner } = makeRunner();
        const result = await runPretrust({ context: mkCtx([mkPkg("@scope/a")]), runner, trust: false });

        expect(result.published[0]?.trusted).toBeUndefined();
        expect(calls.some((c) => c.args[0] === "trust")).toBe(false);
    });

    it("records a trust failure (e.g. OTP required) without failing the publish", async () => {
        expect.hasAssertions();

        const { runner } = makeRunner({ trustFail: new Set(["@scope/a"]) });
        const result = await runPretrust({
            context: mkCtx([mkPkg("@scope/a")]),
            provider: "github",
            repo: "owner/repo",
            runner,
            workflow: "ci.yml",
        });

        expect(result.published).toHaveLength(1);
        expect(result.published[0]?.trusted).toBe(false);
        expect(result.published[0]?.trustReason).toContain("OTP");
    });

    it("skips trust with a reason when no remote and no provider are available", async () => {
        expect.hasAssertions();

        const { calls, runner } = makeRunner();
        const result = await runPretrust({ context: mkCtx([mkPkg("@scope/a")]), runner, workflow: "ci.yml" });

        expect(result.published[0]?.trusted).toBe(false);
        expect(result.published[0]?.trustReason).toContain("could not detect");
        expect(calls.some((c) => c.args[0] === "trust")).toBe(false);
    });
});
