/**
 * Archived-repo marshall.
 *
 * Resolves a package's `repository.url` to a GitHub `owner/repo`, then asks
 * `https://api.github.com/repos/{owner}/{repo}` whether the project has been
 * archived. Archived projects no longer receive maintenance or security
 * patches, so taking a hard dependency on one is a smell.
 *
 * Results are cached on disk for 24h — including negative ("repo missing")
 * and "not archived" results — so a repeated `vis add` doesn't hammer the
 * GitHub API rate limit (60/hour unauthenticated, 5k/hour with a PAT).
 *
 * Non-GitHub URLs are silently skipped; only GitHub provides an archived
 * flag through a stable public API, and GitLab/Bitbucket cover vanishingly
 * few packages.
 */

import { readdirSync, rmSync, writeFileSync } from "node:fs";

import { ensureDirSync, isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { getVisCacheDir } from "../../util/vis-paths";
import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "./concurrency";
import { getPackument } from "./packument";
import { isMarshallDisabled } from "./registry";

export interface ArchivedRepoFinding {
    archivedAt?: string;
    kind: "archived" | "missing-repo";
    owner: string;
    packageName: string;
    repo: string;
}

export interface RunArchivedRepoMarshallOptions {
    allowlist?: string[];
    cacheTtlMs?: number;
    /** Max packages inspected in parallel. Defaults to {@link DEFAULT_MARSHALL_CONCURRENCY}. */
    concurrency?: number;
    githubToken?: string;
    signal?: AbortSignal;
    workspaceRoot?: string;
}

interface ArchivedRepoCacheEntry {
    archived: boolean;
    archivedAt?: string;
    createdAt: number;
    missing?: boolean;
    ttlMs: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const GITHUB_API_BASE = "https://api.github.com/repos";

const getArchivedRepoCacheDir = (): string => join(getVisCacheDir(), "archived-repo");

const cacheFilePath = (owner: string, repo: string): string =>
    join(getArchivedRepoCacheDir(), `${encodeURIComponent(owner)}__${encodeURIComponent(repo)}.json`);

const readCachedRepo = (owner: string, repo: string): ArchivedRepoCacheEntry | undefined => {
    const filePath = cacheFilePath(owner, repo);

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    try {
        const entry = readJsonSync(filePath) as unknown as ArchivedRepoCacheEntry;

        if (Date.now() - entry.createdAt > entry.ttlMs) {
            rmSync(filePath, { force: true });

            return undefined;
        }

        return entry;
    } catch {
        rmSync(filePath, { force: true });

        return undefined;
    }
};

const writeCachedRepo = (owner: string, repo: string, payload: Omit<ArchivedRepoCacheEntry, "createdAt" | "ttlMs">, ttlMs: number): void => {
    ensureDirSync(getArchivedRepoCacheDir());

    const entry: ArchivedRepoCacheEntry = {
        createdAt: Date.now(),
        ttlMs,
        ...payload,
    };

    writeFileSync(cacheFilePath(owner, repo), JSON.stringify(entry), "utf8");
};

/**
 * Extract `{ owner, repo }` from a `repository.url` value. Handles every
 * shape npm packuments use in the wild:
 *
 *   - `git+https://github.com/owner/repo.git`
 *   - `https://github.com/owner/repo`
 *   - `git@github.com:owner/repo.git`
 *   - `ssh://git@github.com/owner/repo.git`
 *
 * Returns `undefined` for non-GitHub URLs (gitlab/bitbucket/codeberg/…) so
 * the caller can skip them silently. Trailing `.git` and trailing slashes
 * are stripped.
 */
export const parseGitHubUrl = (raw: string | undefined): { owner: string; repo: string } | undefined => {
    if (typeof raw !== "string" || raw.trim() === "") {
        return undefined;
    }

    const candidate = raw.trim().replace(/^git\+/, "");

    // git@github.com:owner/repo(.git)?
    const sshShorthand = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?\/?$/i.exec(candidate);

    if (sshShorthand) {
        return { owner: sshShorthand[1] as string, repo: sshShorthand[2] as string };
    }

    // ssh://git@github.com/owner/repo(.git)?
    const sshUrl = /^ssh:\/\/git@github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/i.exec(candidate);

    if (sshUrl) {
        return { owner: sshUrl[1] as string, repo: sshUrl[2] as string };
    }

    // https?://(www.)?github.com/owner/repo(.git)?
    const httpsUrl = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?\/?$/i.exec(candidate);

    if (httpsUrl) {
        return { owner: httpsUrl[1] as string, repo: httpsUrl[2] as string };
    }

    return undefined;
};

interface GitHubRepoResponse {
    archived?: boolean;
    /** GitHub returns this when archiving — but only when archived === true. */
    archived_at?: string | null;
}

interface FetchRepoResult {
    archived?: boolean;
    archivedAt?: string;
    kind: "missing" | "ok" | "transient-error";
}

const fetchGitHubRepo = async (owner: string, repo: string, token: string | undefined, signal: AbortSignal | undefined): Promise<FetchRepoResult> => {
    const url = `${GITHUB_API_BASE}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, DEFAULT_FETCH_TIMEOUT_MS);
    const abortListener = (): void => { controller.abort(); };

    signal?.addEventListener("abort", abortListener, { once: true });

    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "visulima-vis-marshall",
    };

    if (token !== undefined && token !== "") {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, { headers, signal: controller.signal });

        if (response.status === 404) {
            return { kind: "missing" };
        }

        if (!response.ok) {
            // 403 (rate-limited) / 5xx — degrade gracefully, no finding.
            return { kind: "transient-error" };
        }

        const body = (await response.json()) as GitHubRepoResponse;
        const archived = body.archived === true;
        const archivedAt = typeof body.archived_at === "string" ? body.archived_at : undefined;

        return { archived, archivedAt, kind: "ok" };
    } catch {
        return { kind: "transient-error" };
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abortListener);
    }
};

const resolveLatestVersion = (versions: string[], latestTag: string | undefined): string | undefined => {
    if (latestTag !== undefined && versions.includes(latestTag)) {
        return latestTag;
    }

    return versions.at(-1);
};

export const runArchivedRepoMarshall = async (
    packages: { name: string; version: string }[],
    options: RunArchivedRepoMarshallOptions = {},
): Promise<ArchivedRepoFinding[]> => {
    if (isMarshallDisabled("archivedRepo")) {
        return [];
    }

    const allowlist = new Set(options.allowlist);
    const ttlMs = options.cacheTtlMs ?? DEFAULT_TTL_MS;
    const token = options.githubToken ?? process.env.GITHUB_TOKEN;
    const concurrency = options.concurrency ?? DEFAULT_MARSHALL_CONCURRENCY;

    // Different packages in a monorepo often share the same GitHub repo
    // (e.g. every `@visulima/*`). Dedup across packages so we hit the API
    // once per repo, never once per package.
    const repoPromises = new Map<string, Promise<FetchRepoResult>>();

    const fetchRepoOnce = async (owner: string, repo: string): Promise<FetchRepoResult> => {
        const key = `${owner}/${repo}`;
        let inFlight = repoPromises.get(key);

        if (inFlight === undefined) {
            inFlight = (async (): Promise<FetchRepoResult> => {
                const cached = readCachedRepo(owner, repo);

                if (cached !== undefined) {
                    if (cached.missing === true) {
                        return { archived: false, kind: "missing" };
                    }

                    return { archived: cached.archived, archivedAt: cached.archivedAt, kind: "ok" };
                }

                const result = await fetchGitHubRepo(owner, repo, token, options.signal);

                if (result.kind === "missing") {
                    writeCachedRepo(owner, repo, { archived: false, missing: true }, ttlMs);
                } else if (result.kind === "ok") {
                    writeCachedRepo(owner, repo, { archived: result.archived === true, archivedAt: result.archivedAt }, ttlMs);
                }

                return result;
            })();

            repoPromises.set(key, inFlight);
        }

        return inFlight;
    };

    const perPackage = await mapWithConcurrency(packages, concurrency, async ({ name, version }): Promise<ArchivedRepoFinding | undefined> => {
        if (allowlist.has(name)) {
            return undefined;
        }

        const packument = await getPackument(name, { workspaceRoot: options.workspaceRoot });

        if (packument === undefined) {
            return undefined;
        }

        const entry = packument.versions[version]
            ?? packument.versions[resolveLatestVersion(Object.keys(packument.versions), packument["dist-tags"]?.latest) ?? ""];

        if (entry === undefined) {
            return undefined;
        }

        const parsed = parseGitHubUrl(entry.repository?.url);

        if (parsed === undefined) {
            return undefined;
        }

        const result = await fetchRepoOnce(parsed.owner, parsed.repo);

        if (result.kind === "transient-error") {
            return undefined;
        }

        if (result.kind === "missing") {
            return { kind: "missing-repo", owner: parsed.owner, packageName: name, repo: parsed.repo };
        }

        if (result.archived === true) {
            return {
                ...(result.archivedAt === undefined ? {} : { archivedAt: result.archivedAt }),
                kind: "archived",
                owner: parsed.owner,
                packageName: name,
                repo: parsed.repo,
            };
        }

        return undefined;
    });

    return perPackage.filter((entry): entry is ArchivedRepoFinding => entry !== undefined);
};

/**
 * Drop every cached archived-repo record. Returns the number of files
 * removed. Used by `vis cache clean --archived-repo`.
 */
export const clearArchivedRepoCache = (): number => {
    const directory = getArchivedRepoCacheDir();

    if (!isAccessibleSync(directory)) {
        return 0;
    }

    let removed = 0;

    for (const entry of readdirSync(directory)) {
        if (entry.endsWith(".json")) {
            rmSync(join(directory, entry), { force: true });
            removed += 1;
        }
    }

    return removed;
};
