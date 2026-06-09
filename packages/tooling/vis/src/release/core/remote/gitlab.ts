/**
 * GitLab `RemoteReleaseClient` — implements every forge op via the `glab`
 * CLI. The CLI's universal `glab api` escape hatch covers endpoints `glab`
 * doesn't ship dedicated commands for (note edits, MR-edit-by-iid).
 *
 * Auth: `glab` reads `GITLAB_TOKEN`, `CI_JOB_TOKEN`, or its own credential
 * store. We don't probe; the operator is expected to have it configured the
 * same way they configured `gh` for the GitHub adapter.
 *
 * Project paths: GitLab nests groups (`group/sub/repo`) and the REST API
 * needs the path URL-encoded. `glab api` accepts the raw path; we pre-encode
 * once via `encodeProjectPath()` so every call site stays identical to the
 * GitHub equivalent at the call-site level.
 */

import { basename } from "node:path";

import type { CommandRunner } from "../package-managers/interface";
import type {
    AddLabelsOptions,
    CloseIssueOptions,
    CreateReleaseOptions,
    CreateReleaseResult,
    ListRecentReleasesOptions,
    RecentRelease,
    ReleaseAsset,
    RemoteReleaseClient,
    UpsertCommentResult,
    UpsertIssueOptions,
    UpsertIssueResult,
    UpsertPullRequestOptions,
    UpsertPullRequestResult,
    UpsertStickyCommentOptions,
} from "./interface";

interface ExistingNote {
    body: string;
    id: number;
}

interface GenericPackageAsset {
    label?: string;
    linkType?: ReleaseAsset["type"];
    name?: string;
    packageName?: string;
    packageVersion?: string;
    path: string;
}

const encodeProjectPath = (path: string): string => encodeURIComponent(path);

const stripLeadingV = (tag: string): string => tag.replace(/^v(?=\d)/, "");

interface GitlabClientOptions {
    /** Self-hosted host, e.g. "gitlab.example.com". Maps to GITLAB_HOST. */
    host?: string;

    /**
     * HTTPS proxy URL — forwarded to `glab` subprocesses via
     * `HTTPS_PROXY` + `HTTP_PROXY` env vars. Mirrors the GitHub
     * adapter's plumbing.
     */
    httpProxy?: string;
}

const partitionAssets = (
    assets: CreateReleaseOptions["assets"],
): {
    genericPackages: GenericPackageAsset[];
    links: { linkType?: ReleaseAsset["type"]; name: string; url: string }[];
    uploads: string[];
} => {
    const uploads: string[] = [];
    const links: { linkType?: ReleaseAsset["type"]; name: string; url: string }[] = [];
    const genericPackages: GenericPackageAsset[] = [];

    for (const entry of assets ?? []) {
        if (typeof entry === "string") {
            uploads.push(entry);

            continue;
        }

        if (entry.path) {
            if (entry.target === "generic_package") {
                genericPackages.push({
                    label: entry.label,
                    linkType: entry.type,
                    name: entry.name,
                    packageName: entry.packageName,
                    packageVersion: entry.packageVersion,
                    path: entry.path,
                });
            } else {
                uploads.push(entry.path);
            }
        } else if (entry.linkUrl) {
            links.push({
                linkType: entry.type,
                name: entry.label ?? entry.name ?? entry.linkUrl,
                url: entry.linkUrl,
            });
        }
    }

    return { genericPackages, links, uploads };
};

export class GitlabRemoteClient implements RemoteReleaseClient {
    public readonly id = "gitlab" as const;

    /** Latch so the not-supported warning only prints once per process. */
    private static recentReleasesWarned = false;

    public async listRecentReleases(
        _runner: CommandRunner,
        _options: ListRecentReleasesOptions,
    ): Promise<RecentRelease[]> {
        if (!GitlabRemoteClient.recentReleasesWarned) {
            GitlabRemoteClient.recentReleasesWarned = true;
            // eslint-disable-next-line no-console
            console.warn("[vis release] addReleases is not yet supported on GitLab — skipping the Related releases block.");
        }

        return [];
    }

    private readonly host: string | undefined;

    private readonly httpProxy: string | undefined;

    public constructor(options: GitlabClientOptions = {}) {
        this.host = options.host;
        this.httpProxy = options.httpProxy;
    }

    /**
     * Build a runner-options object that injects `GITLAB_HOST` /
     * `HTTPS_PROXY` / `HTTP_PROXY` whenever the adapter was configured
     * for a self-hosted instance or operating behind a proxy. Every
     * CLI/API call funnels through this helper so we don't risk a stray
     * invocation landing on `gitlab.com` or bypassing the proxy.
     */
    private runOpts(cwd: string): { cwd: string; env?: NodeJS.ProcessEnv; silent: true } {
        if (!this.host && !this.httpProxy) {
            return { cwd, silent: true };
        }

        const env: NodeJS.ProcessEnv = { ...process.env };

        if (this.host) {
            env["GITLAB_HOST"] = this.host;
        }

        if (this.httpProxy) {
            env["HTTPS_PROXY"] = this.httpProxy;
            env["HTTP_PROXY"] = this.httpProxy;
        }

        return { cwd, env, silent: true };
    }

    private async listMrNotes(
        runner: CommandRunner,
        cwd: string,
        repo: string,
        mrIid: number,
    ): Promise<ExistingNote[]> {
        const result = await runner.run(
            "glab",
            ["api", `projects/${encodeProjectPath(repo)}/merge_requests/${mrIid}/notes`, "--paginate"],
            this.runOpts(cwd),
        );

        if (result.exitCode !== 0) {
            return [];
        }

        try {
            const parsed = JSON.parse(result.stdout) as { body?: string; id: number; system?: boolean }[];

            // Skip system-generated notes (assignee changes, status updates) —
            // they aren't comments we want to treat as sticky candidates.
            return parsed
                .filter((n) => typeof n.body === "string" && n.system !== true)
                .map((n) => { return { body: n.body ?? "", id: n.id }; });
        } catch {
            return [];
        }
    }

    /**
     * Upload a single file to the Generic Package Registry under
     * `&lt;packageName>/&lt;packageVersion>/&lt;filename>` and register it as a
     * release link on the just-created release. This is the asset model
     * GitLab recommends for binaries that need to outlive the release
     * itself (deletion of a release detaches but doesn't purge the
     * package). Two-step PUT-then-link.
     */
    private async uploadGenericPackage(
        runner: CommandRunner,
        cwd: string,
        repo: string,
        tag: string,
        asset: GenericPackageAsset,
    ): Promise<void> {
        const project = encodeProjectPath(repo);
        const filename = basename(asset.path);
        const packageName = asset.packageName ?? repo.split("/").pop() ?? "release";
        const packageVersion = asset.packageVersion ?? stripLeadingV(tag);
        const uploadPath = `projects/${project}/packages/generic/${encodeURIComponent(packageName)}/${encodeURIComponent(packageVersion)}/${encodeURIComponent(filename)}`;

        // PUT the file. `glab api` accepts `--input <path>` for body uploads.
        const upload = await runner.run(
            "glab",
            ["api", "-X", "PUT", uploadPath, "--input", asset.path],
            this.runOpts(cwd),
        );

        if (upload.exitCode !== 0) {
            return;
        }

        // Build the canonical URL the GitLab UI uses for generic-package
        // downloads so consumers can paste it. Strip any scheme prefix the
        // operator might have copy-pasted into the host config; doubling it
        // breaks the asset link silently.
        const normalizedHost = this.host?.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
        const hostBase = normalizedHost ? `https://${normalizedHost}` : "https://gitlab.com";
        const linkUrl = `${hostBase}/api/v4/${uploadPath}`;
        const linkArgs = [
            "api",
            "-X",
            "POST",
            `projects/${project}/releases/${encodeURIComponent(tag)}/assets/links`,
            "-f",
            `name=${asset.label ?? asset.name ?? filename}`,
            "-f",
            `url=${linkUrl}`,
        ];

        if (asset.linkType) {
            linkArgs.push("-f", `link_type=${asset.linkType}`);
        }

        await runner.run("glab", linkArgs, this.runOpts(cwd));
    }

    public async detectRepoSlug(cwd: string, runner: CommandRunner): Promise<string | undefined> {
        // Prefer GitLab CI's canonical env var when running inside a pipeline —
        // git remotes can carry deploy-key URLs that don't round-trip cleanly.
        const ciPath = process.env["CI_PROJECT_PATH"];

        if (ciPath) {
            return ciPath;
        }

        const result = await runner.run("git", ["config", "--get", "remote.origin.url"], { cwd, silent: true });

        if (result.exitCode !== 0) {
            return undefined;
        }

        const url = result.stdout.trim();
        // gitlab.com/group/sub/repo(.git)? or git@gitlab.com:group/sub/repo.git
        const match = /gitlab\.[\w.-]+[/:]([^/].*?)(?:\.git)?$/.exec(url);

        return match?.[1];
    }

    public detectPullRequestNumber(env: NodeJS.ProcessEnv): number | undefined {
        const iid = env["CI_MERGE_REQUEST_IID"] ?? env["VIS_MR_NUMBER"];

        if (!iid) {
            return undefined;
        }

        const n = Number.parseInt(iid, 10);

        return Number.isNaN(n) ? undefined : n;
    }

    public async upsertStickyComment(
        runner: CommandRunner,
        options: UpsertStickyCommentOptions,
    ): Promise<UpsertCommentResult | undefined> {
        const notes = await this.listMrNotes(runner, options.cwd, options.repo, options.issueNumber);
        const existing = notes.find((n) => n.body.includes(options.marker));
        const fullBody = options.body.includes(options.marker) ? options.body : `${options.marker}\n${options.body}`;
        const project = encodeProjectPath(options.repo);

        if (existing) {
            const result = await runner.run(
                "glab",
                [
                    "api",
                    "-X",
                    "PUT",
                    `projects/${project}/merge_requests/${options.issueNumber}/notes/${existing.id}`,
                    "-f",
                    `body=${fullBody}`,
                ],
                this.runOpts(options.cwd),
            );

            return result.exitCode === 0 ? { created: false, id: existing.id } : undefined;
        }

        const result = await runner.run(
            "glab",
            [
                "api",
                "-X",
                "POST",
                `projects/${project}/merge_requests/${options.issueNumber}/notes`,
                "-f",
                `body=${fullBody}`,
            ],
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

    public async createRelease(
        runner: CommandRunner,
        options: CreateReleaseOptions,
    ): Promise<CreateReleaseResult | undefined> {
        // GitLab Releases v4 doesn't have a native draft flag — `options.draft`
        // is preserved for interface symmetry but ignored here. Operators
        // wanting drafts can delete the release manually.
        const { genericPackages, links, uploads } = partitionAssets(options.assets);
        const args = [
            "release",
            "create",
            options.tag,
            "--repo",
            options.repo,
            "--name",
            options.title,
            "--notes",
            options.body,
        ];

        if (options.milestones && options.milestones.length > 0) {
            for (const milestone of options.milestones) {
                args.push("--milestone", milestone);
            }
        }

        const result = await runner.run("glab", args, this.runOpts(options.cwd));

        if (result.exitCode !== 0) {
            return undefined;
        }

        // File-upload assets: follow-up `glab release upload` so a network blip
        // doesn't wipe the already-created release. Soft-fail handled by the
        // orchestrator wrapper.
        if (uploads.length > 0) {
            await runner.run(
                "glab",
                ["release", "upload", options.tag, "--repo", options.repo, ...uploads],
                this.runOpts(options.cwd),
            );
        }

        // Link-only assets (e.g. container image URLs) go through the
        // release-link API directly — there's no `glab` shortcut, so use
        // `glab api`.
        const project = encodeProjectPath(options.repo);

        for (const link of links) {
            const linkArgs = [
                "api",
                "-X",
                "POST",
                `projects/${project}/releases/${encodeURIComponent(options.tag)}/assets/links`,
                "-f",
                `name=${link.name}`,
                "-f",
                `url=${link.url}`,
            ];

            if (link.linkType) {
                linkArgs.push("-f", `link_type=${link.linkType}`);
            }

            await runner.run("glab", linkArgs, this.runOpts(options.cwd));
        }

        // Generic Package Registry uploads — two-step PUT-then-link per asset.
        for (const pkg of genericPackages) {
            await this.uploadGenericPackage(runner, options.cwd, options.repo, options.tag, pkg);
        }

        // glab release create's stdout shape varies between versions; ask the
        // API for the canonical URL instead.
        const view = await runner.run(
            "glab",
            ["api", `projects/${project}/releases/${encodeURIComponent(options.tag)}`],
            this.runOpts(options.cwd),
        );

        try {
            // GitLab API uses snake_case + `_links` HAL field — not a private prop.
            const parsed = JSON.parse(view.stdout) as { _links?: { self?: string } };

            // eslint-disable-next-line no-underscore-dangle -- GitLab API field name
            return { url: parsed._links?.self };
        } catch {
            return { url: undefined };
        }
    }

    public async addLabels(runner: CommandRunner, options: AddLabelsOptions): Promise<boolean> {
        if (options.labels.length === 0) {
            return true;
        }

        // GitLab's add-labels endpoint sets the full label list, so first read
        // the existing labels and append. The PUT projects/.../issues/:iid
        // endpoint accepts `add_labels` as a comma-separated string which is
        // additive — preferred when available.
        const project = encodeProjectPath(options.repo);
        const result = await runner.run(
            "glab",
            [
                "api",
                "-X",
                "PUT",
                `projects/${project}/issues/${options.issueNumber}`,
                "-f",
                `add_labels=${options.labels.join(",")}`,
            ],
            this.runOpts(options.cwd),
        );

        return result.exitCode === 0;
    }

    public async upsertIssue(
        runner: CommandRunner,
        options: UpsertIssueOptions,
    ): Promise<UpsertIssueResult | undefined> {
        const project = encodeProjectPath(options.repo);
        // Search open issues by title-marker via REST search.
        const list = await runner.run(
            "glab",
            [
                "api",
                `projects/${project}/issues?state=opened&search=${encodeURIComponent(options.marker)}&in=title`,
            ],
            this.runOpts(options.cwd),
        );

        if (list.exitCode === 0) {
            try {
                const parsed = JSON.parse(list.stdout) as { iid: number; title: string; web_url?: string }[];
                const existing = parsed.find((i) => i.title.includes(options.marker));

                if (existing) {
                    const editArgs = [
                        "api",
                        "-X",
                        "PUT",
                        `projects/${project}/issues/${existing.iid}`,
                        "-f",
                        `title=${options.title}`,
                        "-f",
                        `description=${options.body}`,
                    ];

                    if (options.labels && options.labels.length > 0) {
                        editArgs.push("-f", `add_labels=${options.labels.join(",")}`);
                    }

                    if (options.assignees?.[0]) {
                        // GitLab issues take a single assignee_id, not a list of
                        // usernames. Resolve via /users/?username=… inline.
                        const userLookup = await runner.run(
                            "glab",
                            ["api", `users?username=${encodeURIComponent(options.assignees[0])}`],
                            this.runOpts(options.cwd),
                        );

                        try {
                            const users = JSON.parse(userLookup.stdout) as { id: number }[];

                            if (users[0]) {
                                editArgs.push("-f", `assignee_id=${users[0].id}`);
                            }
                        } catch {
                            // fall through; missing assignee shouldn't block edit
                        }
                    }

                    const editResult = await runner.run("glab", editArgs, this.runOpts(options.cwd));

                    return editResult.exitCode === 0
                        ? { created: false, number: existing.iid, url: existing.web_url }
                        : undefined;
                }
            } catch {
                // fall through to create
            }
        }

        // Use `glab issue create` for the create path — friendlier flag set
        // than raw API and handles labels natively.
        const createArgs = [
            "issue",
            "create",
            "--repo",
            options.repo,
            "--title",
            options.title,
            "--description",
            options.body,
            "--yes",
        ];

        if (options.labels && options.labels.length > 0) {
            createArgs.push("--label", options.labels.join(","));
        }

        if (options.assignees?.[0]) {
            createArgs.push("--assignee", options.assignees[0]);
        }

        const create = await runner.run("glab", createArgs, this.runOpts(options.cwd));

        if (create.exitCode !== 0) {
            return undefined;
        }

        const trimmed = create.stdout.trim();
        const match = /\/issues\/(\d+)/.exec(trimmed);

        return match
            ? { created: true, number: Number.parseInt(match[1] ?? "0", 10), url: trimmed }
            : undefined;
    }

    public async closeIssue(runner: CommandRunner, options: CloseIssueOptions): Promise<boolean> {
        if (options.closingComment) {
            const project = encodeProjectPath(options.repo);

            await runner.run(
                "glab",
                [
                    "api",
                    "-X",
                    "POST",
                    `projects/${project}/issues/${options.issueNumber}/notes`,
                    "-f",
                    `body=${options.closingComment}`,
                ],
                this.runOpts(options.cwd),
            );
        }

        const result = await runner.run(
            "glab",
            ["issue", "close", String(options.issueNumber), "--repo", options.repo],
            this.runOpts(options.cwd),
        );

        return result.exitCode === 0;
    }

    public async upsertPullRequest(
        runner: CommandRunner,
        options: UpsertPullRequestOptions,
    ): Promise<UpsertPullRequestResult | undefined> {
        const project = encodeProjectPath(options.repo);
        const list = await runner.run(
            "glab",
            [
                "api",
                `projects/${project}/merge_requests?state=opened&source_branch=${encodeURIComponent(options.head)}&target_branch=${encodeURIComponent(options.base)}`,
            ],
            this.runOpts(options.cwd),
        );

        if (list.exitCode === 0) {
            try {
                const parsed = JSON.parse(list.stdout) as { iid: number; web_url?: string }[];

                if (parsed[0]) {
                    const editResult = await runner.run(
                        "glab",
                        [
                            "api",
                            "-X",
                            "PUT",
                            `projects/${project}/merge_requests/${parsed[0].iid}`,
                            "-f",
                            `title=${options.title}`,
                            "-f",
                            `description=${options.body}`,
                        ],
                        this.runOpts(options.cwd),
                    );

                    return editResult.exitCode === 0
                        ? { existing: true, number: parsed[0].iid, url: parsed[0].web_url }
                        : undefined;
                }
            } catch {
                // fall through to create
            }
        }

        const create = await runner.run(
            "glab",
            [
                "mr",
                "create",
                "--repo",
                options.repo,
                "--source-branch",
                options.head,
                "--target-branch",
                options.base,
                "--title",
                options.title,
                "--description",
                options.body,
                "--yes",
            ],
            this.runOpts(options.cwd),
        );

        if (create.exitCode !== 0) {
            return undefined;
        }

        const trimmed = create.stdout.trim();
        const match = /\/merge_requests\/(\d+)/.exec(trimmed);

        return match
            ? { existing: false, number: Number.parseInt(match[1] ?? "0", 10), url: trimmed }
            : undefined;
    }
}
