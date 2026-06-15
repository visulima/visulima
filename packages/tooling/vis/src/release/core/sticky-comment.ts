/**
 * Provider-agnostic sticky-comment helpers.
 * @deprecated Use `RemoteReleaseClient` directly via
 * `createRemoteClient(provider)`. These functions are kept as a thin
 * adapter for callers that don't yet thread the client through.
 */

import type { CommandRunner } from "./package-managers/interface";
import { createRemoteClient, detectRemoteProvider } from "./remote/detect";
import type { UpsertStickyCommentOptions } from "./remote/interface";

export type { UpsertCommentResult, UpsertStickyCommentOptions } from "./remote/interface";

export interface StickyCommentOptions extends UpsertStickyCommentOptions {
    /** Self-hosted GitLab host. Forwarded to the GitLab adapter so on-prem instances work. */
    gitlabHost?: string;
    runner: CommandRunner;
}

/** Resolve the GitLab host: explicit option wins, then `GITLAB_HOST` env. */
const resolveGitlabHost = (explicit: string | undefined): string | undefined => explicit ?? process.env["GITLAB_HOST"];

export const upsertStickyComment = async (options: StickyCommentOptions): Promise<{ created: boolean; id: number } | undefined> => {
    const provider = await detectRemoteProvider(options.cwd, options.runner, undefined);
    const client = createRemoteClient(provider, { gitlabHost: resolveGitlabHost(options.gitlabHost) });
    const { runner, ...rest } = options;

    delete rest.gitlabHost;

    return client.upsertStickyComment(runner, rest);
};

export const detectRepoSlug = async (
    runner: CommandRunner,
    cwd: string,
    options: { gitlabHost?: string } = {},
): Promise<string | undefined> => {
    const provider = await detectRemoteProvider(cwd, runner, undefined);
    const client = createRemoteClient(provider, { gitlabHost: resolveGitlabHost(options.gitlabHost) });

    return client.detectRepoSlug(cwd, runner);
};

export const detectPullRequestNumber = (
    env: NodeJS.ProcessEnv,
    options: { gitlabHost?: string } = {},
): number | undefined => {
    const provider = detectFromEnvSync(env);
    const client = createRemoteClient(provider, { gitlabHost: resolveGitlabHost(options.gitlabHost) });

    return client.detectPullRequestNumber(env);
};

const detectFromEnvSync = (env: NodeJS.ProcessEnv): "github" | "gitlab" => {
    if (env["GITHUB_ACTIONS"] === "true" || env["GITHUB_REPOSITORY"] || env["GITHUB_REF"]) {
        return "github";
    }

    if (env["GITLAB_CI"] === "true" || env["CI_PROJECT_PATH"] || env["CI_MERGE_REQUEST_IID"]) {
        return "gitlab";
    }

    return "github"; // safe default
};
