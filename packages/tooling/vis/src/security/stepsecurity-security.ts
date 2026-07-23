/**
 * StepSecurity Threat Center security helpers.
 *
 * Fetches the set of *compromised OSS components* surfaced by StepSecurity's
 * Threat Center — the same supply-chain incident intelligence that powers the
 * dashboard (tj-actions, nx, the axios npm compromise, …) — and normalises it
 * to the shared `PackageReportData` shape so the registry can merge results.
 *
 * StepSecurity's data is *incident-scoped*: the Compromised Components API
 * returns every compromised component tied to a single incident. To answer the
 * provider-level question "is this `name@version` a known-compromised package?"
 * we aggregate the compromised components across every incident in the Threat
 * Center (or a configured subset) into one lookup, cache it on disk, then match
 * the resolved package set against it. A match emits a `critical` malware alert;
 * clean packages produce no report (StepSecurity has no signal for them).
 *
 * Two endpoints are involved, both on `https://api.stepsecurity.io`:
 *   1. `GET /github/{owner}/threat-intel/incidents`                                   – incident feed (ids)
 *   2. `GET /github/{owner}/threat-intel/incidents/{incidentId}/compromised-components` – components per incident
 *
 * Requires a GitHub owner/org + an API token (config or VIS_STEPSECURITY_OWNER /
 * VIS_STEPSECURITY_TOKEN). The Threat Center API is a StepSecurity Enterprise
 * feature. Network failures degrade gracefully — an unreachable Threat Center
 * simply contributes an empty map.
 * @see https://www.stepsecurity.io/blog/new-in-the-threat-center-compromised-components-now-available-via-api
 * @see https://docs.stepsecurity.io/oss-package-security/threat-center
 */

import { readdirSync, rmSync, statSync, writeFileSync } from "node:fs";

import { ensureDirSync, isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { getVisCacheDir } from "../util/vis-paths";
import type { PackageAlert, PackageReportData, SecurityProvider, SecurityProviderCacheStats } from "./provider";

const DEFAULT_API_BASE_URL = "https://api.stepsecurity.io";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour — the compromised set changes as new incidents land
const MAX_PARALLEL_REQUESTS = 6;
const MAX_INCIDENTS = 500;

const getCacheDirectory = (): string => join(getVisCacheDir(), "stepsecurity");

interface StepSecurityConfig {
    /** Override the StepSecurity API base URL. @default "https://api.stepsecurity.io" */
    apiBaseUrl?: string;
    /** StepSecurity API token. Set via VIS_STEPSECURITY_TOKEN or here. */
    apiToken?: string;
    /** Cache TTL in milliseconds for the aggregated compromised-component set. */
    cacheTtlMs?: number;
    /** Enable StepSecurity Threat Center scanning. @default false */
    enabled?: boolean;
    /**
     * Pin the lookup to a specific set of incident ids instead of fetching the
     * full incident feed. Useful for confirming exposure to a single known
     * incident without listing the whole Threat Center.
     */
    incidentIds?: string[];
    /** GitHub owner / organisation that owns the Threat Center. Set via VIS_STEPSECURITY_OWNER or here. */
    owner?: string;
    /** Request timeout in milliseconds. @default 15000 */
    timeoutMs?: number;
}

/** One compromised component as surfaced by the Threat Center, normalised. */
interface CompromisedComponent {
    /** Threat description / summary, when provided. */
    description?: string;
    /** Package ecosystem (`npm`, `pypi`, …) lowercased. */
    ecosystem: string;
    /** Incident this component belongs to. */
    incidentId: string;
    /** Package name (scope included for npm). */
    name: string;
    /** Severity reported by StepSecurity, lowercased. */
    severity?: string;
    /** Whether StepSecurity has verified the compromise. */
    verified?: boolean;
    /**
     * Affected versions. `undefined` / `["*"]` means "every version" — treat
     * the whole package as compromised.
     */
    versions?: string[];
}

interface CacheEntry {
    components: CompromisedComponent[];
    createdAt: number;
    ttlMs: number;
}

interface FetchStepSecurityReportsOptions {
    apiBaseUrl: string;
    apiToken: string;
    cacheTtlMs: number;
    incidentIds?: string[];
    owner: string;
    timeoutMs: number;
}

/** Cache key is per-owner — a token only ever sees its own org's Threat Center. */
const buildCacheKey = (owner: string): string => encodeURIComponent(owner);

const readCache = (owner: string): CompromisedComponent[] | undefined => {
    const filePath = join(getCacheDirectory(), `${buildCacheKey(owner)}.json`);

    try {
        const entry = readJsonSync(filePath) as unknown as CacheEntry;

        if (Date.now() - entry.createdAt > entry.ttlMs) {
            rmSync(filePath, { force: true });

            return undefined;
        }

        return entry.components;
    } catch {
        return undefined;
    }
};

const writeCache = (owner: string, components: CompromisedComponent[], ttlMs: number): void => {
    ensureDirSync(getCacheDirectory());

    const entry: CacheEntry = { components, createdAt: Date.now(), ttlMs };

    writeFileSync(join(getCacheDirectory(), `${buildCacheKey(owner)}.json`), JSON.stringify(entry), "utf8");
};

/** GETs a URL and parses JSON, returning `undefined` on any network / non-2xx failure. */
const fetchJson = async (url: string, apiToken: string, timeoutMs: number): Promise<unknown> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${apiToken}`,
                "User-Agent": "@visulima/vis",
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            return undefined;
        }

        return await response.json();
    } catch {
        return undefined;
    } finally {
        clearTimeout(timeout);
    }
};

/** Pull a string field from an object trying several candidate keys. */
const pickString = (object: Record<string, unknown>, keys: string[]): string | undefined => {
    for (const key of keys) {
        const value = object[key];

        if (typeof value === "string" && value.trim() !== "") {
            return value.trim();
        }
    }

    return undefined;
};

/**
 * Normalises a raw version field into a list of exact versions. Accepts a bare
 * string, a comma-separated string (`"4.17.21,4.17.20"`), or an array. Returns
 * `undefined` when the field signals "all versions" (`*` / empty / missing).
 */
const normaliseVersions = (raw: unknown): string[] | undefined => {
    const collected: string[] = [];

    const push = (value: unknown): void => {
        if (typeof value !== "string") {
            return;
        }

        for (const part of value.split(",")) {
            const trimmed = part.trim();

            if (trimmed !== "") {
                collected.push(trimmed);
            }
        }
    };

    if (Array.isArray(raw)) {
        for (const value of raw) {
            push(value);
        }
    } else {
        push(raw);
    }

    if (collected.length === 0 || collected.includes("*")) {
        return undefined;
    }

    return collected;
};

/**
 * Defensively normalises the incident-list response. The endpoint may return a
 * bare array, `{ incidents: [...] }`, or `{ data: [...] }`; ids may live under
 * `id`, `incidentId`, or `incident_id`.
 */
const extractIncidentIds = (payload: unknown): string[] => {
    const rows = Array.isArray(payload)
        ? payload
        : ((payload as { data?: unknown; incidents?: unknown } | undefined)?.incidents
            ?? (payload as { data?: unknown } | undefined)?.data);

    if (!Array.isArray(rows)) {
        return [];
    }

    const ids: string[] = [];

    for (const row of rows) {
        if (typeof row === "string") {
            ids.push(row);
        } else if (row && typeof row === "object") {
            const id = pickString(row as Record<string, unknown>, ["id", "incidentId", "incident_id"]);

            if (id) {
                ids.push(id);
            }
        }
    }

    return ids.slice(0, MAX_INCIDENTS);
};

/**
 * Defensively normalises a compromised-components response into the internal
 * shape. The endpoint may return a bare array or wrap it under
 * `components` / `compromisedComponents` / `data`.
 */
const extractComponents = (payload: unknown, incidentId: string): CompromisedComponent[] => {
    const rows = Array.isArray(payload)
        ? payload
        : ((payload as { compromisedComponents?: unknown; components?: unknown; data?: unknown } | undefined)?.components
            ?? (payload as { compromisedComponents?: unknown } | undefined)?.compromisedComponents
            ?? (payload as { data?: unknown } | undefined)?.data);

    if (!Array.isArray(rows)) {
        return [];
    }

    const components: CompromisedComponent[] = [];

    for (const row of rows) {
        if (!row || typeof row !== "object") {
            continue;
        }

        const record = row as Record<string, unknown>;
        const name = pickString(record, ["name", "packageName", "package", "component"]);

        if (!name) {
            continue;
        }

        const ecosystem = (pickString(record, ["ecosystem", "type", "packageEcosystem"]) ?? "npm").toLowerCase();
        const component: CompromisedComponent = {
            ecosystem,
            incidentId,
            name,
            versions: normaliseVersions(record.versions ?? record.version ?? record.affectedVersions),
        };

        const description = pickString(record, ["description", "threat", "summary"]);

        if (description) {
            component.description = description;
        }

        const severity = pickString(record, ["severity", "severityLevel"]);

        if (severity) {
            component.severity = severity.toLowerCase();
        }

        const verified = record.verified ?? record.isVerified;

        if (typeof verified === "boolean") {
            component.verified = verified;
        }

        components.push(component);
    }

    return components;
};

/**
 * Builds (or reads from cache) the aggregated set of compromised components for
 * the configured owner. Returns an empty array on any hard failure.
 */
const buildCompromisedSet = async (options: FetchStepSecurityReportsOptions): Promise<CompromisedComponent[]> => {
    const cached = readCache(options.owner);

    if (cached) {
        return cached;
    }

    const { apiBaseUrl, apiToken, cacheTtlMs, incidentIds, owner, timeoutMs } = options;
    const base = apiBaseUrl.replace(/\/+$/, "");
    const ownerSegment = encodeURIComponent(owner);

    let resolvedIncidentIds = incidentIds;

    if (!resolvedIncidentIds || resolvedIncidentIds.length === 0) {
        const listed = await fetchJson(`${base}/github/${ownerSegment}/threat-intel/incidents`, apiToken, timeoutMs);

        resolvedIncidentIds = extractIncidentIds(listed);
    }

    if (resolvedIncidentIds.length === 0) {
        return [];
    }

    const components: CompromisedComponent[] = [];
    const work = [...resolvedIncidentIds];

    const worker = async (): Promise<void> => {
        for (;;) {
            const incidentId = work.shift();

            if (incidentId === undefined) {
                return;
            }

            const payload = await fetchJson(
                `${base}/github/${ownerSegment}/threat-intel/incidents/${encodeURIComponent(incidentId)}/compromised-components`,
                apiToken,
                timeoutMs,
            );

            if (payload !== undefined) {
                components.push(...extractComponents(payload, incidentId));
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_REQUESTS, resolvedIncidentIds.length) }, worker));

    writeCache(owner, components, cacheTtlMs);

    return components;
};

const VALID_SEVERITIES = new Set<PackageAlert["severity"]>(["critical", "high", "low", "medium"]);

/** A compromised component is malware — default to `critical` when unscored. */
const componentSeverity = (component: CompromisedComponent): PackageAlert["severity"] => {
    if (component.severity && VALID_SEVERITIES.has(component.severity as PackageAlert["severity"])) {
        return component.severity as PackageAlert["severity"];
    }

    return "critical";
};

/** A known-compromised package: every axis crushed, malware alert attached. */
const buildReport = (name: string, version: string, components: CompromisedComponent[]): PackageReportData => {
    const alerts: PackageAlert[] = components.map((component) => {
        return {
            category: "supplyChainRisk",
            key: `stepsecurity:${component.incidentId}:${name}@${version}`,
            props: { lastPublish: "" },
            severity: componentSeverity(component),
            type: "malware",
        } satisfies PackageAlert;
    });

    const namespace = name.startsWith("@") ? (name.slice(0, name.indexOf("/")) as `@${string}`) : undefined;
    const shortName = namespace ? name.slice(namespace.length + 1) : name;

    const report: PackageReportData = {
        alerts,
        author: [],
        id: `pkg:npm/${name}@${version}`,
        license: "",
        name: shortName,
        score: { license: 0.5, maintenance: 0.5, overall: 0, quality: 0.5, supplyChain: 0, vulnerability: 0 },
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
 * Fetches StepSecurity Threat Center reports for the given packages. Returns a
 * map keyed by `"name@version"`, matching the shape returned by the other
 * providers. Only *compromised* packages appear in the result — StepSecurity
 * carries no signal for clean packages.
 */
export const fetchStepSecurityReports = async (
    packages: { name: string; version: string }[],
    options: FetchStepSecurityReportsOptions,
): Promise<Map<string, PackageReportData>> => {
    const results = new Map<string, PackageReportData>();

    if (packages.length === 0) {
        return results;
    }

    const components = await buildCompromisedSet(options);

    if (components.length === 0) {
        return results;
    }

    // Index npm components by lowercased name for O(1) lookup per package.
    const byName = new Map<string, CompromisedComponent[]>();

    for (const component of components) {
        if (component.ecosystem !== "npm") {
            continue;
        }

        const key = component.name.toLowerCase();
        const bucket = byName.get(key);

        if (bucket) {
            bucket.push(component);
        } else {
            byName.set(key, [component]);
        }
    }

    for (const pkg of packages) {
        const candidates = byName.get(pkg.name.toLowerCase());

        if (!candidates) {
            continue;
        }

        // A component matches when it has no version constraint (whole package
        // compromised) or explicitly lists the resolved version.
        const matched = candidates.filter((component) => component.versions === undefined || component.versions.includes(pkg.version));

        if (matched.length > 0) {
            results.set(`${pkg.name}@${pkg.version}`, buildReport(pkg.name, pkg.version, matched));
        }
    }

    return results;
};

export const clearStepSecurityCache = (): number => {
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

export const getStepSecurityCacheStats = (): SecurityProviderCacheStats => {
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
 * Constructs a StepSecurity `SecurityProvider` if the config is enabled and both
 * an owner and an API token are resolvable (config or VIS_STEPSECURITY_OWNER /
 * VIS_STEPSECURITY_TOKEN). Returns `undefined` otherwise so the registry skips it.
 */
export const createStepSecurityProvider = (config: StepSecurityConfig | undefined): SecurityProvider | undefined => {
    if (!config?.enabled) {
        return undefined;
    }

    const apiToken = config.apiToken ?? process.env.VIS_STEPSECURITY_TOKEN;
    const owner = config.owner ?? process.env.VIS_STEPSECURITY_OWNER;

    if (!apiToken || !owner) {
        return undefined;
    }

    const resolved: FetchStepSecurityReportsOptions = {
        apiBaseUrl: config.apiBaseUrl ?? DEFAULT_API_BASE_URL,
        apiToken,
        cacheTtlMs: config.cacheTtlMs ?? DEFAULT_TTL_MS,
        incidentIds: config.incidentIds,
        owner,
        timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };

    return {
        clearCache: clearStepSecurityCache,
        displayName: "StepSecurity",
        fetchReports: (packages) => fetchStepSecurityReports(packages, resolved),
        getCacheStats: getStepSecurityCacheStats,
        id: "step-security",
    };
};

export type { CompromisedComponent, StepSecurityConfig };

export { buildReport, componentSeverity, extractComponents, extractIncidentIds, normaliseVersions };
