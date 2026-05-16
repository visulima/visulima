/**
 * deps.dev (Google Open Source Insights) security helpers.
 *
 * Fetches package metadata, advisories (OSV refs with CVSS), and OpenSSF
 * Scorecard data from the public deps.dev v3 API, then normalises the
 * response to the same `PackageReportData` shape Socket.dev returns so the
 * registry can merge results.
 *
 * Three endpoints are involved per package:
 *   1. `GET /v3/systems/npm/packages/{name}/versions/{version}`   – license + advisory refs + repo link
 *   2. `GET /v3/projects/{repoKey}`                               – Scorecard checks (one-shot per repo, heavily cached)
 *   3. `GET /v3/advisories/{ghsaId}`                              – CVSS + CVE aliases
 *
 * No authentication required.
 * @see https://docs.deps.dev/api/v3/
 * @see https://github.com/ossf/scorecard
 */

import { readdirSync, rmSync, statSync, writeFileSync } from "node:fs";

import { ensureDirSync, isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { getVisCacheDir } from "../util/vis-paths";
import type { PackageAlert, PackageReportData, SecurityProvider, SecurityProviderCacheStats } from "./provider";

const DEPS_DEV_API_BASE = "https://api.deps.dev/v3";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_VERSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_PROJECT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ADVISORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PARALLEL_REQUESTS = 8;

const getCacheDirectory = (kind: "advisories" | "projects" | "versions"): string =>
    join(getVisCacheDir(), "deps-dev", kind);

/** Map of Scorecard check name → which Socket-style score axis it contributes to. */
const SCORECARD_AXIS_MAP: Record<string, "license" | "maintenance" | "quality" | "supplyChain" | "vulnerability"> = {
    "Binary-Artifacts": "supplyChain",
    "Branch-Protection": "supplyChain",
    "CII-Best-Practices": "quality",
    "Code-Review": "maintenance",
    Contributors: "maintenance",
    "Dangerous-Workflow": "supplyChain",
    "Dependency-Update-Tool": "maintenance",
    Fuzzing: "quality",
    License: "license",
    Maintained: "maintenance",
    Packaging: "quality",
    "Pinned-Dependencies": "supplyChain",
    SAST: "quality",
    "Security-Policy": "quality",
    "Signed-Releases": "supplyChain",
    "Token-Permissions": "supplyChain",
    Vulnerabilities: "vulnerability",
    Webhooks: "supplyChain",
};

interface DepsDevConfig {
    advisoryCacheTtlMs?: number;
    enabled?: boolean;
    projectCacheTtlMs?: number;
    timeoutMs?: number;
    versionCacheTtlMs?: number;
}

interface DepsDevVersionResponse {
    advisoryKeys?: { id: string }[];
    deprecatedReason?: string;
    isDeprecated?: boolean;
    licenses?: string[];
    publishedAt?: string;
    relatedProjects?: { projectKey?: { id: string }; relationProvenance?: string; relationType?: string }[];
    versionKey?: { name: string; system: string; version: string };
}

interface ScorecardCheck {
    documentation?: { shortDescription?: string; url?: string };
    name: string;
    reason?: string;
    score: number;
}

interface DepsDevProjectResponse {
    license?: string;
    openIssuesCount?: number;
    scorecard?: {
        checks?: ScorecardCheck[];
        date?: string;
        overallScore?: number;
    };
    starsCount?: number;
}

interface DepsDevAdvisoryResponse {
    aliases?: string[];
    cvss3Score?: number;
    cvss3Vector?: string;
    title?: string;
}

interface CacheEntry<T> {
    createdAt: number;
    payload: T;
    ttlMs: number;
}

const buildCacheKey = (segments: string[]): string => segments.map((s) => encodeURIComponent(s)).join("__");

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T is the caller-supplied typed-cast convenience; avoids `as` at every callsite
const readCache = <T>(directory: string, key: string): T | undefined => {
    try {
        const entry = readJsonSync(join(directory, `${key}.json`)) as unknown as CacheEntry<T>;

        if (Date.now() - entry.createdAt > entry.ttlMs) {
            rmSync(join(directory, `${key}.json`), { force: true });

            return undefined;
        }

        return entry.payload;
    } catch {
        return undefined;
    }
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T is the caller-supplied typed-cast convenience; avoids `as` at every callsite
const writeCache = <T>(directory: string, key: string, payload: T, ttlMs: number): void => {
    ensureDirSync(directory);

    const entry: CacheEntry<T> = { createdAt: Date.now(), payload, ttlMs };

    writeFileSync(join(directory, `${key}.json`), JSON.stringify(entry), "utf8");
};

const fetchJson = async <T>(url: string, timeoutMs: number): Promise<T | undefined> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            headers: { Accept: "application/json", "User-Agent": "@visulima/vis" },
            signal: controller.signal,
        });

        if (!response.ok) {
            return undefined;
        }

        return (await response.json()) as T;
    } catch {
        return undefined;
    } finally {
        clearTimeout(timeout);
    }
};

const fetchVersion = async (name: string, version: string, timeoutMs: number, ttlMs: number): Promise<DepsDevVersionResponse | undefined> => {
    const directory = getCacheDirectory("versions");
    const key = buildCacheKey([name, version]);
    const cached = readCache<DepsDevVersionResponse>(directory, key);

    if (cached) {
        return cached;
    }

    const url = `${DEPS_DEV_API_BASE}/systems/npm/packages/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`;
    const result = await fetchJson<DepsDevVersionResponse>(url, timeoutMs);

    if (result) {
        writeCache(directory, key, result, ttlMs);
    }

    return result;
};

const fetchProject = async (projectId: string, timeoutMs: number, ttlMs: number): Promise<DepsDevProjectResponse | undefined> => {
    const directory = getCacheDirectory("projects");
    const key = buildCacheKey([projectId]);
    const cached = readCache<DepsDevProjectResponse>(directory, key);

    if (cached) {
        return cached;
    }

    const url = `${DEPS_DEV_API_BASE}/projects/${encodeURIComponent(projectId)}`;
    const result = await fetchJson<DepsDevProjectResponse>(url, timeoutMs);

    if (result) {
        writeCache(directory, key, result, ttlMs);
    }

    return result;
};

const fetchAdvisory = async (ghsaId: string, timeoutMs: number, ttlMs: number): Promise<DepsDevAdvisoryResponse | undefined> => {
    const directory = getCacheDirectory("advisories");
    const key = buildCacheKey([ghsaId]);
    const cached = readCache<DepsDevAdvisoryResponse>(directory, key);

    if (cached) {
        return cached;
    }

    const url = `${DEPS_DEV_API_BASE}/advisories/${encodeURIComponent(ghsaId)}`;
    const result = await fetchJson<DepsDevAdvisoryResponse>(url, timeoutMs);

    if (result) {
        writeCache(directory, key, result, ttlMs);
    }

    return result;
};

/** Normalises a Scorecard `checks[]` array into the Socket-shaped `PackageScore`. */
const scorecardToScore = (scorecard: NonNullable<DepsDevProjectResponse["scorecard"]> | undefined): PackageReportData["score"] => {
    const buckets: Record<"license" | "maintenance" | "quality" | "supplyChain" | "vulnerability", number[]> = {
        license: [],
        maintenance: [],
        quality: [],
        supplyChain: [],
        vulnerability: [],
    };

    if (scorecard?.checks) {
        for (const check of scorecard.checks) {
            // -1 means "not applicable" in Scorecard semantics — exclude from averages.
            if (check.score < 0) {
                continue;
            }

            const axis = SCORECARD_AXIS_MAP[check.name];

            if (axis) {
                buckets[axis].push(check.score / 10);
            }
        }
    }

    // Neutral 0.5 when an axis has no signal — same convention Socket.dev
    // uses when it lacks data for a check.
    const avg = (values: number[]): number => (values.length === 0 ? 0.5 : Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2)));

    const overall = scorecard?.overallScore === undefined ? Number(((avg(buckets.license) + avg(buckets.maintenance) + avg(buckets.quality) + avg(buckets.supplyChain) + avg(buckets.vulnerability)) / 5).toFixed(2)) : Number((scorecard.overallScore / 10).toFixed(2));

    return {
        license: avg(buckets.license),
        maintenance: avg(buckets.maintenance),
        overall,
        quality: avg(buckets.quality),
        supplyChain: avg(buckets.supplyChain),
        vulnerability: avg(buckets.vulnerability),
    };
};

/** Maps a CVSS v3 base score (0–10) to Socket's discrete severity bands. */
const cvssToSeverity = (cvss: number | undefined): PackageAlert["severity"] => {
    if (cvss === undefined) {
        return "medium";
    }

    if (cvss >= 9) {
        return "critical";
    }

    if (cvss >= 7) {
        return "high";
    }

    if (cvss >= 4) {
        return "medium";
    }

    return "low";
};

const advisoryToAlert = (ghsaId: string, advisory: DepsDevAdvisoryResponse | undefined, publishedAt: string | undefined): PackageAlert => {
    const cveAlias = advisory?.aliases?.find((a): a is `CVE-${string}` => a.startsWith("CVE-"));

    const alert: PackageAlert = {
        category: "vulnerability",
        key: ghsaId,
        severity: cvssToSeverity(advisory?.cvss3Score),
        type: "vulnerability",
    };

    if (cveAlias) {
        alert.props = { cveId: cveAlias, lastPublish: publishedAt ?? "" };
    } else if (publishedAt) {
        alert.props = { lastPublish: publishedAt };
    }

    return alert;
};

/** Picks the GitHub source-repo project id from a version's `relatedProjects[]`. */
const pickProjectId = (related: DepsDevVersionResponse["relatedProjects"]): string | undefined => {
    if (!related) {
        return undefined;
    }

    const sourceRepo = related.find((r) => r.relationType === "SOURCE_REPO" && r.projectKey?.id);

    return sourceRepo?.projectKey?.id ?? related.find((r) => r.projectKey?.id)?.projectKey?.id;
};

interface FetchDepsDevReportsOptions {
    advisoryCacheTtlMs?: number;
    projectCacheTtlMs?: number;
    timeoutMs?: number;
    versionCacheTtlMs?: number;
}

/**
 * Fetches deps.dev reports for the given packages. Returns a map keyed by
 * `"name@version"`, matching the shape returned by `fetchSocketReports`.
 *
 * Network failures degrade gracefully: a package whose version endpoint
 * fails simply doesn't appear in the result. A package whose Scorecard
 * lookup fails still appears with neutral scores + any resolvable advisories.
 */
export const fetchDepsDevReports = async (
    packages: { name: string; version: string }[],
    options: FetchDepsDevReportsOptions = {},
): Promise<Map<string, PackageReportData>> => {
    const results = new Map<string, PackageReportData>();

    if (packages.length === 0) {
        return results;
    }

    const {
        advisoryCacheTtlMs = DEFAULT_ADVISORY_TTL_MS,
        projectCacheTtlMs = DEFAULT_PROJECT_TTL_MS,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        versionCacheTtlMs = DEFAULT_VERSION_TTL_MS,
    } = options;

    // Step 1: fetch version data for every package (bounded parallelism).
    const versionResults = new Map<string, DepsDevVersionResponse>();
    const versionWork = [...packages];

    const versionWorker = async (): Promise<void> => {
        for (;;) {
            const pkg = versionWork.shift();

            if (!pkg) {
                return;
            }

            const v = await fetchVersion(pkg.name, pkg.version, timeoutMs, versionCacheTtlMs);

            if (v) {
                versionResults.set(`${pkg.name}@${pkg.version}`, v);
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_REQUESTS, packages.length) }, versionWorker));

    // Step 2: collect unique project + advisory ids needed.
    const projectIds = new Set<string>();
    const advisoryIds = new Set<string>();
    const projectByPackage = new Map<string, string | undefined>();

    for (const [key, version] of versionResults) {
        const projectId = pickProjectId(version.relatedProjects);

        projectByPackage.set(key, projectId);

        if (projectId) {
            projectIds.add(projectId);
        }

        for (const advisory of version.advisoryKeys ?? []) {
            advisoryIds.add(advisory.id);
        }
    }

    // Step 3: fan out project + advisory fetches in parallel (bounded).
    const projectResults = new Map<string, DepsDevProjectResponse | undefined>();
    const advisoryResults = new Map<string, DepsDevAdvisoryResponse | undefined>();

    const projectWork = [...projectIds];
    const advisoryWork = [...advisoryIds];

    const projectWorker = async (): Promise<void> => {
        for (;;) {
            const id = projectWork.shift();

            if (!id) {
                return;
            }

            projectResults.set(id, await fetchProject(id, timeoutMs, projectCacheTtlMs));
        }
    };

    const advisoryWorker = async (): Promise<void> => {
        for (;;) {
            const id = advisoryWork.shift();

            if (!id) {
                return;
            }

            advisoryResults.set(id, await fetchAdvisory(id, timeoutMs, advisoryCacheTtlMs));
        }
    };

    await Promise.all([
        ...Array.from({ length: Math.min(MAX_PARALLEL_REQUESTS, projectIds.size) }, projectWorker),
        ...Array.from({ length: Math.min(MAX_PARALLEL_REQUESTS, advisoryIds.size) }, advisoryWorker),
    ]);

    // Step 4: assemble reports.
    for (const pkg of packages) {
        const key = `${pkg.name}@${pkg.version}`;
        const version = versionResults.get(key);

        if (!version) {
            continue;
        }

        const projectId = projectByPackage.get(key);
        const project = projectId ? projectResults.get(projectId) : undefined;
        const score = scorecardToScore(project?.scorecard);

        const alerts: PackageAlert[] = (version.advisoryKeys ?? []).map((advisory) =>
            advisoryToAlert(advisory.id, advisoryResults.get(advisory.id), version.publishedAt),
        );

        // When unresolved advisories exist, knock the vulnerability axis
        // down — even if Scorecard says "Vulnerabilities: 10". The advisory
        // signal is more direct.
        if (alerts.length > 0) {
            const critOrHigh = alerts.some((a) => a.severity === "critical" || a.severity === "high");

            score.vulnerability = Math.min(score.vulnerability, critOrHigh ? 0.2 : 0.5);
            score.overall = Number(((score.license + score.maintenance + score.quality + score.supplyChain + score.vulnerability) / 5).toFixed(2));
        }

        const { versionKey } = version;
        const fullName = versionKey?.name ?? pkg.name;
        const namespace = fullName.startsWith("@") ? (fullName.slice(0, fullName.indexOf("/")) as `@${string}`) : undefined;
        const shortName = namespace ? fullName.slice(namespace.length + 1) : fullName;

        const report: PackageReportData = {
            alerts,
            author: [],
            id: `pkg:npm/${fullName}@${pkg.version}`,
            license: project?.license ?? version.licenses?.[0] ?? "",
            name: shortName,
            score,
            size: 0,
            type: "npm",
            version: pkg.version,
        };

        if (namespace) {
            report.namespace = namespace;
        }

        results.set(key, report);
    }

    return results;
};

const cacheDirectories = (): string[] => [getCacheDirectory("versions"), getCacheDirectory("projects"), getCacheDirectory("advisories")];

export const clearDepsDevCache = (): number => {
    let removed = 0;

    for (const dir of cacheDirectories()) {
        if (!isAccessibleSync(dir)) {
            continue;
        }

        const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

        for (const file of files) {
            rmSync(join(dir, file), { force: true });
            removed += 1;
        }
    }

    return removed;
};

export const getDepsDevCacheStats = (): SecurityProviderCacheStats => {
    let entries = 0;
    let totalSizeBytes = 0;
    let oldest: number | undefined;
    let newest: number | undefined;

    for (const dir of cacheDirectories()) {
        if (!isAccessibleSync(dir)) {
            continue;
        }

        for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
            const stat = statSync(join(dir, file));

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

/** Constructs a deps.dev `SecurityProvider` if the config has `enabled !== false`. */
export const createDepsDevProvider = (config: DepsDevConfig | undefined): SecurityProvider | undefined => {
    if (!config?.enabled) {
        return undefined;
    }

    const resolved: FetchDepsDevReportsOptions = {
        advisoryCacheTtlMs: config.advisoryCacheTtlMs,
        projectCacheTtlMs: config.projectCacheTtlMs,
        timeoutMs: config.timeoutMs,
        versionCacheTtlMs: config.versionCacheTtlMs,
    };

    return {
        clearCache: clearDepsDevCache,
        displayName: "deps.dev",
        fetchReports: (packages) => fetchDepsDevReports(packages, resolved),
        getCacheStats: getDepsDevCacheStats,
        id: "deps-dev",
    };
};

export type { DepsDevAdvisoryResponse, DepsDevConfig, DepsDevProjectResponse, DepsDevVersionResponse };

export { advisoryToAlert, cvssToSeverity, scorecardToScore };
