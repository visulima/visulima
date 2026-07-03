import { spawnSync } from "node:child_process";

import { isAccessibleSync, readFileSync } from "@visulima/fs";

const ZERO_SHA = "0000000000000000000000000000000000000000";

export type CiProvider = "buildkite" | "circleci" | "github" | "gitlab" | "local";

export interface ResolvedShas {
    base: string;
    head: string;
    notes: string[];
    provider: CiProvider;
}

export type GitRunner = (args: string[], cwd: string) => string | undefined;
export type EventPayloadReader = (path: string) => Record<string, unknown> | undefined;

export interface ResolveAffectedShasOptions {
    /**
     * Default base branch (without an `origin/` prefix). Falls back to `main`.
     * Callers should pass `visConfig.defaultBase` here.
     */
    defaultBase?: string;

    /**
     * Environment to inspect. Defaults to `process.env`. Injectable for tests.
     */
    env?: NodeJS.ProcessEnv;

    /**
     * Read and parse a JSON file (e.g. `$GITHUB_EVENT_PATH`). Returns
     * `undefined` on any error. Injectable for tests.
     */
    readEventPayload?: EventPayloadReader;

    /**
     * Run a git command and return the trimmed stdout. Returns `undefined`
     * on non-zero exit. Injectable for tests.
     */
    runGit?: GitRunner;

    /**
     * Workspace root used as the cwd for git invocations. Defaults to
     * `process.cwd()`.
     */
    workspaceRoot?: string;
}

const defaultReadEventPayload: EventPayloadReader = (path) => {
    if (!isAccessibleSync(path)) {
        return undefined;
    }

    try {
        const raw = readFileSync(path);

        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return undefined;
    }
};

const defaultRunGit: GitRunner = (args, cwd) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });

    if (result.error || typeof result.status !== "number" || result.status !== 0) {
        return undefined;
    }

    return typeof result.stdout === "string" ? result.stdout.trim() : undefined;
};

const isNonEmptySha = (value: string | undefined): value is string => typeof value === "string" && value.length > 0 && value !== ZERO_SHA;

const resolveGithub = (env: NodeJS.ProcessEnv, defaultBase: string, readEventPayload: EventPayloadReader): ResolvedShas => {
    const notes: string[] = [];

    const baseRef = env["GITHUB_BASE_REF"];
    const headSha = env["GITHUB_SHA"] ?? "HEAD";

    if (baseRef && baseRef.length > 0) {
        notes.push(`pull_request: $GITHUB_BASE_REF=${baseRef}`);

        return { base: `origin/${baseRef}`, head: headSha, notes, provider: "github" };
    }

    const eventPath = env["GITHUB_EVENT_PATH"];
    const payload = eventPath ? readEventPayload(eventPath) : undefined;

    if (payload) {
        const before = typeof payload["before"] === "string" ? payload["before"] : undefined;

        if (isNonEmptySha(before)) {
            notes.push(`push: event.before=${before}`);

            return { base: before, head: headSha, notes, provider: "github" };
        }
    }

    notes.push(`fallback: origin/${defaultBase}`);

    return { base: `origin/${defaultBase}`, head: headSha, notes, provider: "github" };
};

const resolveGitlab = (env: NodeJS.ProcessEnv, defaultBase: string): ResolvedShas => {
    const notes: string[] = [];
    const headSha = env["CI_COMMIT_SHA"] ?? "HEAD";

    const source = env["CI_PIPELINE_SOURCE"];

    if (source === "merge_request_event") {
        const mrBase = env["CI_MERGE_REQUEST_DIFF_BASE_SHA"];

        if (isNonEmptySha(mrBase)) {
            notes.push(`merge_request: $CI_MERGE_REQUEST_DIFF_BASE_SHA=${mrBase}`);

            return { base: mrBase, head: headSha, notes, provider: "gitlab" };
        }

        const targetBranch = env["CI_MERGE_REQUEST_TARGET_BRANCH_NAME"];

        if (targetBranch && targetBranch.length > 0) {
            notes.push(`merge_request: $CI_MERGE_REQUEST_TARGET_BRANCH_NAME=${targetBranch}`);

            return { base: `origin/${targetBranch}`, head: headSha, notes, provider: "gitlab" };
        }
    }

    const before = env["CI_COMMIT_BEFORE_SHA"];

    if (isNonEmptySha(before)) {
        notes.push(`push: $CI_COMMIT_BEFORE_SHA=${before}`);

        return { base: before, head: headSha, notes, provider: "gitlab" };
    }

    const defaultBranch = env["CI_DEFAULT_BRANCH"] ?? defaultBase;

    notes.push(`fallback: origin/${defaultBranch}`);

    return { base: `origin/${defaultBranch}`, head: headSha, notes, provider: "gitlab" };
};

const resolveBuildkite = (env: NodeJS.ProcessEnv, defaultBase: string): ResolvedShas => {
    const notes: string[] = [];
    const headSha = env["BUILDKITE_COMMIT"] ?? "HEAD";

    const prBase = env["BUILDKITE_PULL_REQUEST_BASE_BRANCH"];

    if (prBase && prBase.length > 0) {
        notes.push(`pull_request: $BUILDKITE_PULL_REQUEST_BASE_BRANCH=${prBase}`);

        return { base: `origin/${prBase}`, head: headSha, notes, provider: "buildkite" };
    }

    notes.push(`fallback: origin/${defaultBase} (buildkite has no canonical previous-build SHA env)`);

    return { base: `origin/${defaultBase}`, head: headSha, notes, provider: "buildkite" };
};

const resolveCircleCI = (env: NodeJS.ProcessEnv, defaultBase: string): ResolvedShas => {
    const notes: string[] = [];
    const headSha = env["CIRCLE_SHA1"] ?? "HEAD";

    const prBase = env["CIRCLE_PR_BASE_BRANCH"];

    if (prBase && prBase.length > 0) {
        notes.push(`pull_request: $CIRCLE_PR_BASE_BRANCH=${prBase}`);

        return { base: `origin/${prBase}`, head: headSha, notes, provider: "circleci" };
    }

    notes.push(`fallback: origin/${defaultBase} (circleci has no canonical previous-build SHA env)`);

    return { base: `origin/${defaultBase}`, head: headSha, notes, provider: "circleci" };
};

const resolveLocal = (defaultBase: string, runGit: GitRunner, workspaceRoot: string): ResolvedShas => {
    const notes: string[] = [];
    const mergeBase = runGit(["merge-base", "HEAD", `origin/${defaultBase}`], workspaceRoot);

    if (mergeBase && mergeBase.length > 0) {
        notes.push(`local: git merge-base HEAD origin/${defaultBase}=${mergeBase}`);

        return { base: mergeBase, head: "HEAD", notes, provider: "local" };
    }

    notes.push(`local fallback: origin/${defaultBase} (no merge-base available)`);

    return { base: `origin/${defaultBase}`, head: "HEAD", notes, provider: "local" };
};

/**
 * Resolve the `{base, head}` SHAs to feed `vis affected` / `vis ci` /
 * `vis run --affected` based on the active CI provider (or local fallback).
 *
 * Provider precedence: GitHub → GitLab → Buildkite → CircleCI → local. The
 * dispatcher checks each provider's "are we in this CI?" env var (e.g.
 * `$GITHUB_ACTIONS=true`) and delegates. Each resolver records a short
 * provenance line in `notes` so callers can log how the base was picked.
 *
 * All env / git / fs touchpoints are injectable for tests.
 */
export const resolveAffectedShas = (options?: ResolveAffectedShasOptions): ResolvedShas => {
    const env = options?.env ?? process.env;
    const defaultBase = options?.defaultBase ?? "main";
    const readEventPayload = options?.readEventPayload ?? defaultReadEventPayload;
    const runGit = options?.runGit ?? defaultRunGit;
    const workspaceRoot = options?.workspaceRoot ?? process.cwd();

    if (env["GITHUB_ACTIONS"] === "true") {
        return resolveGithub(env, defaultBase, readEventPayload);
    }

    if (env["GITLAB_CI"] === "true") {
        return resolveGitlab(env, defaultBase);
    }

    if (env["BUILDKITE"] === "true") {
        return resolveBuildkite(env, defaultBase);
    }

    if (env["CIRCLECI"] === "true") {
        return resolveCircleCI(env, defaultBase);
    }

    return resolveLocal(defaultBase, runGit, workspaceRoot);
};
