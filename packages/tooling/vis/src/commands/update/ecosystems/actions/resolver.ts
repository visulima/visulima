import { parseLinkHeader } from "../link-header";
import type { ParsedTag } from "../semver-helpers";
import { parseTag } from "../semver-helpers";

interface RepoTags {
    readonly parsed: (ParsedTag & { sha: string })[];
    readonly tags: { name: string; sha: string }[];
}

interface CommitInfo {
    /** ISO 8601 commit date — used by the min-age gate. */
    readonly committedAt: string | undefined;
    readonly sha: string;
}

export interface ActionsResolverOptions {
    /** Override the GitHub API base URL (used by tests). */
    readonly apiBase?: string;
    /** Pluggable fetch for tests. Defaults to the global `fetch`. */
    readonly fetch?: typeof fetch;
    /** Falls back to `GITHUB_TOKEN` / `GH_TOKEN` env vars when undefined. */
    readonly token: string | undefined;
}

/**
 * Resolves GitHub Actions metadata: tags, latest releases, SHA-for-ref.
 * One instance is created per update run and shared across every
 * reference, so the cache and the optional token only need to flow
 * through one layer.
 */
export class ActionsResolver {
    private readonly token: string | undefined;

    private readonly apiBase: string;

    private readonly fetchImpl: typeof fetch;

    /**
     * Per-repo cache keyed by `"owner/repo"`. Repo metadata + tag/commit
     * lookups are cached for the lifetime of one update run; rate-limiting
     * is the main reason but it also keeps a single workflow file with N
     * references to the same action down to a single API round trip.
     */
    private readonly tagsCache = new Map<string, Promise<RepoTags>>();

    private readonly commitCache = new Map<string, Promise<CommitInfo | undefined>>();

    public constructor(options: ActionsResolverOptions) {
        this.token = options.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
        this.apiBase = options.apiBase ?? "https://api.github.com";
        this.fetchImpl = options.fetch ?? fetch;
    }

    /**
     * Lists tags for `owner/repo` ordered newest-first. The result is
     * cached for the lifetime of this resolver.
     *
     * Returns an empty list on network or auth errors — the caller is
     * expected to surface this as "couldn't resolve" rather than crash.
     */
    public async listTags(owner: string, repo: string): Promise<RepoTags> {
        const key = `${owner}/${repo}`;
        const cached = this.tagsCache.get(key);

        if (cached) {
            return cached;
        }

        const promise = this.fetchTags(owner, repo);

        this.tagsCache.set(key, promise);

        return promise;
    }

    /**
     * Resolves a ref string (tag, branch, or SHA) to a 40-char commit SHA
     * plus the commit date. Branches resolve to their tip; tags resolve
     * through the annotated-tag indirection if needed; SHAs pass through.
     *
     * Returns `undefined` when the ref cannot be resolved (deleted tag,
     * invalid SHA, network failure).
     */
    public async resolveRef(owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        const key = `${owner}/${repo}@${ref}`;
        const cached = this.commitCache.get(key);

        if (cached) {
            return cached;
        }

        const promise = this.fetchCommit(owner, repo, ref);

        this.commitCache.set(key, promise);

        return promise;
    }

    private buildHeaders(): HeadersInit {
        const headers: Record<string, string> = {
            // The `+json` variant pins us to v3 of the API — the v4 GraphQL
            // surface is much heavier for our 3 needs.
            Accept: "application/vnd.github+json",
            "User-Agent": "vis-update-actions",
            "X-GitHub-Api-Version": "2022-11-28",
        };

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        return headers;
    }

    private async fetchTags(owner: string, repo: string): Promise<RepoTags> {
        // Encode each segment — workflow files in PRs from outside
        // contributors may contain slugs with reserved URL characters
        // (`..`, `%2f`, etc.) that would otherwise let a malformed slug
        // path-traverse to a different repo with the user's bearer
        // token attached.
        const initialUrl = `${this.apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tags?per_page=100`;
        const empty: RepoTags = { parsed: [], tags: [] };
        const tags: { name: string; sha: string }[] = [];

        // Cap pagination at 5 pages (500 tags). GitHub's tags endpoint
        // is cheap but unbounded — popular repos have thousands of
        // tags and we only need the newest ones for an "is this still
        // current" check.
        let nextUrl: string | undefined = initialUrl;
        let pages = 0;

        while (nextUrl && pages < 5) {
            const currentUrl: string = nextUrl;
            let response: Response;

            try {
                response = await this.fetchImpl(currentUrl, { headers: this.buildHeaders() });
            } catch {
                return empty;
            }

            if (!response.ok) {
                return empty;
            }

            let json: { commit?: { sha?: string }; name?: string }[];

            try {
                json = (await response.json()) as { commit?: { sha?: string }; name?: string }[];
            } catch {
                return empty;
            }

            if (!Array.isArray(json)) {
                return empty;
            }

            for (const entry of json) {
                const name = typeof entry.name === "string" ? entry.name : "";
                const sha = typeof entry.commit?.sha === "string" ? entry.commit.sha : "";

                if (name !== "" && sha !== "") {
                    tags.push({ name, sha });
                }
            }

            nextUrl = parseLinkHeader(response.headers.get("link")).next;
            pages += 1;
        }

        const parsed: (ParsedTag & { sha: string })[] = [];

        for (const entry of tags) {
            const tag = parseTag(entry.name);

            if (tag) {
                parsed.push({ ...tag, sha: entry.sha });
            }
        }

        return { parsed, tags };
    }

    private async fetchCommit(owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        const url = `${this.apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(ref)}`;

        try {
            const response = await this.fetchImpl(url, { headers: this.buildHeaders() });

            if (!response.ok) {
                return undefined;
            }

            const json = (await response.json()) as { commit?: { committer?: { date?: string } }; sha?: string };

            if (typeof json.sha !== "string") {
                return undefined;
            }

            return { committedAt: json.commit?.committer?.date, sha: json.sha };
        } catch {
            return undefined;
        }
    }
}
