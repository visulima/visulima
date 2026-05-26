import type { ParsedTag } from "../semver-helpers";
import { parseTag } from "../semver-helpers";

interface GitlabProjectTags {
    readonly tags: { name: string; sha: string }[];
    readonly parsed: (ParsedTag & { sha: string })[];
}

export interface GitlabResolverOptions {
    /** GitLab access token. Falls back to `GITLAB_TOKEN` / `CI_JOB_TOKEN`. */
    readonly token: string | undefined;
    /** Default API host (`gitlab.com`). Self-hosted instances may be reached at different hosts. */
    readonly apiBase?: string;
    /** Pluggable fetch for tests. */
    readonly fetch?: typeof fetch;
}

/**
 * Resolves GitLab project tags via the v4 REST API. Project paths
 * (`group/subgroup/project`) are URL-encoded once for the API call.
 * Self-hosted GitLab installations are handled implicitly: the project
 * string itself may contain the host (`gitlab.example.com/group/project`)
 * in which case we route the request there.
 */
export class GitlabResolver {
    private readonly token: string | undefined;

    private readonly defaultApiBase: string;

    private readonly fetchImpl: typeof fetch;

    private readonly tagCache = new Map<string, Promise<GitlabProjectTags>>();

    public constructor(options: GitlabResolverOptions) {
        this.token = options.token ?? process.env.GITLAB_TOKEN ?? process.env.CI_JOB_TOKEN;
        this.defaultApiBase = options.apiBase ?? "https://gitlab.com";
        this.fetchImpl = options.fetch ?? fetch;
    }

    public async listTags(projectPath: string): Promise<GitlabProjectTags> {
        const cached = this.tagCache.get(projectPath);

        if (cached) {
            return cached;
        }

        const promise = this.fetchTags(projectPath);

        this.tagCache.set(projectPath, promise);

        return promise;
    }

    private resolveHostAndPath(projectPath: string): { host: string; path: string } {
        const firstSlash = projectPath.indexOf("/");

        if (firstSlash > 0) {
            const head = projectPath.slice(0, firstSlash);

            // Self-hosted host detection: contains a `.` (domain) and
            // isn't a bare group like `my-group`.
            if (head.includes(".")) {
                return { host: `https://${head}`, path: projectPath.slice(firstSlash + 1) };
            }
        }

        return { host: this.defaultApiBase, path: projectPath };
    }

    private async fetchTags(projectPath: string): Promise<GitlabProjectTags> {
        const empty: GitlabProjectTags = { parsed: [], tags: [] };
        const { host, path } = this.resolveHostAndPath(projectPath);
        const encoded = encodeURIComponent(path);
        const url = `${host}/api/v4/projects/${encoded}/repository/tags?per_page=100`;
        const headers: Record<string, string> = {
            Accept: "application/json",
            "User-Agent": "vis-update-gitlab",
        };

        if (this.token) {
            headers["PRIVATE-TOKEN"] = this.token;
        }

        try {
            const response = await this.fetchImpl(url, { headers });

            if (!response.ok) {
                return empty;
            }

            const json = (await response.json()) as { name?: string; commit?: { id?: string } }[];

            if (!Array.isArray(json)) {
                return empty;
            }

            const tags = json
                .map((entry) => ({ name: typeof entry.name === "string" ? entry.name : "", sha: typeof entry.commit?.id === "string" ? entry.commit.id : "" }))
                .filter((entry) => entry.name !== "");
            const parsed: (ParsedTag & { sha: string })[] = [];

            for (const entry of tags) {
                const tag = parseTag(entry.name);

                if (tag) {
                    parsed.push({ ...tag, sha: entry.sha });
                }
            }

            return { parsed, tags };
        } catch {
            return empty;
        }
    }
}
