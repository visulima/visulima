/**
 * Pre-install marshall pipeline used by `vis add` / `vis install` / `vis update`.
 *
 * Each handler typically:
 *
 *   1. runs the typosquat marshall (its own UX, not part of this pipeline)
 *   2. resolves explicit `&lt;name>[@&lt;spec>]` args to concrete `{name, version}`
 *   3. calls {@link runMarshallPipeline} with that list
 *   4. routes the resulting {@link MarshallFindings} through `presentMarshallDecision`
 *
 * Marshalls fan out **in parallel** after a single packument prefetch
 * pass. Within each marshall, per-package work also runs with bounded
 * concurrency. Every marshall is independent — one transient failure
 * (e.g. downloads endpoint 503) only suppresses *its* finding; everything
 * else keeps running. Each marshall guards its own env-var disable via
 * `isMarshallDisabled`, so callers don't need to gate them individually.
 */

import { runArchivedRepoMarshall } from "./archived-repo";
import type { AuthorFinding } from "./author";
import { runAuthorMarshall } from "./author";
import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "./concurrency";
import type { DeprecationFinding } from "./deprecation";
import { runDeprecationMarshall } from "./deprecation";
import type { DownloadFinding } from "./downloads";
import { runDownloadsMarshall } from "./downloads";
import type { ExpiredDomainFinding } from "./expired-domains";
import { runExpiredDomainsMarshall } from "./expired-domains";
import type { MarshallFinding } from "./findings";
import { MarshallFindings } from "./findings";
import type { MetadataFinding } from "./metadata";
import { runMetadataMarshall } from "./metadata";
import type { NewBinFinding } from "./new-bin";
import { runNewBinMarshall } from "./new-bin";
import type { PackageAgeFinding } from "./package-age";
import { runPackageAgeMarshall } from "./package-age";
import { getPackument } from "./packument";
import type { ProvenanceFinding } from "./provenance";
import { runProvenanceMarshall } from "./provenance";
import type { S1ngularityFinding } from "./s1ngularity";
import { runS1ngularityMarshall } from "./s1ngularity";
import type { SignatureFinding } from "./signatures";
import { runSignatureMarshall } from "./signatures";

/**
 * Per-marshall configuration block carried from `vis.config.ts`. Every
 * marshall is enabled by default — set `enabled: false` to skip without
 * setting an env var.
 */
export interface MarshallPipelineConfig {
    archivedRepo?: { allowlist?: string[]; enabled?: boolean; githubToken?: string };
    author?: {
        allowlist?: string[];
        dormantErrorDays?: number;
        dormantWarnDays?: number;
        enabled?: boolean;
        newPublisherWindowDays?: number;
        recentVersionErrorDays?: number;
        recentVersionWarnDays?: number;
    };
    deprecation?: { allowlist?: string[]; enabled?: boolean };
    downloads?: { allowlist?: string[]; enabled?: boolean; errorThreshold?: number; warnThreshold?: number };
    expiredDomains?: { allowDomains?: string[]; allowlist?: string[]; dnsServers?: string[]; enabled?: boolean; timeoutMs?: number };
    metadata?: { allowlist?: string[]; checks?: ("license" | "readme" | "repo")[]; enabled?: boolean };
    newBin?: { allowlist?: string[]; enabled?: boolean };
    packageAge?: { allowlist?: string[]; enabled?: boolean; newPackageDays?: number; unmaintainedDays?: number };
    provenance?: { allowlist?: string[]; enabled?: boolean };
    s1ngularity?: { allowlist?: string[]; enabled?: boolean };
    signatures?: { allowlist?: string[]; enabled?: boolean; keysUrl?: string; treatExpiredAs?: "error" | "warning" };
}

export interface RunMarshallPipelineOptions {
    /** Override per-marshall concurrency. Defaults to {@link DEFAULT_MARSHALL_CONCURRENCY}. */
    concurrency?: number;
    config?: MarshallPipelineConfig;
    signal?: AbortSignal;
    workspaceRoot?: string;
}

const formatAuthorFinding = (finding: AuthorFinding): MarshallFinding => {
    return {
        marshall: "author",
        message: finding.message,
        packageName: finding.packageName,
        severity: finding.severity,
    };
};

const formatProvenanceFinding = (finding: ProvenanceFinding): MarshallFinding => {
    return {
        marshall: "provenance",
        message: `Prior version ${finding.priorVersionWithProvenance} had provenance but ${finding.version} does not.`,
        packageName: finding.packageName,
        severity: "error",
        suggestedAction: `Investigate why ${finding.version} dropped sigstore attestations.`,
    };
};

const formatS1ngularityFinding = (finding: S1ngularityFinding): MarshallFinding => {
    const hooks = finding.hookChanges.map((change) => `${change.hook} (${change.kind})`).join(", ");

    return {
        marshall: "s1ngularity",
        message: `${finding.version} ${finding.hookChanges.length === 1 ? "has an" : "has"} install-script ${finding.hookChanges.length === 1 ? "change" : "changes"} [${hooks}] AND dropped the provenance attestation that ${finding.priorVersion} carried — this is the s1ngularity compromised-publish shape.`,
        packageName: finding.packageName,
        severity: "error",
        suggestedAction: `Do not install ${finding.packageName}@${finding.version}. Verify the publish against the project's release CI; pin to ${finding.priorVersion} until confirmed. Allowlist via security.marshalls.s1ngularity.allowlist only if the conjunction is explained.`,
    };
};

const formatDeprecationFinding = (finding: DeprecationFinding): MarshallFinding => {
    return {
        marshall: "deprecation",
        message: `${finding.packageName}@${finding.version} is deprecated: ${finding.reason}`,
        packageName: finding.packageName,
        severity: "error",
        suggestedAction: `Migrate off ${finding.packageName} or add it to security.marshalls.deprecation.allowlist if the deprecation is acceptable.`,
    };
};

const formatPackageAgeFinding = (finding: PackageAgeFinding): MarshallFinding => {
    return {
        marshall: "packageAge",
        message:
            finding.kind === "new-package"
                ? `Package first published ${String(finding.days)} day${finding.days === 1 ? "" : "s"} ago — brand-new package names are a common typosquat/dependency-confusion signature.`
                : `No new release in ${String(finding.days)} days — package may be unmaintained.`,
        packageName: finding.packageName,
        severity: finding.severity,
    };
};

const formatNewBinFinding = (finding: NewBinFinding): MarshallFinding => {
    const list = finding.newBins.map((bin) => bin.command).join(", ");

    return {
        marshall: "newBin",
        message: `${finding.toVersion} adds new bin script${finding.newBins.length === 1 ? "" : "s"}: ${list} (prior: ${finding.fromVersion}).`,
        packageName: finding.packageName,
        severity: "warning",
    };
};

const formatMetadataFinding = (finding: MetadataFinding): MarshallFinding => {
    return {
        marshall: "metadata",
        message: `Missing/invalid metadata: ${finding.issues.join(", ")}.`,
        packageName: finding.packageName,
        severity: "warning",
    };
};

const formatDownloadsFinding = (finding: DownloadFinding): MarshallFinding => {
    if (finding.kind === "no-data") {
        return {
            marshall: "downloads",
            message: "npm stats API returned no monthly download data.",
            packageName: finding.packageName,
            severity: finding.severity,
        };
    }

    return {
        marshall: "downloads",
        message: `Only ${String(finding.downloadsLastMonth ?? 0)} downloads in the past month.`,
        packageName: finding.packageName,
        severity: finding.severity,
    };
};

const formatExpiredDomainsFinding = (finding: ExpiredDomainFinding): MarshallFinding => {
    return {
        marshall: "expiredDomains",
        message:
            finding.kind === "expired"
                ? `Maintainer email domain ${finding.domain} (${finding.maintainer}) is unregistered — potential hijack risk.`
                : `Could not verify maintainer email domain ${finding.domain} (${finding.maintainer}).`,
        packageName: finding.packageName,
        severity: finding.severity,
    };
};

const formatSignatureFinding = (finding: SignatureFinding): MarshallFinding => {
    return {
        marshall: "signatures",
        message: finding.message,
        packageName: finding.packageName,
        severity: finding.severity,
    };
};

const formatArchivedRepoFinding = (finding: {
    archivedAt?: string;
    kind: "archived" | "missing-repo";
    owner: string;
    packageName: string;
    repo: string;
}): MarshallFinding => {
    return {
        marshall: "archivedRepo",
        message:
            finding.kind === "archived"
                ? `Source repo ${finding.owner}/${finding.repo} is archived${finding.archivedAt === undefined ? "" : ` (since ${finding.archivedAt})`}.`
                : `Source repo ${finding.owner}/${finding.repo} returned 404 from GitHub.`,
        packageName: finding.packageName,
        severity: "warning",
    };
};

/**
 * Marshalls that read through {@link getPackument}. When every entry here
 * is disabled we skip the prefetch entirely — no point warming a cache
 * nobody will read.
 */
const PACKUMENT_READERS = [
    "author",
    "provenance",
    "s1ngularity",
    "newBin",
    "metadata",
    "deprecation",
    "packageAge",
    "expiredDomains",
    "signatures",
    "archivedRepo",
] as const satisfies ReadonlyArray<keyof MarshallPipelineConfig>;

const anyPackumentReaderEnabled = (config: MarshallPipelineConfig): boolean =>
    PACKUMENT_READERS.some((name) => {
        if (name === "signatures") {
            // Signatures is opt-in (default off) — only counts when explicitly enabled.
            return config.signatures?.enabled === true;
        }

        return config[name]?.enabled !== false;
    });

/**
 * Warm the shared packument cache once before marshalls fan out.
 *
 * Seven of eight marshalls call {@link getPackument} for the same set of
 * names; without prefetch the first marshall pays the cold latency for
 * everyone. We swallow errors here because each marshall surfaces its own
 * finding when it observes the cache miss — duplicating the failure at
 * the pipeline layer would just produce noise.
 */
const prefetchPackuments = async (
    packages: { name: string }[],
    concurrency: number,
    workspaceRoot: string | undefined,
    signal: AbortSignal | undefined,
): Promise<void> => {
    const names = [...new Set(packages.map((entry) => entry.name))];

    await mapWithConcurrency(names, concurrency, async (name) => {
        try {
            await getPackument(name, { signal, workspaceRoot });
        } catch {
            // Per-marshall finding will cover the failure.
        }
    });
};

/**
 * Execute every pre-install marshall against `packages` and return a
 * unified {@link MarshallFindings} accumulator. Marshalls whose config
 * sets `enabled: false` are skipped at the pipeline layer (the env-var
 * gate inside each marshall still applies regardless).
 *
 * Network/transport errors inside a single marshall surface as that
 * marshall's own finding (typically a warning) — they never propagate
 * out of this function.
 */
export const runMarshallPipeline = async (
    packages: { name: string; version: string }[],
    options: RunMarshallPipelineOptions = {},
): Promise<MarshallFindings> => {
    const findings = new MarshallFindings();

    if (packages.length === 0) {
        return findings;
    }

    const config = options.config ?? {};
    const names = packages.map((entry) => entry.name);
    const sharedSignal = options.signal;
    const concurrency = options.concurrency ?? DEFAULT_MARSHALL_CONCURRENCY;

    if (anyPackumentReaderEnabled(config)) {
        await prefetchPackuments(packages, concurrency, options.workspaceRoot, sharedSignal);
    }

    // Each enabled marshall writes its formatted findings into a fixed
    // slot. We concat in slot order at the end so the output sequence is
    // independent of which marshall happens to finish first — critical for
    // stable `--json` output and snapshot tests.
    const slots: MarshallFinding[][] = [];
    const tasks: Promise<void>[] = [];

    const schedule = (factory: () => Promise<MarshallFinding[]>): void => {
        const slot = slots.length;

        slots.push([]);
        tasks.push(
            (async () => {
                slots[slot] = await factory();
            })(),
        );
    };

    if (config.author?.enabled !== false) {
        schedule(async () => {
            const results = await runAuthorMarshall(packages, {
                allowlist: config.author?.allowlist,
                concurrency,
                signal: sharedSignal,
                thresholds: {
                    dormantErrorDays: config.author?.dormantErrorDays,
                    dormantWarnDays: config.author?.dormantWarnDays,
                    newPublisherWindowDays: config.author?.newPublisherWindowDays,
                    recentVersionErrorDays: config.author?.recentVersionErrorDays,
                    recentVersionWarnDays: config.author?.recentVersionWarnDays,
                },
                workspaceRoot: options.workspaceRoot,
            });

            return results.map((finding) => formatAuthorFinding(finding));
        });
    }

    if (config.provenance?.enabled !== false) {
        schedule(async () => {
            const results = await runProvenanceMarshall(packages, {
                allowlist: config.provenance?.allowlist,
                concurrency,
                workspaceRoot: options.workspaceRoot,
            });

            return results.map((finding) => formatProvenanceFinding(finding));
        });
    }

    if (config.s1ngularity?.enabled !== false) {
        schedule(async () => {
            const results = await runS1ngularityMarshall(packages, {
                allowlist: config.s1ngularity?.allowlist,
                concurrency,
                workspaceRoot: options.workspaceRoot,
            });

            return results.map((finding) => formatS1ngularityFinding(finding));
        });
    }

    if (config.newBin?.enabled !== false) {
        schedule(async () => {
            const results = await runNewBinMarshall(packages, {
                allowlist: config.newBin?.allowlist,
                concurrency,
                workspaceRoot: options.workspaceRoot,
            });

            return results.map((finding) => formatNewBinFinding(finding));
        });
    }

    if (config.metadata?.enabled !== false) {
        schedule(async () => {
            const results = await runMetadataMarshall(packages, {
                allowlist: config.metadata?.allowlist,
                checks: config.metadata?.checks,
                concurrency,
                workspaceRoot: options.workspaceRoot,
            });

            return results.map((finding) => formatMetadataFinding(finding));
        });
    }

    if (config.deprecation?.enabled !== false) {
        schedule(async () => {
            const results = await runDeprecationMarshall(packages, {
                allowlist: config.deprecation?.allowlist,
                concurrency,
                workspaceRoot: options.workspaceRoot,
            });

            return results.map((finding) => formatDeprecationFinding(finding));
        });
    }

    if (config.packageAge?.enabled !== false) {
        schedule(async () => {
            const results = await runPackageAgeMarshall(packages, {
                allowlist: config.packageAge?.allowlist,
                concurrency,
                thresholds: {
                    newPackageDays: config.packageAge?.newPackageDays,
                    unmaintainedDays: config.packageAge?.unmaintainedDays,
                },
                workspaceRoot: options.workspaceRoot,
            });

            return results.map((finding) => formatPackageAgeFinding(finding));
        });
    }

    if (config.downloads?.enabled !== false) {
        schedule(async () => {
            const results = await runDownloadsMarshall(names, {
                allowlist: config.downloads?.allowlist,
                concurrency,
                errorThreshold: config.downloads?.errorThreshold,
                signal: sharedSignal,
                warnThreshold: config.downloads?.warnThreshold,
            });

            return results.map((finding) => formatDownloadsFinding(finding));
        });
    }

    if (config.expiredDomains?.enabled !== false) {
        schedule(async () => {
            const results = await runExpiredDomainsMarshall(packages, {
                allowDomains: config.expiredDomains?.allowDomains,
                allowlist: config.expiredDomains?.allowlist,
                concurrency,
                dnsServers: config.expiredDomains?.dnsServers,
                perDomainTimeoutMs: config.expiredDomains?.timeoutMs,
                signal: sharedSignal,
                workspaceRoot: options.workspaceRoot,
            });

            return results.map((finding) => formatExpiredDomainsFinding(finding));
        });
    }

    // Signatures: opt-in only — npm's signing keys + signature coverage
    // still have gaps that produce noisy warnings on legitimate packages,
    // so we default this marshall to off unless the user explicitly enables
    // it. Once npm's coverage stabilises this can flip.
    if (config.signatures?.enabled === true) {
        schedule(async () => {
            const results = await runSignatureMarshall(packages, {
                allowlist: config.signatures?.allowlist,
                concurrency,
                keysUrl: config.signatures?.keysUrl,
                signal: sharedSignal,
                treatExpiredAs: config.signatures?.treatExpiredAs,
                workspaceRoot: options.workspaceRoot,
            });

            return results.map((finding) => formatSignatureFinding(finding));
        });
    }

    if (config.archivedRepo?.enabled !== false) {
        schedule(async () => {
            const results = await runArchivedRepoMarshall(packages, {
                allowlist: config.archivedRepo?.allowlist,
                concurrency,
                githubToken: config.archivedRepo?.githubToken,
                signal: sharedSignal,
                workspaceRoot: options.workspaceRoot,
            });

            return results.map((finding) => formatArchivedRepoFinding(finding));
        });
    }

    await Promise.all(tasks);

    for (const slot of slots) {
        findings.addMany(slot);
    }

    return findings;
};
