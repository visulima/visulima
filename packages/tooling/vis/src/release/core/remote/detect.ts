/**
 * Detect the active remote provider from CI env vars + git remote URL.
 *
 * Resolution order:
 *   1. Explicit `release.provider` config wins
 *   2. CI env signal: GITHUB_ACTIONS / GITLAB_CI
 *   3. git remote URL host (github.com / gitlab.*)
 *   4. Fallback: github (most common)
 *
 * Custom provider IDs (non-builtin) point at user-supplied modules
 * implementing the RemoteReleaseClient interface — loaded dynamically.
 */

import type { CommandRunner } from "../package-managers/interface";
import { GithubRemoteClient } from "./github";
import { GitlabRemoteClient } from "./gitlab";
import type { RemoteProvider, RemoteReleaseClient } from "./interface";

const detectFromEnv = (env: NodeJS.ProcessEnv): RemoteProvider | undefined => {
    if (env["GITHUB_ACTIONS"] === "true" || env["GITHUB_REPOSITORY"]) {
        return "github";
    }

    if (env["GITLAB_CI"] === "true" || env["CI_PROJECT_PATH"]) {
        return "gitlab";
    }

    return undefined;
};

/**
 * Extract the host from a git remote URL. Handles three common forms:
 *   - `https://github.com/foo/bar.git`
 *   - `git@github.com:foo/bar.git`         (SCP-like SSH)
 *   - `ssh://git@github.com:22/foo/bar.git`
 *
 * Returns the lowercase host without port. Returns `undefined` on parse
 * failure so the caller falls through to the next detection step.
 */
const extractRemoteHost = (raw: string): string | undefined => {
    const url = raw.trim();

    if (url === "") {
        return undefined;
    }

    // SCP-style: user@host:path — disambiguated from URL schemes by the
    // presence of `:` before any `/` and the absence of `://`.
    if (!url.includes("://")) {
        const colon = url.indexOf(":");
        const slash = url.indexOf("/");

        if (colon > 0 && (slash === -1 || colon < slash)) {
            const before = url.slice(0, colon);
            const at = before.lastIndexOf("@");
            const host = at === -1 ? before : before.slice(at + 1);

            return host.toLowerCase() || undefined;
        }

        return undefined;
    }

    try {
        return new URL(url).hostname.toLowerCase() || undefined;
    } catch {
        return undefined;
    }
};

const detectFromGitRemote = async (cwd: string, runner: CommandRunner): Promise<RemoteProvider | undefined> => {
    const result = await runner.run("git", ["config", "--get", "remote.origin.url"], { cwd, silent: true });

    if (result.exitCode !== 0) {
        return undefined;
    }

    const host = extractRemoteHost(result.stdout);

    if (!host) {
        return undefined;
    }

    if (host === "github.com" || host.endsWith(".github.com")) {
        return "github";
    }

    // Match `gitlab.com` and self-hosted instances (`gitlab.example.com`,
    // `gitlab.acme.io`) but NOT paths like `github.com/foo/gitlab-client`
    // — we're matching the URL host, not the full URL string.
    if (host === "gitlab.com" || host.startsWith("gitlab.")) {
        return "gitlab";
    }

    return undefined;
};

export const detectRemoteProvider = async (
    cwd: string,
    runner: CommandRunner,
    explicit: string | undefined,
    env: NodeJS.ProcessEnv = process.env,
): Promise<RemoteProvider> => {
    if (explicit && explicit !== "auto") {
        if (explicit === "github" || explicit === "gitlab") {
            return explicit;
        }

        throw new Error(`Unsupported release.provider: ${explicit}. Expected "github", "gitlab", or "auto".`);
    }

    return detectFromEnv(env) ?? (await detectFromGitRemote(cwd, runner)) ?? "github";
};

export interface CreateRemoteClientOptions {
    /**
     * Self-hosted GitHub Enterprise host. Maps to `GH_HOST` for the
     * GitHub adapter.
     */
    githubHost?: string;
    /** Self-hosted GitLab host. Maps to `GITLAB_HOST` for the GitLab adapter. */
    gitlabHost?: string;

    /**
     * HTTPS proxy URL. Threaded to both adapters as `HTTPS_PROXY` +
     * `HTTP_PROXY` env on every `gh` / `glab` subprocess.
     */
    httpProxy?: string;
}

export const createRemoteClient = (provider: RemoteProvider, options: CreateRemoteClientOptions = {}): RemoteReleaseClient => {
    if (provider === "gitlab") {
        return new GitlabRemoteClient({ host: options.gitlabHost, httpProxy: options.httpProxy });
    }

    return new GithubRemoteClient({ host: options.githubHost, httpProxy: options.httpProxy });
};
