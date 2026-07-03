/**
 * GitHub `RemoteReleaseClient` — implements all forge ops via the `gh`
 * CLI. Falls back to printing-only when `gh` isn't available.
 */

import type { CommandRunner } from "../package-managers/interface";
import type {
    AddLabelsOptions,
    CloseIssueOptions,
    CreateReleaseOptions,
    CreateReleaseResult,
    ListRecentReleasesOptions,
    RecentRelease,
    RemoteReleaseClient,
    UpsertCommentResult,
    UpsertIssueOptions,
    UpsertIssueResult,
    UpsertPullRequestOptions,
    UpsertPullRequestResult,
    UpsertStickyCommentOptions,
} from "./interface";

const normalizeAssets = (assets: CreateReleaseOptions["assets"]): { linkAppendix: string; paths: string[] } => {
    const paths: string[] = [];
    const links: string[] = [];

    for (const entry of assets ?? []) {
        if (typeof entry === "string") {
            paths.push(entry);

            continue;
        }

        if (entry.path) {
            // GitHub's gh release create accepts `<path>#display-name` for an
            // asset rename. Prefer label > name > basename.
            const display = entry.label ?? entry.name;

            paths.push(display ? `${entry.path}#${display}` : entry.path);
        } else if (entry.linkUrl) {
            // GitHub Releases don't have a "link only" asset concept — append
            // such entries to the body so they're at least visible.
            const label = entry.label ?? entry.name ?? entry.linkUrl;

            links.push(`- [${label}](${entry.linkUrl})`);
        }
    }

    const linkAppendix = links.length > 0 ? `\n\n### Additional links\n\n${links.join("\n")}` : "";

    return { linkAppendix, paths };
};

interface ExistingComment {
    body: string;
    id: number;
}

/**
 * Parse `gh api repos/.../issues/&lt;n>/comments` stdout into a typed list.
 * Returns `[]` on non-zero exit or parse failure.
 */
const parseListedComments = (exitCode: number, stdout: string): ExistingComment[] => {
    if (exitCode !== 0) {
        return [];
    }

    try {
        const parsed = JSON.parse(stdout) as { body?: string; id: number }[];

        return parsed
            .filter((c) => typeof c.body === "string")
            .map((c) => {
                return { body: c.body ?? "", id: c.id };
            });
    } catch {
        return [];
    }
};

export interface GithubClientOptions {
    /**
     * Self-hosted GitHub Enterprise host, e.g. `"github.acme.com"` (no
     * scheme). Maps to the `GH_HOST` env var that `gh` consumes
     * natively. Optional.
     */
    host?: string;

    /**
     * HTTPS proxy URL passed through to `gh` subprocesses via
     * `HTTPS_PROXY` + `HTTP_PROXY` env vars. Optional.
     */
    httpProxy?: string;
}

export class GithubRemoteClient implements RemoteReleaseClient {
    // fallow-ignore-next-line unused-class-member -- RemoteReleaseClient contract member (accessed polymorphically via the remote interface)
    public readonly id = "github" as const;

    private readonly host: string | undefined;

    private readonly httpProxy: string | undefined;

    public constructor(options: GithubClientOptions = {}) {
        this.host = options.host;
        this.httpProxy = options.httpProxy;
    }

    /**
     * Build a runner-options object that injects `GH_HOST` /
     * `HTTPS_PROXY` / `HTTP_PROXY` when configured. Every `gh` CLI call
     * funnels through this helper so we don't risk a stray invocation
     * landing on `github.com` or bypassing the proxy.
     */
    private runOpts(cwd: string): { cwd: string; env?: NodeJS.ProcessEnv; silent: true } {
        if (!this.host && !this.httpProxy) {
            return { cwd, silent: true };
        }

        const env: NodeJS.ProcessEnv = { ...process.env };

        if (this.host) {
            env["GH_HOST"] = this.host;
        }

        if (this.httpProxy) {
            env["HTTPS_PROXY"] = this.httpProxy;
            env["HTTP_PROXY"] = this.httpProxy;
        }

        return { cwd, env, silent: true };
    }

    /**
     * Enumerate recent releases via `gh release list`. Over-fetches by
     * 4x when a `tagPrefix` filter is supplied so that single-package
     * release blocks survive interleaved tag publication from other
     * packages in the same monorepo. The `--exclude-pre-releases` flag
     * is NOT set — operators may explicitly want to link to a previous
     * prerelease for an `addReleases: "top"` on a beta channel.
     */
    public async listRecentReleases(runner: CommandRunner, options: ListRecentReleasesOptions): Promise<RecentRelease[]> {
        const limit = Math.max(1, options.limit);
        // Over-fetch when filtering to absorb tag interleaving with
        // sibling packages in the same monorepo. Soft-cap at 100 so we
        // don't pull half the release history on a busy repo.
        const fetchSize = options.tagPrefix ? Math.min(100, limit * 4) : limit;
        const result = await runner.run(
            "gh",
            ["release", "list", "--repo", options.repo, "--limit", String(fetchSize), "--json", "tagName,url,name"],
            this.runOpts(options.cwd),
        );

        if (result.exitCode !== 0) {
            return [];
        }

        let parsed: { name?: string; tagName?: string; url?: string }[];

        try {
            parsed = JSON.parse(result.stdout) as { name?: string; tagName?: string; url?: string }[];
        } catch {
            return [];
        }

        const filtered: RecentRelease[] = [];

        for (const entry of parsed) {
            if (typeof entry.tagName !== "string" || typeof entry.url !== "string") {
                continue;
            }

            if (options.tagPrefix && !entry.tagName.startsWith(options.tagPrefix)) {
                continue;
            }

            if (options.excludeTag && entry.tagName === options.excludeTag) {
                continue;
            }

            filtered.push({
                name: entry.name ?? entry.tagName,
                tag: entry.tagName,
                url: entry.url,
            });

            if (filtered.length >= limit) {
                break;
            }
        }

        return filtered;
    }

    // fallow-ignore-next-line unused-class-member -- RemoteReleaseClient contract member (accessed polymorphically via the remote interface)
    public async detectRepoSlug(cwd: string, runner: CommandRunner): Promise<string | undefined> {
        const result = await runner.run("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], this.runOpts(cwd));

        if (result.exitCode !== 0) {
            return undefined;
        }

        return result.stdout.trim() || undefined;
    }

    // fallow-ignore-next-line unused-class-member -- RemoteReleaseClient contract member (accessed polymorphically via the remote interface)
    public detectPullRequestNumber(env: NodeJS.ProcessEnv): number | undefined {
        // Pull-request event: refs/pull/<n>/{merge,head}
        const ref = env["GITHUB_REF"];

        if (ref) {
            const match = /^refs\/pull\/(\d+)\/(?:merge|head)$/.exec(ref);

            if (match?.[1]) {
                return Number.parseInt(match[1], 10);
            }
        }

        const direct = env["PR_NUMBER"] ?? env["VIS_PR_NUMBER"];

        if (direct) {
            const n = Number.parseInt(direct, 10);

            return Number.isNaN(n) ? undefined : n;
        }

        return undefined;
    }

    // fallow-ignore-next-line unused-class-member -- RemoteReleaseClient contract member (accessed polymorphically via the remote interface)
    public async upsertStickyComment(runner: CommandRunner, options: UpsertStickyCommentOptions): Promise<UpsertCommentResult | undefined> {
        const listResult = await runner.run(
            "gh",
            ["api", `repos/${options.repo}/issues/${options.issueNumber}/comments`, "--paginate"],
            this.runOpts(options.cwd),
        );
        const comments = parseListedComments(listResult.exitCode, listResult.stdout);
        const existing = comments.find((c) => c.body.includes(options.marker));
        const fullBody = options.body.includes(options.marker) ? options.body : `${options.marker}\n${options.body}`;

        if (existing) {
            const result = await runner.run(
                "gh",
                ["api", "-X", "PATCH", `repos/${options.repo}/issues/comments/${existing.id}`, "-f", `body=${fullBody}`],
                this.runOpts(options.cwd),
            );

            return result.exitCode === 0 ? { created: false, id: existing.id } : undefined;
        }

        const result = await runner.run(
            "gh",
            ["api", "-X", "POST", `repos/${options.repo}/issues/${options.issueNumber}/comments`, "-f", `body=${fullBody}`],
            this.runOpts(options.cwd),
        );

        if (result.exitCode !== 0) {
            return undefined;
        }

        try {
            const parsed = JSON.parse(result.stdout) as { id: number };

            return { created: true, id: parsed.id };
        } catch {
            return undefined;
        }
    }

    public async createRelease(runner: CommandRunner, options: CreateReleaseOptions): Promise<CreateReleaseResult | undefined> {
        const { linkAppendix, paths } = normalizeAssets(options.assets);
        const body = linkAppendix ? `${options.body}${linkAppendix}` : options.body;
        const args = ["release", "create", options.tag, "--repo", options.repo, "--title", options.title, "--notes", body];

        if (options.draft) {
            args.push("--draft");
        }

        if (options.prerelease) {
            args.push("--prerelease");
        }

        if (options.discussionCategory) {
            args.push("--discussion-category", options.discussionCategory);
        }

        // gh release create accepts asset paths positionally after the flags.
        if (paths.length > 0) {
            args.push(...paths);
        }

        const result = await runner.run("gh", args, this.runOpts(options.cwd));

        if (result.exitCode !== 0) {
            return undefined;
        }

        return { url: result.stdout.trim() || undefined };
    }

    public async addLabels(runner: CommandRunner, options: AddLabelsOptions): Promise<boolean> {
        if (options.labels.length === 0) {
            return true;
        }

        const args = ["api", "-X", "POST", `repos/${options.repo}/issues/${options.issueNumber}/labels`];

        for (const label of options.labels) {
            args.push("-f", `labels[]=${label}`);
        }

        const result = await runner.run("gh", args, this.runOpts(options.cwd));

        return result.exitCode === 0;
    }

    public async upsertIssue(runner: CommandRunner, options: UpsertIssueOptions): Promise<UpsertIssueResult | undefined> {
        // Search open issues by title-marker. Using the `gh issue list` JSON
        // surface keeps us off the search-API rate limit.
        const list = await runner.run(
            "gh",
            ["issue", "list", "--repo", options.repo, "--state", "open", "--search", options.marker, "--json", "number,title,url", "--limit", "20"],
            this.runOpts(options.cwd),
        );

        if (list.exitCode === 0 && list.stdout.trim() && list.stdout.trim() !== "[]") {
            try {
                const parsed = JSON.parse(list.stdout) as { number: number; title: string; url?: string }[];
                const existing = parsed.find((i) => i.title.includes(options.marker));

                if (existing) {
                    const editArgs = ["issue", "edit", String(existing.number), "--repo", options.repo, "--title", options.title, "--body", options.body];

                    if (options.labels && options.labels.length > 0) {
                        editArgs.push("--add-label", options.labels.join(","));
                    }

                    if (options.assignees && options.assignees.length > 0) {
                        editArgs.push("--add-assignee", options.assignees.join(","));
                    }

                    const editResult = await runner.run("gh", editArgs, this.runOpts(options.cwd));

                    return editResult.exitCode === 0 ? { created: false, number: existing.number, url: existing.url } : undefined;
                }
            } catch {
                // fall through to create
            }
        }

        const createArgs = ["issue", "create", "--repo", options.repo, "--title", options.title, "--body", options.body];

        if (options.labels && options.labels.length > 0) {
            createArgs.push("--label", options.labels.join(","));
        }

        if (options.assignees && options.assignees.length > 0) {
            createArgs.push("--assignee", options.assignees.join(","));
        }

        const create = await runner.run("gh", createArgs, this.runOpts(options.cwd));

        if (create.exitCode !== 0) {
            return undefined;
        }

        const url = create.stdout.trim();
        const match = /\/issues\/(\d+)/.exec(url);

        return match ? { created: true, number: Number.parseInt(match[1] ?? "0", 10), url } : undefined;
    }

    public async closeIssue(runner: CommandRunner, options: CloseIssueOptions): Promise<boolean> {
        if (options.closingComment) {
            await runner.run(
                "gh",
                ["issue", "comment", String(options.issueNumber), "--repo", options.repo, "--body", options.closingComment],
                this.runOpts(options.cwd),
            );
        }

        const result = await runner.run("gh", ["issue", "close", String(options.issueNumber), "--repo", options.repo], this.runOpts(options.cwd));

        return result.exitCode === 0;
    }

    // fallow-ignore-next-line unused-class-member -- RemoteReleaseClient contract member (accessed polymorphically via the remote interface)
    public async upsertPullRequest(runner: CommandRunner, options: UpsertPullRequestOptions): Promise<UpsertPullRequestResult | undefined> {
        const list = await runner.run(
            "gh",
            ["pr", "list", "--repo", options.repo, "--head", options.head, "--state", "open", "--json", "number,url"],
            this.runOpts(options.cwd),
        );

        if (list.exitCode === 0 && list.stdout.trim() && list.stdout.trim() !== "[]") {
            try {
                const parsed = JSON.parse(list.stdout) as { number: number; url?: string }[];

                if (parsed[0]) {
                    await runner.run(
                        "gh",
                        ["pr", "edit", String(parsed[0].number), "--repo", options.repo, "--title", options.title, "--body", options.body],
                        this.runOpts(options.cwd),
                    );

                    return { existing: true, number: parsed[0].number, url: parsed[0].url };
                }
            } catch {
                // fall through to create
            }
        }

        const create = await runner.run(
            "gh",
            ["pr", "create", "--repo", options.repo, "--head", options.head, "--base", options.base, "--title", options.title, "--body", options.body],
            this.runOpts(options.cwd),
        );

        if (create.exitCode !== 0) {
            return undefined;
        }

        const match = /\/pull\/(\d+)/.exec(create.stdout);

        return match ? { existing: false, number: Number.parseInt(match[1] ?? "0", 10), url: create.stdout.trim() } : undefined;
    }
}
