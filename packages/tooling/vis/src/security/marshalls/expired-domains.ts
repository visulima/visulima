/**
 * Expired-email-domain marshall.
 *
 * Resolves each maintainer's email domain via DNS NS lookup. NXDOMAIN /
 * ENOTFOUND means the domain has been let lapse — a classic precursor to
 * account hijack, since a fresh registration plus npm password-reset email
 * is enough to take over the package.
 *
 * Per-domain results cache to disk for 24h. Transient failures (timeout,
 * ECONNREFUSED) degrade silently to a warning and are NOT cached.
 */

import { createHash } from "node:crypto";
import { Resolver } from "node:dns/promises";
import { readdirSync, rmSync, writeFileSync } from "node:fs";

import { ensureDirSync, isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { getVisCacheDir } from "../../util/vis-paths";
import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "./concurrency";
import type { PackumentMaintainer } from "./packument";
import { getPackument } from "./packument";
import { isMarshallDisabled } from "./registry";

export interface ExpiredDomainFinding {
    domain: string;
    /** "unresolved" → could not verify, "expired" → NXDOMAIN / ENOTFOUND. */
    kind: "expired" | "unresolved";
    maintainer: string;
    packageName: string;
    severity: "error" | "warning";
}

export interface RunExpiredDomainsMarshallOptions {
    allowDomains?: string[];
    allowlist?: string[];
    cacheTtlMs?: number;
    /** Max packages inspected in parallel. Defaults to {@link DEFAULT_MARSHALL_CONCURRENCY}. */
    concurrency?: number;
    /** Inject a resolver for tests. */
    createResolver?: () => Pick<Resolver, "resolveNs" | "setServers">;
    dnsServers?: string[];
    perDomainTimeoutMs?: number;
    signal?: AbortSignal;
    workspaceRoot?: string;
}

interface DomainCacheEntry {
    createdAt: number;
    /** "ok" → domain resolves; "expired" → confirmed NXDOMAIN/ENOTFOUND. */
    outcome: "expired" | "ok";
    ttlMs: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PER_DOMAIN_TIMEOUT_MS = 4000;
const DEFAULT_DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];

const getExpiredDomainsCacheDir = (): string => join(getVisCacheDir(), "expired-domains");

const cacheFilePath = (domain: string): string => {
    const hash = createHash("sha256").update(domain).digest("hex").slice(0, 12);

    return join(getExpiredDomainsCacheDir(), `${hash}.json`);
};

const readCachedDomain = (domain: string): DomainCacheEntry | undefined => {
    const filePath = cacheFilePath(domain);

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    try {
        const entry = readJsonSync(filePath) as unknown as DomainCacheEntry;

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

const writeCachedDomain = (domain: string, outcome: DomainCacheEntry["outcome"], ttlMs: number): void => {
    ensureDirSync(getExpiredDomainsCacheDir());

    const entry: DomainCacheEntry = { createdAt: Date.now(), outcome, ttlMs };

    writeFileSync(cacheFilePath(domain), JSON.stringify(entry), "utf8");
};

const extractDomain = (email: string | undefined): string | undefined => {
    if (typeof email !== "string") {
        return undefined;
    }

    const atIndex = email.lastIndexOf("@");

    if (atIndex === -1 || atIndex === email.length - 1) {
        return undefined;
    }

    const domain = email.slice(atIndex + 1).trim().toLowerCase();

    return domain === "" ? undefined : domain;
};

const collectMaintainers = (maintainers: PackumentMaintainer[] | undefined, npmUser: PackumentMaintainer | undefined): PackumentMaintainer[] => {
    const out: PackumentMaintainer[] = [];

    if (npmUser !== undefined) {
        out.push(npmUser);
    }

    for (const maintainer of maintainers ?? []) {
        out.push(maintainer);
    }

    return out;
};

interface ResolveOutcome {
    kind: "expired" | "ok" | "transient-error";
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    let timer: NodeJS.Timeout | undefined;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => { reject(new Error("ETIMEDOUT")); }, timeoutMs);
            }),
        ]);
    } finally {
        if (timer !== undefined) {
            clearTimeout(timer);
        }
    }
};

const isExpiredError = (error: unknown): boolean => {
    if (error === null || typeof error !== "object") {
        return false;
    }

    const { code } = (error as { code?: string });

    return code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN";
};

const resolveDomain = async (
    resolver: Pick<Resolver, "resolveNs">,
    domain: string,
    timeoutMs: number,
): Promise<ResolveOutcome> => {
    try {
        const records = await withTimeout(resolver.resolveNs(domain), timeoutMs);

        if (Array.isArray(records) && records.length > 0) {
            return { kind: "ok" };
        }

        return { kind: "expired" };
    } catch (error: unknown) {
        if (isExpiredError(error)) {
            return { kind: "expired" };
        }

        return { kind: "transient-error" };
    }
};

const resolveLatestVersion = (versions: string[], latestTag: string | undefined): string | undefined => {
    if (latestTag !== undefined && versions.includes(latestTag)) {
        return latestTag;
    }

    return versions.at(-1);
};

export const runExpiredDomainsMarshall = async (
    packages: { name: string; version: string }[],
    options: RunExpiredDomainsMarshallOptions = {},
): Promise<ExpiredDomainFinding[]> => {
    if (isMarshallDisabled("expiredDomains")) {
        return [];
    }

    const allowlist = new Set(options.allowlist);
    const allowDomains = new Set((options.allowDomains ?? []).map((domain) => domain.toLowerCase()));
    const ttlMs = options.cacheTtlMs ?? DEFAULT_TTL_MS;
    const timeoutMs = options.perDomainTimeoutMs ?? DEFAULT_PER_DOMAIN_TIMEOUT_MS;
    const servers = options.dnsServers ?? DEFAULT_DNS_SERVERS;
    const concurrency = options.concurrency ?? DEFAULT_MARSHALL_CONCURRENCY;

    const resolver = options.createResolver === undefined ? new Resolver() : options.createResolver();

    if (typeof resolver.setServers === "function") {
        resolver.setServers(servers);
    }

    // Cross-package promise dedup: when packages A and B share a maintainer
    // domain we want exactly one DNS lookup, even when both run in parallel.
    const domainPromises = new Map<string, Promise<ResolveOutcome>>();

    const resolveDomainOnce = async (domain: string): Promise<ResolveOutcome> => {
        let inFlight = domainPromises.get(domain);

        if (inFlight === undefined) {
            inFlight = (async (): Promise<ResolveOutcome> => {
                const cached = readCachedDomain(domain);

                if (cached !== undefined) {
                    return { kind: cached.outcome === "ok" ? "ok" : "expired" };
                }

                const outcome = await resolveDomain(resolver, domain, timeoutMs);

                if (outcome.kind !== "transient-error") {
                    writeCachedDomain(domain, outcome.kind, ttlMs);
                }

                return outcome;
            })();

            domainPromises.set(domain, inFlight);
        }

        return inFlight;
    };

    const perPackage = await mapWithConcurrency(packages, concurrency, async ({ name, version }): Promise<ExpiredDomainFinding[]> => {
        if (allowlist.has(name)) {
            return [];
        }

        const packument = await getPackument(name, { workspaceRoot: options.workspaceRoot });

        if (packument === undefined) {
            return [];
        }

        const entry = packument.versions[version]
            ?? packument.versions[resolveLatestVersion(Object.keys(packument.versions), packument["dist-tags"]?.latest) ?? ""];

        if (entry === undefined) {
            return [];
        }

        const maintainers = collectMaintainers(entry.maintainers, entry._npmUser);
        const seenDomainsForPackage = new Set<string>();
        const localFindings: ExpiredDomainFinding[] = [];

        for (const maintainer of maintainers) {
            const domain = extractDomain(maintainer.email);

            if (domain === undefined || allowDomains.has(domain)) {
                continue;
            }

            // Dedup so a single bad domain doesn't fan out N findings per package.
            const dedupKey = `${domain}:${maintainer.email ?? ""}`;

            if (seenDomainsForPackage.has(dedupKey)) {
                continue;
            }

            seenDomainsForPackage.add(dedupKey);

            const outcome = await resolveDomainOnce(domain);

            if (outcome.kind === "expired") {
                localFindings.push({
                    domain,
                    kind: "expired",
                    maintainer: maintainer.email ?? "",
                    packageName: name,
                    severity: "error",
                });
            } else if (outcome.kind === "transient-error") {
                localFindings.push({
                    domain,
                    kind: "unresolved",
                    maintainer: maintainer.email ?? "",
                    packageName: name,
                    severity: "warning",
                });
            }
        }

        return localFindings;
    });

    return perPackage.flat();
};

/**
 * Drop every cached domain record. Returns the number of files removed.
 * Used by `vis cache clean --expired-domains`.
 */
export const clearExpiredDomainsCache = (): number => {
    const directory = getExpiredDomainsCacheDir();

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
