import { readFile as fsReadFile } from "node:fs/promises";

import { resolve } from "@visulima/path";

import type { CiContext } from "./ci-context";
import type { OptionalSdk } from "./sdk-loader";
import { loadOptionalSdk } from "./sdk-loader";

/**
 * Commit a set of patched files back to the PR/MR branch through the
 * provider's REST SDK. Two backends are supported:
 *
 * - **GitHub** (`@octokit/rest`): blob → tree → commit → updateRef. A
 *   commit created via the REST API with `GITHUB_TOKEN` is automatically
 *   signed as `github-actions[bot]`, so we don't have to ship GPG plumbing.
 * - **GitLab** (`@gitbeaker/rest`): a single bulk-commit call to
 *   `Commits.create`. v1 is unsigned — GitLab supports signing only when
 *   a runner-level GPG key is configured, which is project-specific
 *   infrastructure we don't reach into.
 *
 * The SDKs are *optional peer deps*: most `vis` consumers never run
 * `vis ai heal accept`, and shipping ~400 KB of Octokit/Gitbeaker on
 * every install would be wasteful. They're loaded lazily via
 * {@link loadOptionalSdk}, which prompts to install on first need in an
 * interactive shell or fails loud with the install command in CI.
 */

export interface CommitFilesOptions {
    /** Branch / source-ref to update — head of the PR or MR. */
    branch: string;
    ciContext: CiContext;
    /** Workspace-relative file paths to include in the commit. */
    files: string[];
    /**
     * Test override: pre-built GitLab client (Gitbeaker `Gitlab` instance).
     * When set, skips the SDK load + auth steps.
     */
    gitlabClient?: GitlabRestClient;
    /**
     * Test override: pre-built GitHub client (Octokit instance).
     * When set, skips the SDK load + auth steps.
     */
    githubClient?: GithubRestClient;
    /** Test override for the SDK loader. */
    loadSdk?: <T>(sdk: OptionalSdk) => Promise<{ default?: T; [key: string]: unknown }>;
    message: string;
    /** Test override for filesystem reads. */
    readFile?: (absolutePath: string) => Promise<string>;
    workspaceRoot: string;
}

export interface CommitFilesResult {
    /** Commit SHA — `id` for GitLab, `sha` for GitHub. */
    sha: string;
    /** Browser URL for the commit, when the SDK provides one. */
    url?: string;
}

// Minimal structural typings for the slices of each SDK we touch — keeps
// `vis` typecheckable when neither SDK is installed (peer-dep optional).
interface GithubRestClient {
    rest: {
        git: {
            createBlob: (parameters: { content: string; encoding: string; owner: string; repo: string }) => Promise<{ data: { sha: string } }>;
            createCommit: (parameters: {
                message: string;
                owner: string;
                parents: string[];
                repo: string;
                tree: string;
            }) => Promise<{ data: { html_url?: string; sha: string } }>;
            createTree: (parameters: {
                base_tree?: string;
                owner: string;
                repo: string;
                tree: Array<{ mode: string; path: string; sha: string; type: string }>;
            }) => Promise<{ data: { sha: string } }>;
            getCommit: (parameters: { commit_sha: string; owner: string; repo: string }) => Promise<{ data: { tree: { sha: string } } }>;
            getRef: (parameters: { owner: string; ref: string; repo: string }) => Promise<{ data: { object: { sha: string } } }>;
            updateRef: (parameters: {
                force?: boolean;
                owner: string;
                ref: string;
                repo: string;
                sha: string;
            }) => Promise<{ data: { object: { sha: string } } }>;
        };
    };
}

type GitlabAction = {
    action: "create" | "delete" | "move" | "update";
    content?: string;
    filePath: string;
    previousPath?: string;
};

interface GitlabRestClient {
    Commits: {
        create: (
            projectId: number | string,
            branch: string,
            message: string,
            actions: GitlabAction[],
        ) => Promise<{ id?: string; sha?: string; short_id?: string; web_url?: string; webUrl?: string }>;
    };
}

const splitGithubRepo = (repo: string): { owner: string; repo: string } => {
    const slash = repo.indexOf("/");

    if (slash <= 0 || slash === repo.length - 1) {
        throw new Error(`Expected GITHUB_REPOSITORY in "owner/repo" form, got: ${repo}`);
    }

    return { owner: repo.slice(0, slash), repo: repo.slice(slash + 1) };
};

const loadGithubClient = async (token: string, options: CommitFilesOptions): Promise<GithubRestClient> => {
    if (options.githubClient) {
        return options.githubClient;
    }

    const loader = options.loadSdk ?? loadOptionalSdk;
    const module_ = await loader<unknown>("@octokit/rest");
    const OctokitCtor = (module_ as { Octokit?: new (config: { auth: string }) => GithubRestClient }).Octokit;

    if (!OctokitCtor) {
        throw new TypeError("Loaded `@octokit/rest` but no `Octokit` export was found. Reinstall the package or pin to a supported major.");
    }

    return new OctokitCtor({ auth: token });
};

const loadGitlabClient = async (token: string, host: string, options: CommitFilesOptions): Promise<GitlabRestClient> => {
    if (options.gitlabClient) {
        return options.gitlabClient;
    }

    const loader = options.loadSdk ?? loadOptionalSdk;
    const module_ = await loader<unknown>("@gitbeaker/rest");
    const GitlabCtor = (module_ as { Gitlab?: new (config: { host: string; token: string }) => GitlabRestClient }).Gitlab;

    if (!GitlabCtor) {
        throw new TypeError("Loaded `@gitbeaker/rest` but no `Gitlab` export was found. Reinstall the package or pin to a supported major.");
    }

    return new GitlabCtor({ host, token });
};

const apiBaseToHost = (apiBaseUrl: string): string => {
    // Gitbeaker wants the bare host (`https://gitlab.example.com`), not
    // the API path (`https://gitlab.example.com/api/v4`). Strip the
    // `/api/vN` suffix if present.
    return apiBaseUrl.replace(/\/api\/v\d+\/?$/, "");
};

const commitToGithub = async (options: CommitFilesOptions): Promise<CommitFilesResult> => {
    const { branch, ciContext, files, message, workspaceRoot } = options;
    const readFile = options.readFile ?? ((absolute: string) => fsReadFile(absolute, "utf8"));

    if (!ciContext.repo) {
        throw new Error("Cannot commit on GitHub: GITHUB_REPOSITORY (owner/repo) is not set.");
    }

    if (!ciContext.token) {
        throw new Error("Cannot commit on GitHub: GITHUB_TOKEN is not set. Grant the workflow `contents: write` and pass the token through.");
    }

    const { owner, repo } = splitGithubRepo(ciContext.repo);
    const client = await loadGithubClient(ciContext.token, options);

    // Read current branch tip + its tree so the new commit base-trees
    // off it (we're appending changes, not replacing the worktree).
    const refResponse = await client.rest.git.getRef({ owner, ref: `heads/${branch}`, repo });
    const parentSha = refResponse.data.object.sha;
    const commitResponse = await client.rest.git.getCommit({ commit_sha: parentSha, owner, repo });
    const baseTreeSha = commitResponse.data.tree.sha;

    // Create one blob per file in parallel. base64 encoding is safer than
    // utf-8 here — files may contain bytes that the JSON serializer
    // mangles, and base64 round-trips losslessly.
    const blobs = await Promise.all(
        files.map(async (file) => {
            const absolute = resolve(workspaceRoot, file);
            const contents = await readFile(absolute);
            const blob = await client.rest.git.createBlob({
                content: Buffer.from(contents, "utf8").toString("base64"),
                encoding: "base64",
                owner,
                repo,
            });

            return { mode: "100644", path: file, sha: blob.data.sha, type: "blob" };
        }),
    );

    const tree = await client.rest.git.createTree({ base_tree: baseTreeSha, owner, repo, tree: blobs });
    const newCommit = await client.rest.git.createCommit({ message, owner, parents: [parentSha], repo, tree: tree.data.sha });

    await client.rest.git.updateRef({ owner, ref: `heads/${branch}`, repo, sha: newCommit.data.sha });

    return { sha: newCommit.data.sha, url: newCommit.data.html_url };
};

const commitToGitlab = async (options: CommitFilesOptions): Promise<CommitFilesResult> => {
    const { branch, ciContext, files, message, workspaceRoot } = options;
    const readFile = options.readFile ?? ((absolute: string) => fsReadFile(absolute, "utf8"));

    if (!ciContext.repo) {
        throw new Error("Cannot commit on GitLab: CI_PROJECT_ID / CI_PROJECT_PATH is not set.");
    }

    if (!ciContext.token) {
        throw new Error("Cannot commit on GitLab: no token. CI_JOB_TOKEN cannot push commits — set GITLAB_TOKEN to a PAT/project-token with `api` scope.");
    }

    if (!ciContext.apiBaseUrl) {
        throw new Error("Cannot commit on GitLab: CI_API_V4_URL is not set.");
    }

    const host = apiBaseToHost(ciContext.apiBaseUrl);
    const client = await loadGitlabClient(ciContext.token, host, options);

    const actions: GitlabAction[] = await Promise.all(
        files.map(async (file): Promise<GitlabAction> => {
            const absolute = resolve(workspaceRoot, file);
            const contents = await readFile(absolute);

            return { action: "update", content: contents, filePath: file };
        }),
    );

    const result = await client.Commits.create(ciContext.repo, branch, message, actions);
    const sha = result.id ?? result.sha;

    if (!sha) {
        throw new Error("GitLab Commits.create returned no commit ID — cannot reference the new commit.");
    }

    return { sha, url: result.web_url ?? result.webUrl };
};

/**
 * Commit `files` to the head of `branch` on the host indicated by
 * `ciContext`. Returns `{ sha, url? }` for the new commit.
 *
 * Throws on missing context (no repo / no token), unsupported provider
 * (`unknown` provider — likely running outside CI), or SDK errors.
 * Caller is responsible for wrapping the error with user-facing context.
 */
export const commitFiles = async (options: CommitFilesOptions): Promise<CommitFilesResult> => {
    if (options.files.length === 0) {
        throw new Error("Cannot commit: no files to include.");
    }

    if (options.ciContext.provider === "github-actions") {
        return await commitToGithub(options);
    }

    if (options.ciContext.provider === "gitlab-ci") {
        return await commitToGitlab(options);
    }

    throw new Error(`Cannot commit: unsupported CI provider \`${options.ciContext.provider}\`. Run \`vis ai heal accept\` from a recognised CI environment.`);
};

export { apiBaseToHost as apiBaseToHostForTesting, splitGithubRepo as splitGithubRepoForTesting };
