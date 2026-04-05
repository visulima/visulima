/**
 * Git URL parser — extracts repository metadata from various URL formats.
 *
 * Supports GitHub, GitLab, and Bitbucket URLs in all common formats:
 * - Full HTTPS URLs: https://github.com/owner/repo
 * - SSH-style: git@github.com:owner/repo
 * - Platform prefix: github:owner/repo, gitlab:owner/repo, bitbucket:owner/repo
 * - Shorthand: owner/repo (defaults to GitHub)
 * - With branch/tag/commit: owner/repo#ref or -b ref
 * - With subdirectory: owner/repo/tree/main/path/to/dir
 * - With auth token: https://token@github.com/owner/repo
 * - Individual files: owner/repo/blob/main/path/to/file
 *
 * Ported from gitpick (MIT) — adapted for vis.
 */

import { spawnSync } from "node:child_process";

// ── Types ─────────────────────────────────────────────────────────

export type GitHost = "bitbucket.org" | "github.com" | "gitlab.com";

export type GitResourceType = "blob" | "repository" | "tree";

export interface GitRepoConfig {
    /** Branch, tag, or commit hash. */
    branch: string;

    /** The git host. */
    host: GitHost;

    /** Repository owner / org. */
    owner: string;

    /** Subdirectory path within the repo (empty = whole repo). */
    path: string;

    /** Repository name. */
    repository: string;

    /** Auth token (from URL or environment). */
    token: string;

    /** What we're cloning: full repo, a subdirectory tree, or a single file. */
    type: GitResourceType;
}

// ── Host detection ────────────────────────────────────────────────

interface HostPrefix {
    host: GitHost;
    prefix: string;
}

const HOST_PREFIXES: HostPrefix[] = [
    { host: "github.com", prefix: "git@github.com:" },
    { host: "github.com", prefix: "https://github.com/" },
    { host: "github.com", prefix: "https://raw.githubusercontent.com/" },
    { host: "github.com", prefix: "github:" },
    { host: "gitlab.com", prefix: "git@gitlab.com:" },
    { host: "gitlab.com", prefix: "https://gitlab.com/" },
    { host: "gitlab.com", prefix: "gitlab:" },
    { host: "bitbucket.org", prefix: "git@bitbucket.org:" },
    { host: "bitbucket.org", prefix: "https://bitbucket.org/" },
    { host: "bitbucket.org", prefix: "bitbucket:" },
];

// ── Token resolution ──────────────────────────────────────────────

const HOST_ENV_TOKENS: Record<GitHost, string[]> = {
    "bitbucket.org": ["BITBUCKET_TOKEN"],
    "github.com": ["GITHUB_TOKEN", "GH_TOKEN"],
    "gitlab.com": ["GITLAB_TOKEN"],
};

const getEnvToken = (host: GitHost): string => {
    const envNames = HOST_ENV_TOKENS[host];

    for (const name of envNames) {
        const value = process.env[name];

        if (value) {
            return value;
        }
    }

    return "";
};

// ── Default branch detection ──────────────────────────────────────

/**
 * Detect the default branch of a remote repository using `git ls-remote`.
 * Returns "main" as a fallback if detection fails.
 */
export const getDefaultBranch = (repoUrl: string): string => {
    const result = spawnSync("git", ["ls-remote", repoUrl], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 15_000,
    });

    if (result.status !== 0 || !result.stdout) {
        return "main";
    }

    const lines = result.stdout;
    const headHash = /^([a-f\d]+)\s+HEAD$/m.exec(lines)?.[1];

    if (!headHash) {
        return "main";
    }

    const branchMatch = new RegExp(`${headHash}\\s+refs/heads/(.+)`).exec(lines);

    return branchMatch?.[1] ?? "main";
};

// ── URL parsing ───────────────────────────────────────────────────

/**
 * Parse a git URL (any supported format) into a {@link GitRepoConfig}.
 *
 * If `branch` is provided it overrides whatever is in the URL.
 */
export const parseGitUrl = (
    url: string,
    options: { branch?: string } = {},
): GitRepoConfig => {
    let input = url;

    // 1. Extract inline token: https://TOKEN@github.com/...
    const tokenRegex = /^https:\/\/([^@]+)@(github\.com|gitlab\.com|bitbucket\.org)/;
    const tokenMatch = tokenRegex.exec(input);
    let token = "";

    if (tokenMatch) {
        token = tokenMatch[1] as string;
        input = input.replace(`${token}@`, "");
    }

    // 2. Detect host and strip prefix
    let host: GitHost = "github.com";

    for (const { host: h, prefix } of HOST_PREFIXES) {
        if (input.startsWith(prefix)) {
            host = h;
            input = input.slice(prefix.length);
            break;
        }
    }

    // 3. Resolve token from environment if not inline
    if (!token) {
        token = getEnvToken(host);
    }

    // 4. Split remaining path segments
    const parts = input.split("/");
    const owner = parts[0] as string;
    const rawRepo = parts[1] ?? "";
    const repository = rawRepo.endsWith(".git") ? rawRepo.slice(0, -4) : rawRepo;

    // 5. Build authenticated repo URL for git operations
    const repoUrl = `https://${token ? token + "@" : ""}${host}/${owner}/${repository}`;

    // 6. Determine type, branch, and path based on host-specific URL patterns
    let type: GitResourceType;
    let resolvedBranch: string;
    let resolvedPath: string;

    if (host === "github.com") {
        ({ type, resolvedBranch, resolvedPath } = parseGitHubPath(parts, options.branch, repoUrl));
    } else if (host === "gitlab.com") {
        ({ type, resolvedBranch, resolvedPath } = parseGitLabPath(parts, options.branch, repoUrl));
    } else {
        ({ type, resolvedBranch, resolvedPath } = parseBitbucketPath(parts, options.branch, repoUrl));
    }

    return {
        branch: resolvedBranch,
        host,
        owner,
        path: resolvedPath,
        repository,
        token,
        type,
    };
};

// ── Host-specific path parsers ────────────────────────────────────

const parseGitHubPath = (
    parts: string[],
    branchOverride: string | undefined,
    repoUrl: string,
): { resolvedBranch: string; resolvedPath: string; type: GitResourceType } => {
    if (parts[2] === "blob") {
        return {
            resolvedBranch: branchOverride ?? parts[3] ?? "main",
            resolvedPath: parts.slice(4).join("/"),
            type: "blob",
        };
    }

    if (parts[2] === "tree") {
        return {
            resolvedBranch: branchOverride ?? parts[3] ?? "main",
            resolvedPath: parts.slice(4).join("/"),
            type: "tree",
        };
    }

    if (parts[2] === "commit") {
        return {
            resolvedBranch: branchOverride ?? parts[3] ?? "main",
            resolvedPath: "",
            type: "repository",
        };
    }

    return {
        resolvedBranch: branchOverride ?? getDefaultBranch(repoUrl),
        resolvedPath: "",
        type: "repository",
    };
};

const parseGitLabPath = (
    parts: string[],
    branchOverride: string | undefined,
    repoUrl: string,
): { resolvedBranch: string; resolvedPath: string; type: GitResourceType } => {
    // GitLab uses /-/blob/ and /-/tree/ patterns
    if (parts[2] === "-" && parts[3] === "blob") {
        return {
            resolvedBranch: branchOverride ?? parts[4] ?? "main",
            resolvedPath: parts.slice(5).join("/"),
            type: "blob",
        };
    }

    if (parts[2] === "-" && parts[3] === "tree") {
        return {
            resolvedBranch: branchOverride ?? parts[4] ?? "main",
            resolvedPath: parts.slice(5).join("/"),
            type: "tree",
        };
    }

    return {
        resolvedBranch: branchOverride ?? getDefaultBranch(repoUrl),
        resolvedPath: "",
        type: "repository",
    };
};

const parseBitbucketPath = (
    parts: string[],
    branchOverride: string | undefined,
    repoUrl: string,
): { resolvedBranch: string; resolvedPath: string; type: GitResourceType } => {
    // Bitbucket uses /src/branch/path
    if (parts[2] === "src") {
        return {
            resolvedBranch: branchOverride ?? parts[3] ?? "main",
            resolvedPath: parts.slice(4).join("/"),
            type: "tree",
        };
    }

    return {
        resolvedBranch: branchOverride ?? getDefaultBranch(repoUrl),
        resolvedPath: "",
        type: "repository",
    };
};
