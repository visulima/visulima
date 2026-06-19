/**
 * Gather the data shown in the dlx first-run panel: install footprint, a
 * security score + alerts, declared permissions, and a changelog.
 *
 * Everything is best-effort and time-boxed. A missing Socket token, an
 * offline registry, or a slow CDN never aborts the run — each field simply
 * degrades to "unknown" and the panel notes what couldn't be fetched.
 */

import type { Packument } from "../security/marshalls/packument";
import { getPackument, resolveVersionRange } from "../security/marshalls/packument";
import type { PackageAlert, PackageReportData } from "../security/socket-security";
import { calculateOverallScore, DEFAULT_LOW_SCORE_THRESHOLD, fetchSocketReports } from "../security/socket-security";
import type { ChangelogResult } from "./changelog";
import { fetchChangelog } from "./changelog";

export interface PackageSizeInfo {
    /** Number of files in the published tarball, when known. */
    fileCount?: number;
    /** Tarball (download) size in bytes, when known. */
    tarballBytes?: number;
    /** Unpacked install footprint in bytes, when known. */
    unpackedBytes?: number;
}

export interface PackageSecurityInfo {
    /** All alerts from the security provider. */
    alerts: PackageAlert[];
    /** True when a security token was present and a report was fetched. */
    available: boolean;
    /** Stable keys of high/critical alerts — the re-prompt fingerprint. */
    highSeverityKeys: string[];
    /** Overall score scaled to 0–100, or undefined when no provider answered. */
    score?: number;
}

export interface PackagePermissions {
    /** Bin names the package installs onto PATH. */
    bins: string[];
    /** Capability labels derived from security alerts (network, filesystem, …). */
    capabilities: string[];
    /** Lifecycle script hooks present in the published manifest. */
    lifecycleScripts: string[];
}

export interface PackageInfo {
    changelog?: ChangelogResult;
    name: string;
    permissions: PackagePermissions;
    security: PackageSecurityInfo;
    size: PackageSizeInfo;
    /** The concrete version the spec resolved to. */
    version: string;
}

/** Socket alert `type` → friendly capability label. */
const CAPABILITY_LABELS: Record<string, string> = {
    dynamicRequire: "dynamic require",
    envVars: "env access",
    filesystemAccess: "filesystem",
    networkAccess: "network",
    shellAccess: "shell",
    telemetry: "telemetry",
    unsafe: "eval/unsafe",
    usesEval: "eval/unsafe",
};

const LIFECYCLE_HOOKS = ["preinstall", "install", "postinstall"] as const;

const deriveSize = (versionEntry: Packument["versions"][string] | undefined, report: PackageReportData | undefined): PackageSizeInfo => {
    return {
        fileCount: versionEntry?.dist?.fileCount,
        tarballBytes: report?.size,
        unpackedBytes: versionEntry?.dist?.unpackedSize,
    };
};

const derivePermissions = (versionEntry: Packument["versions"][string] | undefined, alerts: ReadonlyArray<PackageAlert>): PackagePermissions => {
    const lifecycleScripts = LIFECYCLE_HOOKS.filter((hook) => Boolean(versionEntry?.scripts?.[hook]));

    const bin = versionEntry?.bin;
    const bins = typeof bin === "string" ? ["(default)"] : Object.keys(bin ?? {});

    const capabilities = [...new Set(alerts.map((alert) => CAPABILITY_LABELS[alert.type]).filter((label): label is string => label !== undefined))];

    return { bins, capabilities, lifecycleScripts };
};

/** Resolve the report for the single package we requested, regardless of map key encoding. */
const firstReport = (reports: Map<string, PackageReportData>): PackageReportData | undefined => {
    for (const value of reports.values()) {
        return value;
    }

    return undefined;
};

export interface GatherPackageInfoOptions {
    /** Bare package name (no version spec). */
    name: string;
    now: number;
    /** Skip all network enrichment (offline mode) — resolve from cache only where possible. */
    offline?: boolean;
    signal?: AbortSignal;
    /** Socket.dev API token, when configured. */
    socketToken?: string;
    /** The version spec as typed (e.g. `5`, `^5.2`, `next`, or undefined for latest). */
    spec?: string;
    workspaceRoot?: string;
}

/**
 * Fetch and normalize everything the panel needs. Returns undefined only when
 * the package cannot be resolved at all (e.g. 404 / offline with no cache).
 */
export const gatherPackageInfo = async (options: GatherPackageInfoOptions): Promise<PackageInfo | undefined> => {
    const { name, now, offline, signal, socketToken, spec, workspaceRoot } = options;

    let packument: Packument | undefined;

    try {
        packument = await getPackument(name, { signal, workspaceRoot });
    } catch {
        packument = undefined;
    }

    const version = packument ? resolveVersionRange(packument, spec) : undefined;

    if (!version) {
        return undefined;
    }

    const versionEntry = packument?.versions[version];

    // Security + changelog run concurrently; both degrade independently.
    const fetchSecurity = async (): Promise<PackageReportData | undefined> => {
        if (offline || !socketToken) {
            return undefined;
        }

        try {
            const reports = await fetchSocketReports([{ name, version }], { apiToken: socketToken, minimumScore: DEFAULT_LOW_SCORE_THRESHOLD });

            return firstReport(reports);
        } catch {
            return undefined;
        }
    };

    const changelogPromise: Promise<ChangelogResult | undefined> = fetchChangelog({ name, now, offline, packument, signal, version }).catch(() => undefined);

    const [report, changelog] = await Promise.all([fetchSecurity(), changelogPromise]);

    const alerts = report?.alerts ?? [];
    const highSeverityKeys = alerts
        .filter((alert) => alert.severity === "critical" || alert.severity === "high")
        .map((alert) => alert.key)
        .sort();

    const score = report ? Math.round((report.score.overall ?? calculateOverallScore(report.score)) * 100) : undefined;

    return {
        changelog,
        name,
        permissions: derivePermissions(versionEntry, alerts),
        security: {
            alerts,
            available: Boolean(report),
            highSeverityKeys,
            score,
        },
        size: deriveSize(versionEntry, report),
        version,
    };
};
