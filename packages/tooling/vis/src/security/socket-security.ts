/**
 * Socket.dev security helpers for package security intelligence.
 *
 * Ported from `@vltpkg/security-archive` and adapted to use the Socket.dev
 * public API for fetching package security scores, alerts, and report data.
 * Uses a file-based cache (following the ai-cache.ts pattern) with a 1-hour TTL.
 * @see https://socket.dev
 * @see https://github.com/vltpkg/vltpkg/tree/main/src/security-archive
 */

import { readdirSync, rmSync, statSync, writeFileSync } from "node:fs";

import { ensureDirSync, isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { getVisCacheDir } from "../util/vis-paths";

// ── Constants ───────────────────────────────────────────────────────

const SOCKET_API_V0_URL = "https://api.socket.dev/v0/purl?alerts=true";

const getCacheDirectory = (): string => join(getVisCacheDir(), "socket-security");
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_LOW_SCORE_THRESHOLD = 0.4;
const MAX_BATCH_SIZE = 100;

// ── Types ───────────────────────────────────────────────────────────

/** Extra properties attached to a package alert. */
interface PackageAlertProps {
    cveId?: `CVE-${string}`;
    cwes?: { id: `CWE-${string}` }[];
    lastPublish: string;
}

/** A known security alert for a given package. */
interface PackageAlert {
    category: string;
    key: string;
    props?: PackageAlertProps;
    severity: "critical" | "high" | "low" | "medium";
    type: string;
}

/** Security scores for a given package (each 0–1). */
interface PackageScore {
    /** Score factors relating to package licensing. */
    license: number;
    /** Score factors relating to package maintenance. */
    maintenance: number;
    /** Average of all score factors. */
    overall: number;
    /** Score factors relating to code quality. */
    quality: number;
    /** Score factors relating to supply chain security. */
    supplyChain: number;
    /** Score factors relating to package vulnerabilities. */
    vulnerability: number;
}

/** Full report data for a single package from Socket.dev. */
interface PackageReportData {
    alerts: PackageAlert[];
    author: string[];
    id: string;
    license: string;
    name: string;
    namespace?: `@${string}`;
    score: PackageScore;
    size: number;
    type: "npm";
    version: string;
}

/** Configuration options for the Socket.dev security client. */
interface SocketSecurityOptions {
    /** Custom API token. Required — set via VIS_SOCKET_TOKEN env var or config. */
    apiToken?: string;
    /** Cache TTL in milliseconds. Defaults to 1 hour. */
    cacheTtlMs?: number;
    /** Minimum overall score (0–1) below which packages are flagged. Defaults to 0.4. */
    minimumScore?: number;
    /** Request timeout in milliseconds. Defaults to 15 seconds. */
    timeoutMs?: number;
}

/** Raw NDJSON item from the Socket.dev API response. */
interface SocketApiItem {
    alerts: PackageAlert[];
    author: string[];
    id: string;
    license: string;
    name: string;
    namespace?: string;
    score: Omit<PackageScore, "overall"> & { overall?: number };
    size: number;
    type: string;
    version: string;
}

interface CacheEntry {
    createdAt: number;
    report: PackageReportData;
    ttlMs: number;
}

// ── Type guards ─────────────────────────────────────────────────────

const isPackageReportData = (o: unknown): o is PackageReportData =>
    typeof o === "object"
    && o !== null
    && "id" in o
    && "type" in o
    && "name" in o
    && "version" in o
    && "alerts" in o
    && "score" in o
    && (o as Record<string, unknown>).type === "npm";

// ── Cache helpers (file-based, matching ai-cache.ts pattern) ────────

const ensureCacheDirectory = (): void => {
    ensureDirSync(getCacheDirectory());
};

const buildCacheKey = (name: string, version: string): string => `${encodeURIComponent(name)}@${encodeURIComponent(version)}`;

const getCachedReport = (name: string, version: string): PackageReportData | undefined => {
    const key = buildCacheKey(name, version);
    const filePath = join(getCacheDirectory(), `${key}.json`);

    try {
        const entry = readJsonSync(filePath) as unknown as CacheEntry;

        if (Date.now() - entry.createdAt > entry.ttlMs) {
            rmSync(filePath, { force: true });

            return undefined;
        }

        return entry.report;
    } catch {
        // File doesn't exist, is corrupt, or was removed — ignore

        return undefined;
    }
};

const setCachedReport = (name: string, version: string, report: PackageReportData, ttlMs: number): void => {
    const key = buildCacheKey(name, version);
    const entry: CacheEntry = {
        createdAt: Date.now(),
        report,
        ttlMs,
    };

    writeFileSync(join(getCacheDirectory(), `${key}.json`), JSON.stringify(entry), "utf8");
};

// ── Score calculation ───────────────────────────────────────────────

const calculateOverallScore = (score: Omit<PackageScore, "overall">): number => {
    const components = [score.license, score.maintenance, score.quality, score.supplyChain, score.vulnerability];

    return Number((components.reduce((sum, s) => sum + s, 0) / components.length).toFixed(2));
};

// ── API client ──────────────────────────────────────────────────────

/**
 * Fetches security report data from the Socket.dev API for the given packages.
 * Batches requests to stay within API limits.
 * @param packages Array of { name, version } to look up.
 * @param options Optional configuration.
 * @returns Map of "name@version" to PackageReportData.
 */
const fetchSocketReports = async (
    packages: { name: string; version: string }[],
    options: SocketSecurityOptions = {},
): Promise<Map<string, PackageReportData>> => {
    const { apiToken, cacheTtlMs = DEFAULT_TTL_MS, timeoutMs = 15_000 } = options;

    const results = new Map<string, PackageReportData>();

    if (packages.length === 0) {
        return results;
    }

    if (!apiToken) {
        return results;
    }

    // Check cache first, collect uncached packages
    const uncached: { name: string; version: string }[] = [];

    for (const pkg of packages) {
        const cached = getCachedReport(pkg.name, pkg.version);

        if (cached) {
            results.set(`${pkg.name}@${pkg.version}`, cached);
        } else {
            uncached.push(pkg);
        }
    }

    if (uncached.length === 0) {
        return results;
    }

    // Pre-compute auth header and ensure cache dir exists before batch loop
    const authHeader = `Basic ${Buffer.from(`${apiToken}:`).toString("base64")}`;

    ensureCacheDirectory();

    // Batch uncached packages into groups of MAX_BATCH_SIZE
    const batches: { name: string; version: string }[][] = [];

    for (let index = 0; index < uncached.length; index += MAX_BATCH_SIZE) {
        batches.push(uncached.slice(index, index + MAX_BATCH_SIZE));
    }

    for (const batch of batches) {
        const components = batch.map((pkg) => {
            return {
                purl: `pkg:npm/${pkg.name}@${pkg.version}`,
            };
        });

        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, timeoutMs);

        try {
            const response = await fetch(SOCKET_API_V0_URL, {
                body: JSON.stringify({ components }),
                headers: {
                    Authorization: authHeader,
                    "Content-Type": "application/json",
                    "User-Agent": "@visulima/vis",
                },
                method: "POST",
                signal: controller.signal,
            });

            if (!response.ok) {
                continue;
            }

            const text = await response.text();

            parseNdjsonResponse(text, batch, results, cacheTtlMs);
        } catch {
            // Graceful degradation: skip failed batches
        } finally {
            clearTimeout(timeout);
        }
    }

    return results;
};

/**
 * Parses the NDJSON response from Socket.dev API and populates the results map.
 */
const parseNdjsonResponse = (text: string, batch: { name: string; version: string }[], results: Map<string, PackageReportData>, cacheTtlMs: number): void => {
    // Build lookup map for matching responses back to requests
    const lookupMap = new Map<string, { name: string; version: string }>();

    for (const pkg of batch) {
        lookupMap.set(`${pkg.name}@${pkg.version}`, pkg);
    }

    // Socket.dev returns NDJSON where each line is a JSON object ending with "}\n".
    // Split on "}\n" and re-append the brace for parsing. Malformed lines are skipped.
    const lines = text.split("}\n");

    for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
            continue;
        }

        try {
            const data = JSON.parse(trimmed.endsWith("}") ? trimmed : `${trimmed}}`) as SocketApiItem;

            const scope = data.namespace ? `${data.namespace}/` : "";
            const fullName = `${scope}${data.name}`;
            const key = `${fullName}@${data.version}`;

            if (!lookupMap.has(key)) {
                continue;
            }

            // Calculate average score
            const overall = data.score.overall ?? calculateOverallScore(data.score);

            const reportData: PackageReportData = {
                alerts: data.alerts,
                author: data.author,
                id: data.id,
                license: data.license,
                name: data.name,
                score: { ...data.score, overall },
                size: data.size,
                type: "npm",
                version: data.version,
            };

            if (data.namespace) {
                reportData.namespace = data.namespace as `@${string}`;
            }

            if (isPackageReportData(reportData)) {
                results.set(key, reportData);
                setCachedReport(fullName, data.version, reportData, cacheTtlMs);
            }
        } catch {
            // Skip malformed lines
        }
    }
};

// ── Name helpers ────────────────────────────────────────────────────

/** Returns the full package name including namespace scope if present. */
const getFullPackageName = (report: Pick<PackageReportData, "name" | "namespace">): string =>
    (report.namespace ? `${report.namespace}/${report.name}` : report.name);

// ── Display helpers ─────────────────────────────────────────────────

/** Maps a 0–1 score to a human-readable label. */
const scoreLabel = (score: number): string => {
    if (score >= 0.8) {
        return "excellent";
    }

    if (score >= 0.6) {
        return "good";
    }

    if (score >= 0.4) {
        return "fair";
    }

    if (score >= 0.2) {
        return "poor";
    }

    return "critical";
};

/** Maps a 0–1 score to a color name for terminal output. */
const scoreColor = (score: number): "green" | "red" | "yellow" => {
    if (score >= 0.6) {
        return "green";
    }

    if (score >= 0.4) {
        return "yellow";
    }

    return "red";
};

/** Formats a PackageReportData into a compact one-line summary string. */
const formatReportSummary = (report: PackageReportData): string => {
    const name = getFullPackageName(report);
    const score = `score: ${String(Math.round(report.score.overall * 100))}%`;
    const alertCount = report.alerts.length;
    const alertSummary = alertCount > 0 ? `${String(alertCount)} alert${alertCount === 1 ? "" : "s"}` : "no alerts";

    return `${name}@${report.version} (${score}, ${alertSummary})`;
};

/** Formats a detailed multi-line report for a single package. */
const formatReportDetailed = (report: PackageReportData): string => {
    const name = getFullPackageName(report);
    const lines: string[] = [
        `${name}@${report.version}`,
        `  License: ${report.license || "unknown"}`,
        `  Overall Score: ${String(Math.round(report.score.overall * 100))}% (${scoreLabel(report.score.overall)})`,
        `    Supply Chain: ${String(Math.round(report.score.supplyChain * 100))}%`,
        `    Quality:      ${String(Math.round(report.score.quality * 100))}%`,
        `    Maintenance:  ${String(Math.round(report.score.maintenance * 100))}%`,
        `    Vulnerability: ${String(Math.round(report.score.vulnerability * 100))}%`,
        `    License:      ${String(Math.round(report.score.license * 100))}%`,
    ];

    if (report.alerts.length > 0) {
        lines.push(`  Alerts (${String(report.alerts.length)}):`);

        for (const alert of report.alerts) {
            const cve = alert.props?.cveId ? ` (${alert.props.cveId})` : "";

            lines.push(`    [${alert.severity.toUpperCase()}] ${alert.type}${cve} — ${alert.category}`);
        }
    }

    return lines.join("\n");
};

/**
 * Formats a security summary for a list of packages.
 * Suitable for displaying after install/update commands.
 */
const formatSecurityOverview = (reports: Map<string, PackageReportData>): string => {
    if (reports.size === 0) {
        return "";
    }

    let totalAlerts = 0;
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let lowScorePackages = 0;

    for (const report of reports.values()) {
        for (const alert of report.alerts) {
            totalAlerts++;

            switch (alert.severity) {
                case "critical": {
                    criticalCount++;
                    break;
                }

                case "high": {
                    highCount++;
                    break;
                }

                case "medium": {
                    mediumCount++;
                    break;
                }

                default: {
                    lowCount++;
                }
            }
        }

        if (report.score.overall < DEFAULT_LOW_SCORE_THRESHOLD) {
            lowScorePackages++;
        }
    }

    const lines: string[] = [`Socket.dev: scanned ${String(reports.size)} package${reports.size === 1 ? "" : "s"}`];

    if (totalAlerts > 0) {
        const parts: string[] = [];

        if (criticalCount > 0) {
            parts.push(`${String(criticalCount)} critical`);
        }

        if (highCount > 0) {
            parts.push(`${String(highCount)} high`);
        }

        if (mediumCount > 0) {
            parts.push(`${String(mediumCount)} medium`);
        }

        if (lowCount > 0) {
            parts.push(`${String(lowCount)} low`);
        }

        lines.push(`  Alerts: ${String(totalAlerts)} total (${parts.join(", ")})`);
    } else {
        lines.push("  No security alerts found.");
    }

    if (lowScorePackages > 0) {
        lines.push(`  ${String(lowScorePackages)} package${lowScorePackages === 1 ? "" : "s"} with low security score (<40%)`);
    }

    return lines.join("\n");
};

// ── Cache management ────────────────────────────────────────────────

const clearSocketCache = (): number => {
    const cacheDirectory = getCacheDirectory();

    if (!isAccessibleSync(cacheDirectory)) {
        return 0;
    }

    const files = readdirSync(cacheDirectory).filter((f) => f.endsWith(".json"));

    for (const file of files) {
        rmSync(join(cacheDirectory, file), { force: true });
    }

    return files.length;
};

interface SocketCacheStats {
    entries: number;
    newestEntry: number | undefined;
    oldestEntry: number | undefined;
    totalSizeBytes: number;
}

const getSocketCacheStats = (): SocketCacheStats => {
    const cacheDirectory = getCacheDirectory();

    if (!isAccessibleSync(cacheDirectory)) {
        return { entries: 0, newestEntry: undefined, oldestEntry: undefined, totalSizeBytes: 0 };
    }

    const files = readdirSync(cacheDirectory).filter((f) => f.endsWith(".json"));

    let totalSizeBytes = 0;
    let oldest: number | undefined;
    let newest: number | undefined;

    for (const file of files) {
        const stat = statSync(join(cacheDirectory, file));

        totalSizeBytes += stat.size;

        const { mtimeMs } = stat;

        if (oldest === undefined || mtimeMs < oldest) {
            oldest = mtimeMs;
        }

        if (newest === undefined || mtimeMs > newest) {
            newest = mtimeMs;
        }
    }

    return { entries: files.length, newestEntry: newest, oldestEntry: oldest, totalSizeBytes };
};

/** Socket.dev config shape as it appears in VisConfig.security.socket. */
interface SocketConfigLike {
    apiToken?: string;
    cacheTtlMs?: number;
    enabled?: boolean;
    minimumScore?: number;
    timeoutMs?: number;
}

/**
 * Builds SocketSecurityOptions from the VisConfig socket config section.
 * Returns undefined if Socket.dev is not enabled or no API token is available.
 */
const buildSocketOptions = (socketConfig: SocketConfigLike | undefined): SocketSecurityOptions | undefined => {
    if (!socketConfig?.enabled) {
        return undefined;
    }

    const apiToken = socketConfig.apiToken ?? process.env.VIS_SOCKET_TOKEN;

    return {
        apiToken,
        cacheTtlMs: socketConfig.cacheTtlMs,
        minimumScore: socketConfig.minimumScore,
        timeoutMs: socketConfig.timeoutMs,
    };
};

// ── Accepted risks ──────────────────────────────────────────────────

/** A persisted "accepted risk" entry from the vis config. */
interface AcceptedRisk {
    /** ISO 8601 timestamp when the risk was accepted. */
    acceptedAt: string;
    /** The overall Socket.dev score at the time of acceptance. */
    acceptedScore: number;
    /** User-provided reason for accepting the risk. */
    reason: string;
}

/**
 * Checks if a package has an accepted risk entry.
 * Matches by exact name@version, unversioned name, or trailing glob patterns.
 * Returns the matching AcceptedRisk if found, undefined otherwise.
 */
const findAcceptedRisk = (packageName: string, version: string, acceptedRisks: Record<string, AcceptedRisk> | undefined): AcceptedRisk | undefined => {
    if (!acceptedRisks) {
        return undefined;
    }

    // Check exact name@version, then unversioned name
    const versionedKey = `${packageName}@${version}`;

    if (acceptedRisks[versionedKey]) {
        return acceptedRisks[versionedKey];
    }

    if (acceptedRisks[packageName]) {
        return acceptedRisks[packageName];
    }

    // Check glob patterns (e.g., "@myorg/*")
    for (const [pattern, risk] of Object.entries(acceptedRisks)) {
        if (pattern.endsWith("*") && packageName.startsWith(pattern.slice(0, -1))) {
            return risk;
        }
    }

    return undefined;
};

/**
 * Formats a config snippet for the user to paste into vis.config.ts
 * to persist an accepted risk decision.
 */
const formatAcceptedRiskSnippet = (packageName: string, _version: string, score: number, reason: string): string => {
    const key = `"${packageName}"`;
    const lines = [
        `    // Add to security.socket.acceptedRisks in vis.config.ts:`,
        `    ${key}: {`,
        `      reason: "${reason}",`,
        `      acceptedAt: "${new Date().toISOString()}",`,
        `      acceptedScore: ${String(score)},`,
        `    },`,
    ];

    return lines.join("\n");
};

export type { AcceptedRisk, PackageAlert, PackageAlertProps, PackageReportData, PackageScore, SocketSecurityOptions };

export {
    buildSocketOptions,
    calculateOverallScore,
    clearSocketCache,
    DEFAULT_LOW_SCORE_THRESHOLD,
    fetchSocketReports,
    findAcceptedRisk,
    formatAcceptedRiskSnippet,
    formatReportDetailed,
    formatReportSummary,
    formatSecurityOverview,
    getFullPackageName,
    getSocketCacheStats,
    isPackageReportData,
    scoreColor,
    scoreLabel,
};
