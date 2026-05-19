/**
 * Snyk security helpers.
 *
 * Fetches known vulnerabilities for an exact `name@version` from the Snyk
 * REST "List issues for a package" endpoint, then normalises the response to
 * the same `PackageReportData` shape Socket.dev / deps.dev return so the
 * registry can merge results.
 *
 * One endpoint per package (paginated):
 *   `GET /rest/orgs/{orgId}/packages/{purl}/issues?version=&lt;apiVersion>`
 *
 * Snyk only reports vulnerabilities — it has no maintenance / quality /
 * supply-chain / license signal. Those axes stay neutral (0.5), matching the
 * convention deps.dev uses when it lacks data; the `vulnerability` axis is
 * knocked down when unresolved issues exist.
 *
 * Requires an org id + API token (config or VIS_SNYK_ORG / VIS_SNYK_TOKEN).
 * Rate limit: 180 requests/min/user — bounded parallelism + disk cache keep
 * us well under it.
 * @see https://docs.snyk.io/snyk-api/using-specific-snyk-apis/issues-list-issues-for-a-package
 */

import { readdirSync, rmSync, statSync, writeFileSync } from "node:fs";

import { ensureDirSync, isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { getVisCacheDir } from "../util/vis-paths";
import { cvssToSeverity } from "./deps-dev-security";
import type { PackageAlert, PackageReportData, SecurityProvider, SecurityProviderCacheStats } from "./provider";

const SNYK_API_BASE = "https://api.snyk.io";
const DEFAULT_API_VERSION = "2024-10-15";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_PARALLEL_REQUESTS = 6;
const MAX_PAGES = 10;
const PAGE_LIMIT = 1000;

const getCacheDirectory = (): string => join(getVisCacheDir(), "snyk", "issues");

interface SnykConfig {
    apiToken?: string;
    apiVersion?: string;
    cacheTtlMs?: number;
    enabled?: boolean;
    orgId?: string;
    timeoutMs?: number;
}

interface SnykSeverity {
    level?: string;
    score?: number;
    source?: string;
    type?: string;
}

interface SnykProblem {
    id: string;
    source: string;
}

interface SnykIssue {
    attributes?: {
        created_at?: string;
        effective_severity_level?: string;
        problems?: SnykProblem[];
        severities?: SnykSeverity[];
        slots?: { disclosure_time?: string; publication_time?: string };
        title?: string;
    };
    id: string;
}

interface SnykIssuesResponse {
    data?: SnykIssue[];
    links?: { next?: string };
}

interface CacheEntry {
    createdAt: number;
    payload: SnykIssue[];
    ttlMs: number;
}

interface FetchSnykReportsOptions {
    apiToken: string;
    apiVersion?: string;
    cacheTtlMs?: number;
    orgId: string;
    timeoutMs?: number;
}

const buildCacheKey = (name: string, version: string): string => `${encodeURIComponent(name)}__${encodeURIComponent(version)}`;

const readCache = (directory: string, key: string): SnykIssue[] | undefined => {
    try {
        const entry = readJsonSync(join(directory, `${key}.json`)) as unknown as CacheEntry;

        if (Date.now() - entry.createdAt > entry.ttlMs) {
            rmSync(join(directory, `${key}.json`), { force: true });

            return undefined;
        }

        return entry.payload;
    } catch {
        return undefined;
    }
};

const writeCache = (directory: string, key: string, payload: SnykIssue[], ttlMs: number): void => {
    ensureDirSync(directory);

    const entry: CacheEntry = { createdAt: Date.now(), payload, ttlMs };

    writeFileSync(join(directory, `${key}.json`), JSON.stringify(entry), "utf8");
};

/** Builds the URL-encoded purl path segment, e.g. `pkg:npm/@scope/name@1.2.3`. */
const toPurl = (name: string, version: string): string => encodeURIComponent(`pkg:npm/${name}@${version}`);

/**
 * Resolves a pagination `links.next` (relative path or absolute URL) against
 * the Snyk API base. Returns `undefined` when it does not resolve to the
 * Snyk origin — every request carries the `Authorization: token` header, so
 * following an off-origin link would leak the credential.
 */
const resolveNextUrl = (next: string): string | undefined => {
    try {
        const url = new URL(next, `${SNYK_API_BASE}/`);

        return url.origin === SNYK_API_BASE ? url.toString() : undefined;
    } catch {
        return undefined;
    }
};

const fetchJson = async (url: string, apiToken: string, timeoutMs: number): Promise<SnykIssuesResponse | undefined> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            headers: {
                Accept: "application/vnd.api+json",
                Authorization: `token ${apiToken}`,
                "User-Agent": "@visulima/vis",
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            return undefined;
        }

        return (await response.json()) as SnykIssuesResponse;
    } catch {
        return undefined;
    } finally {
        clearTimeout(timeout);
    }
};

/**
 * Fetches every issue page for a single package. Returns `undefined` only on
 * a hard failure (network/non-2xx on the first page) so the caller can omit
 * the package; an empty array means "known package, no issues".
 */
const fetchIssues = async (
    name: string,
    version: string,
    options: Required<Omit<FetchSnykReportsOptions, "cacheTtlMs">> & { cacheTtlMs: number },
): Promise<SnykIssue[] | undefined> => {
    const directory = getCacheDirectory();
    const key = buildCacheKey(name, version);
    const cached = readCache(directory, key);

    if (cached) {
        return cached;
    }

    const { apiToken, apiVersion, cacheTtlMs, orgId, timeoutMs } = options;

    let next: string | undefined = `${SNYK_API_BASE}/rest/orgs/${encodeURIComponent(orgId)}/packages/${toPurl(name, version)}/issues?version=${encodeURIComponent(apiVersion)}&limit=${String(PAGE_LIMIT)}`;
    const issues: SnykIssue[] = [];

    for (let page = 0; next && page < MAX_PAGES; page += 1) {
        const response = await fetchJson(next, apiToken, timeoutMs);

        if (!response) {
            // Hard failure on the first page → signal "omit". Once we have at
            // least one page, degrade gracefully to what we collected.
            return page === 0 ? undefined : issues;
        }

        issues.push(...(response.data ?? []));
        next = response.links?.next ? resolveNextUrl(response.links.next) : undefined;
    }

    writeCache(directory, key, issues, cacheTtlMs);

    return issues;
};

const VALID_SEVERITIES = new Set<PackageAlert["severity"]>(["critical", "high", "low", "medium"]);

/** Resolves an issue's severity: effective level → primary severity → CVSS band. */
const issueSeverity = (issue: SnykIssue): PackageAlert["severity"] => {
    const effective = issue.attributes?.effective_severity_level?.toLowerCase();

    if (effective && VALID_SEVERITIES.has(effective as PackageAlert["severity"])) {
        return effective as PackageAlert["severity"];
    }

    const severities = issue.attributes?.severities ?? [];
    const primary = severities.find((s) => s.type === "primary") ?? severities[0];
    const level = primary?.level?.toLowerCase();

    if (level && VALID_SEVERITIES.has(level as PackageAlert["severity"])) {
        return level as PackageAlert["severity"];
    }

    return cvssToSeverity(primary?.score);
};

const issueToAlert = (issue: SnykIssue): PackageAlert => {
    const problems = issue.attributes?.problems ?? [];
    const cve = problems.find((p) => p.source === "CVE" || p.id.startsWith("CVE-"));
    const cwes = problems
        .filter((p) => p.source === "CWE" || p.id.startsWith("CWE-"))
        .map((p) => { return { id: p.id as `CWE-${string}` }; });

    const alert: PackageAlert = {
        category: "vulnerability",
        key: issue.id,
        severity: issueSeverity(issue),
        type: "vulnerability",
    };

    if (cve) {
        const lastPublish = issue.attributes?.slots?.publication_time ?? issue.attributes?.created_at ?? "";

        alert.props = { cveId: cve.id as `CVE-${string}`, lastPublish };

        if (cwes.length > 0) {
            alert.props.cwes = cwes;
        }
    }

    return alert;
};

/** Neutral 0.5 across every axis; Snyk has no non-vulnerability signal. */
const neutralScore = (): PackageReportData["score"] => {
    return {
        license: 0.5,
        maintenance: 0.5,
        overall: 0.5,
        quality: 0.5,
        supplyChain: 0.5,
        vulnerability: 0.5,
    };
};

const buildReport = (name: string, version: string, issues: SnykIssue[]): PackageReportData => {
    const alerts = issues.map((issue) => issueToAlert(issue));
    const score = neutralScore();

    if (alerts.length > 0) {
        const critOrHigh = alerts.some((a) => a.severity === "critical" || a.severity === "high");

        score.vulnerability = critOrHigh ? 0.2 : 0.5;
        score.overall = Number(((score.license + score.maintenance + score.quality + score.supplyChain + score.vulnerability) / 5).toFixed(2));
    }

    const namespace = name.startsWith("@") ? (name.slice(0, name.indexOf("/")) as `@${string}`) : undefined;
    const shortName = namespace ? name.slice(namespace.length + 1) : name;

    const report: PackageReportData = {
        alerts,
        author: [],
        id: `pkg:npm/${name}@${version}`,
        license: "",
        name: shortName,
        score,
        size: 0,
        type: "npm",
        version,
    };

    if (namespace) {
        report.namespace = namespace;
    }

    return report;
};

/**
 * Fetches Snyk reports for the given packages. Returns a map keyed by
 * `"name@version"`, matching the shape returned by the other providers.
 *
 * A package whose issues endpoint hard-fails is omitted; a package with no
 * known issues appears with neutral scores and no alerts.
 */
export const fetchSnykReports = async (
    packages: { name: string; version: string }[],
    options: FetchSnykReportsOptions,
): Promise<Map<string, PackageReportData>> => {
    const results = new Map<string, PackageReportData>();

    if (packages.length === 0) {
        return results;
    }

    const resolved = {
        apiToken: options.apiToken,
        apiVersion: options.apiVersion ?? DEFAULT_API_VERSION,
        cacheTtlMs: options.cacheTtlMs ?? DEFAULT_TTL_MS,
        orgId: options.orgId,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };

    const work = [...packages];

    const worker = async (): Promise<void> => {
        for (;;) {
            const pkg = work.shift();

            if (!pkg) {
                return;
            }

            const issues = await fetchIssues(pkg.name, pkg.version, resolved);

            if (issues !== undefined) {
                results.set(`${pkg.name}@${pkg.version}`, buildReport(pkg.name, pkg.version, issues));
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_REQUESTS, packages.length) }, worker));

    return results;
};

export const clearSnykCache = (): number => {
    const directory = getCacheDirectory();

    if (!isAccessibleSync(directory)) {
        return 0;
    }

    let removed = 0;

    for (const file of readdirSync(directory).filter((f) => f.endsWith(".json"))) {
        rmSync(join(directory, file), { force: true });
        removed += 1;
    }

    return removed;
};

export const getSnykCacheStats = (): SecurityProviderCacheStats => {
    const directory = getCacheDirectory();

    let entries = 0;
    let totalSizeBytes = 0;
    let oldest: number | undefined;
    let newest: number | undefined;

    if (isAccessibleSync(directory)) {
        for (const file of readdirSync(directory).filter((f) => f.endsWith(".json"))) {
            const stat = statSync(join(directory, file));

            entries += 1;
            totalSizeBytes += stat.size;

            if (oldest === undefined || stat.mtimeMs < oldest) {
                oldest = stat.mtimeMs;
            }

            if (newest === undefined || stat.mtimeMs > newest) {
                newest = stat.mtimeMs;
            }
        }
    }

    return { entries, newestEntry: newest, oldestEntry: oldest, totalSizeBytes };
};

/**
 * Constructs a Snyk `SecurityProvider` if the config is enabled and both an
 * org id and API token are resolvable (config or VIS_SNYK_ORG /
 * VIS_SNYK_TOKEN). Returns `undefined` otherwise so the registry skips it.
 */
export const createSnykProvider = (config: SnykConfig | undefined): SecurityProvider | undefined => {
    if (!config?.enabled) {
        return undefined;
    }

    const apiToken = config.apiToken ?? process.env.VIS_SNYK_TOKEN;
    const orgId = config.orgId ?? process.env.VIS_SNYK_ORG;

    if (!apiToken || !orgId) {
        return undefined;
    }

    const resolved: FetchSnykReportsOptions = {
        apiToken,
        apiVersion: config.apiVersion,
        cacheTtlMs: config.cacheTtlMs,
        orgId,
        timeoutMs: config.timeoutMs,
    };

    return {
        clearCache: clearSnykCache,
        displayName: "Snyk",
        fetchReports: (packages) => fetchSnykReports(packages, resolved),
        getCacheStats: getSnykCacheStats,
        id: "snyk",
    };
};

export type { SnykConfig, SnykIssue, SnykIssuesResponse };

export { buildReport, issueSeverity, issueToAlert };
