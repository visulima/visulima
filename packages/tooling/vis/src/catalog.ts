import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { boxen } from "@visulima/boxen";
import { join } from "@visulima/path";
import { createTable } from "@visulima/tabular";

// --- Module-level regex constants (e18e/prefer-static-regex) ---

// sonarjs/slow-regex -- constrained by input format; not actually vulnerable
// eslint-disable-next-line sonarjs/slow-regex
const VERSION_REGEX = /(\d+)\.(\d+)\.(\d+)(?:-([a-z0-9.]+))?/i;
const PREFIX_REGEX = /^([\^~]|>=|<=|[><=])/;
// sonarjs/regex-complexity -- cannot simplify without breaking YAML key:value parsing
// eslint-disable-next-line sonarjs/regex-complexity
const YAML_ENTRY_REGEX = /^(?:'([^']+)'|"([^"]+)"|([^:\s]+)):\s*(?:'([^']+)'|"([^"]+)"|(\S+))/;
const CATALOG_SECTION_REGEX = /^catalog:/m;
const CATALOGS_SECTION_REGEX = /^catalogs:/m;
const SCOPE_REGISTRY_REGEX = /^(@[^:]+):registry$/;
const AUTH_TOKEN_REGEX = /^\/\/(.+)\/:_authToken$/;
const CONSECUTIVE_WILDCARDS_REGEX = /\*+/g;
const GLOB_SPECIAL_CHARS_REGEX = /[.+^${}()|[\]\\]/g;
const REGEX_SPECIAL_CHARS_REGEX = /[.*+?^${}()|[\]\\]/g;
const QUOTES_TRIM_REGEX = /^['"]|['"]$/g;
const REGISTRY_PROTOCOL_REGEX = /^https?:\/\//;
const TRAILING_SLASH_REGEX = /\/$/;
const JSON_INDENT_REGEX = /\n(\s+)/;

// --- Types ---

type UpdateTarget = "latest" | "minor" | "patch";

interface ParsedVersion {
    major: number;
    minor: number;
    patch: number;
    prerelease: string;
}

interface SecurityVulnerability {
    cvssScore?: number;
    fixedVersions: string[];
    id: string;
    severity: "CRITICAL" | "HIGH" | "LOW" | "MODERATE" | "UNKNOWN";
    summary: string;
}

interface OutdatedEntry {
    catalogName: string;
    currentRange: string;
    newRange: string;
    packageName: string;
    targetVersion: string;
    updateType: "major" | "minor" | "patch";
    vulnerabilities?: SecurityVulnerability[];
}

interface CatalogCheckOptions {
    exclude: string[];
    include: string[];
    includePrerelease: boolean;
    security?: boolean;
    target: UpdateTarget;
}

// --- Version utilities ---

const parseVersion = (input: string): ParsedVersion | undefined => {
    const match = VERSION_REGEX.exec(input);

    if (!match) {
        return undefined;
    }

    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: match[4] ?? "",
    };
};

const extractPrefix = (range: string): string => {
    const match = PREFIX_REGEX.exec(range);

    return match ? match[1] : "";
};

const getUpdateType = (current: ParsedVersion, target: ParsedVersion): "major" | "minor" | "none" | "patch" => {
    if (current.major !== target.major) {
        return "major";
    }

    if (current.minor !== target.minor) {
        return "minor";
    }

    if (current.patch !== target.patch) {
        return "patch";
    }

    return "none";
};

const isNewer = (current: ParsedVersion, target: ParsedVersion): boolean => {
    if (target.major !== current.major) {
        return target.major > current.major;
    }

    if (target.minor !== current.minor) {
        return target.minor > current.minor;
    }

    if (target.patch !== current.patch) {
        return target.patch > current.patch;
    }

    // Equal versions: non-prerelease is "newer" than prerelease
    if (current.prerelease && !target.prerelease) {
        return true;
    }

    // Both prereleases of same version: compare lexicographically
    if (current.prerelease && target.prerelease) {
        return target.prerelease > current.prerelease;
    }

    return false;
};

// --- Glob matching ---

const matchesPattern = (name: string, pattern: string): boolean => {
    // Collapse consecutive wildcards to prevent ReDoS, then convert glob to regex
    const collapsed = pattern.replaceAll(CONSECUTIVE_WILDCARDS_REGEX, "*");
    const escaped = collapsed.replaceAll(GLOB_SPECIAL_CHARS_REGEX, String.raw`\$&`);
    const regex = new RegExp(`^${escaped.replaceAll("*", ".*").replaceAll("?", ".")}$`);

    return regex.test(name);
};

const matchesFilters = (name: string, include: string[], exclude: string[]): boolean => {
    if (exclude.some((p) => matchesPattern(name, p))) {
        return false;
    }

    if (include.length > 0) {
        return include.some((p) => matchesPattern(name, p));
    }

    return true;
};

// --- YAML parsing ---

const parseYamlEntry = (trimmed: string): [string, string] | undefined => {
    const match = YAML_ENTRY_REGEX.exec(trimmed);

    if (!match) {
        return undefined;
    }

    const key = match[1] ?? match[2] ?? match[3];
    const value = match[4] ?? match[5] ?? match[6];

    if (!key || !value) {
        return undefined;
    }

    return [key, value];
};

// --- parseCatalogsFromYaml helpers (sonarjs/cognitive-complexity) ---

const setCatalogEntry = (catalogs: Map<string, Map<string, string>>, catalogName: string, key: string, value: string): void => {
    if (!catalogs.has(catalogName)) {
        catalogs.set(catalogName, new Map());
    }

    const catalog = catalogs.get(catalogName);

    if (catalog) {
        catalog.set(key, value);
    }
};

const parseCatalogSection = (catalogs: Map<string, Map<string, string>>, trimmed: string, indent: number): void => {
    if (indent < 2) {
        return;
    }

    const entry = parseYamlEntry(trimmed);

    if (entry) {
        setCatalogEntry(catalogs, "default", entry[0], entry[1]);
    }
};

const parseCatalogsSection = (catalogs: Map<string, Map<string, string>>, trimmed: string, indent: number, currentCatalogName: string): string => {
    if (indent === 2 && trimmed.endsWith(":")) {
        return trimmed.slice(0, -1).trim().replaceAll(QUOTES_TRIM_REGEX, "");
    }

    if (indent >= 4 && currentCatalogName) {
        const entry = parseYamlEntry(trimmed);

        if (entry) {
            setCatalogEntry(catalogs, currentCatalogName, entry[0], entry[1]);
        }
    }

    return currentCatalogName;
};

type YamlSection = "catalog" | "catalogs" | "none";

const detectTopLevelSection = (trimmed: string): YamlSection => {
    if (trimmed === "catalog:" || trimmed.startsWith("catalog:")) {
        return "catalog";
    }

    if (trimmed === "catalogs:" || trimmed.startsWith("catalogs:")) {
        return "catalogs";
    }

    return "none";
};

const parseCatalogsFromYaml = (content: string): Map<string, Map<string, string>> => {
    const catalogs = new Map<string, Map<string, string>>();

    let section: "catalog" | "catalogs" | "none" = "none";
    let currentCatalogName = "";

    for (const line of content.split("\n")) {
        const trimmed = line.trimStart();
        const indent = line.length - trimmed.length;

        // Top-level keys (indent 0)
        if (indent === 0 && trimmed.length > 0 && !trimmed.startsWith("#")) {
            section = detectTopLevelSection(trimmed);

            if (section === "catalogs") {
                currentCatalogName = "";
            }

            continue;
        }

        if (trimmed.length === 0 || trimmed.startsWith("#")) {
            continue;
        }

        if (section === "catalog") {
            parseCatalogSection(catalogs, trimmed, indent);
        }

        if (section === "catalogs") {
            currentCatalogName = parseCatalogsSection(catalogs, trimmed, indent, currentCatalogName);
        }
    }

    return catalogs;
};

// --- Catalog reading: pnpm ---

const hasPnpmCatalogs = (workspaceRoot: string): boolean => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!existsSync(filePath)) {
        return false;
    }

    const content = readFileSync(filePath, "utf8");

    return CATALOG_SECTION_REGEX.test(content) || CATALOGS_SECTION_REGEX.test(content);
};

const readPnpmCatalogs = (workspaceRoot: string): Map<string, Map<string, string>> => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!existsSync(filePath)) {
        return new Map();
    }

    const content = readFileSync(filePath, "utf8");

    return parseCatalogsFromYaml(content);
};

// --- Catalog reading: bun ---

interface BunPackageJson {
    workspaces?: {
        catalog?: Record<string, string>;
        catalogs?: Record<string, Record<string, string>>;
        packages?: string[];
    };
}

const readPackageJson = (filePath: string): BunPackageJson | undefined => {
    if (!existsSync(filePath)) {
        return undefined;
    }

    try {
        return JSON.parse(readFileSync(filePath, "utf8")) as BunPackageJson;
    } catch {
        return undefined;
    }
};

const hasBunCatalogs = (workspaceRoot: string): boolean => {
    const pkg = readPackageJson(join(workspaceRoot, "package.json"));

    return !!(pkg?.workspaces?.catalog || pkg?.workspaces?.catalogs);
};

const parseBunCatalogs = (pkg: BunPackageJson): Map<string, Map<string, string>> => {
    const catalogs = new Map<string, Map<string, string>>();

    if (pkg.workspaces?.catalog && typeof pkg.workspaces.catalog === "object") {
        catalogs.set("default", new Map(Object.entries(pkg.workspaces.catalog)));
    }

    if (pkg.workspaces?.catalogs && typeof pkg.workspaces.catalogs === "object") {
        for (const [name, deps] of Object.entries(pkg.workspaces.catalogs)) {
            if (typeof deps === "object" && deps !== undefined) {
                catalogs.set(name, new Map(Object.entries(deps)));
            }
        }
    }

    return catalogs;
};

const readBunCatalogs = (workspaceRoot: string): Map<string, Map<string, string>> => {
    const pkg = readPackageJson(join(workspaceRoot, "package.json"));

    if (!pkg) {
        return new Map();
    }

    return parseBunCatalogs(pkg);
};

// --- Unified catalog API ---

type CatalogProvider = "bun" | "pnpm";

const hasCatalogs = (workspaceRoot: string, packageManager?: string): boolean => {
    if (packageManager === "bun") {
        return hasBunCatalogs(workspaceRoot);
    }

    return hasPnpmCatalogs(workspaceRoot);
};

const readCatalogs = (workspaceRoot: string, packageManager?: string): Map<string, Map<string, string>> => {
    if (packageManager === "bun") {
        return readBunCatalogs(workspaceRoot);
    }

    return readPnpmCatalogs(workspaceRoot);
};

// --- .npmrc support ---

interface NpmrcConfig {
    authTokens: Map<string, string>;
    defaultRegistry: string;
    registries: Map<string, string>;
}

const parseNpmrc = (content: string): NpmrcConfig => {
    const registries = new Map<string, string>();
    const authTokens = new Map<string, string>();
    let defaultRegistry = "https://registry.npmjs.org";

    for (const line of content.split("\n")) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
            continue;
        }

        const eqIndex = trimmed.indexOf("=");

        if (eqIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();

        // @scope:registry=url
        const scopeMatch = SCOPE_REGISTRY_REGEX.exec(key);

        if (scopeMatch) {
            registries.set(scopeMatch[1], value);
            continue;
        }

        // registry=url (default)
        if (key === "registry") {
            defaultRegistry = value;
            continue;
        }

        // //registry.url/:_authToken=token
        const authMatch = AUTH_TOKEN_REGEX.exec(key);

        if (authMatch) {
            authTokens.set(authMatch[1], value);
        }
    }

    return { authTokens, defaultRegistry, registries };
};

const mergeNpmrcConfigs = (base: NpmrcConfig, override: NpmrcConfig): NpmrcConfig => {
    const merged: NpmrcConfig = {
        authTokens: new Map([...base.authTokens, ...override.authTokens]),
        defaultRegistry: override.defaultRegistry === "https://registry.npmjs.org" ? base.defaultRegistry : override.defaultRegistry,
        registries: new Map([...base.registries, ...override.registries]),
    };

    return merged;
};

const loadNpmrc = (workspaceRoot: string): NpmrcConfig => {
    const empty: NpmrcConfig = { authTokens: new Map(), defaultRegistry: "https://registry.npmjs.org", registries: new Map() };

    // Load user-level ~/.npmrc first (lower precedence)
    const homeDirectory = process.env.HOME ?? process.env.USERPROFILE ?? "";
    const userNpmrc = join(homeDirectory, ".npmrc");
    let config = homeDirectory && existsSync(userNpmrc) ? parseNpmrc(readFileSync(userNpmrc, "utf8")) : empty;

    // Merge project-level .npmrc on top (higher precedence)
    const projectNpmrc = join(workspaceRoot, ".npmrc");

    if (existsSync(projectNpmrc)) {
        config = mergeNpmrcConfigs(config, parseNpmrc(readFileSync(projectNpmrc, "utf8")));
    }

    return config;
};

const getRegistryForPackage = (packageName: string, config: NpmrcConfig): { token?: string; url: string } => {
    let registryUrl = config.defaultRegistry;

    if (packageName.startsWith("@")) {
        const scope = packageName.split("/")[0];

        if (scope && config.registries.has(scope)) {
            const scopeRegistry = config.registries.get(scope);

            if (scopeRegistry) {
                registryUrl = scopeRegistry;
            }
        }
    }

    // Find auth token
    const registryHost = registryUrl.replace(REGISTRY_PROTOCOL_REGEX, "").replace(TRAILING_SLASH_REGEX, "");
    const token = config.authTokens.get(registryHost);

    return { token, url: registryUrl };
};

// --- Registry ---

interface RegistryVersionInfo {
    latest: string;
    versions: string[];
}

const DEFAULT_FETCH_TIMEOUT = 15_000;

const fetchPackageVersions = async (
    packageName: string,
    registryConfig?: { authToken?: string; url: string },
    timeoutMs: number = DEFAULT_FETCH_TIMEOUT,
): Promise<RegistryVersionInfo> => {
    const baseUrl = (registryConfig?.url ?? "https://registry.npmjs.org").replace(TRAILING_SLASH_REGEX, "");
    const url = `${baseUrl}/${packageName}`;

    const headers: Record<string, string> = { Accept: "application/vnd.npm.install-v1+json" };

    if (registryConfig?.authToken) {
        headers["Authorization"] = `Bearer ${registryConfig.authToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- fetch is available in Node 20.19+ via undici
        const response = await fetch(url, { headers, signal: controller.signal });

        if (!response.ok) {
            throw new Error(`Failed to fetch ${packageName}: ${String(response.status)} ${response.statusText}`);
        }

        const data = (await response.json()) as { "dist-tags"?: Record<string, string>; versions?: Record<string, unknown> };

        return {
            latest: data["dist-tags"]?.["latest"] ?? "",
            versions: Object.keys(data.versions ?? {}),
        };
    } finally {
        clearTimeout(timeout);
    }
};

// --- Security: OSV.dev API ---

interface OsvVuln {
    affected?: {
        ranges?: {
            events?: { fixed?: string; introduced?: string }[];
        }[];
    }[];
    aliases?: string[];
    database_specific?: { severity?: string };
    id: string;
    severity?: { score?: string; type?: string }[];
    summary?: string;
}

interface OsvBatchResponse {
    results: { vulns?: OsvVuln[] }[];
}

const mapOsvSeverity = (vuln: OsvVuln): "CRITICAL" | "HIGH" | "LOW" | "MODERATE" | "UNKNOWN" => {
    // Try database_specific.severity first
    const databaseSeverity = vuln.database_specific?.severity?.toUpperCase();

    if (databaseSeverity === "CRITICAL" || databaseSeverity === "HIGH" || databaseSeverity === "MODERATE" || databaseSeverity === "LOW") {
        return databaseSeverity;
    }

    // Try CVSS score
    const cvss = vuln.severity?.find((s) => s.type === "CVSS_V3")?.score;

    if (cvss) {
        const score = Number.parseFloat(cvss);

        if (score >= 9) {
            return "CRITICAL";
        }

        if (score >= 7) {
            return "HIGH";
        }

        if (score >= 4) {
            return "MODERATE";
        }

        return "LOW";
    }

    return "UNKNOWN";
};

const mapOsvCvss = (vuln: OsvVuln): number | undefined => {
    const cvss = vuln.severity?.find((s) => s.type === "CVSS_V3")?.score;

    return cvss ? Number.parseFloat(cvss) : undefined;
};

const mapOsvFixedVersions = (vuln: OsvVuln): string[] => {
    const fixed: string[] = [];

    for (const affected of vuln.affected ?? []) {
        for (const range of affected.ranges ?? []) {
            for (const event of range.events ?? []) {
                if (event.fixed) {
                    fixed.push(event.fixed);
                }
            }
        }
    }

    return fixed;
};

const mapOsvVuln = (vuln: OsvVuln): SecurityVulnerability => {
    return {
        cvssScore: mapOsvCvss(vuln),
        fixedVersions: mapOsvFixedVersions(vuln),
        id: vuln.id,
        severity: mapOsvSeverity(vuln),
        summary: vuln.summary ?? "",
    };
};

const fetchVulnerabilities = async (
    packages: { name: string; version: string }[],
    timeoutMs: number = 10_000,
): Promise<Map<string, SecurityVulnerability[]>> => {
    if (packages.length === 0) {
        return new Map();
    }

    const queries = packages.map((pkg) => {
        return {
            package: { ecosystem: "npm", name: pkg.name },
            version: pkg.version,
        };
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- fetch is available in Node 20.19+ via undici
        const response = await fetch("https://api.osv.dev/v1/querybatch", {
            body: JSON.stringify({ queries }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
            signal: controller.signal,
        });

        if (!response.ok) {
            return new Map();
        }

        const data = (await response.json()) as OsvBatchResponse;
        const result = new Map<string, SecurityVulnerability[]>();

        for (const [index, packageInfo] of packages.entries()) {
            const vulns = data.results[index]?.vulns;

            if (vulns && vulns.length > 0) {
                result.set(
                    packageInfo.name,
                    vulns.map((vuln) => mapOsvVuln(vuln)),
                );
            }
        }

        return result;
    } catch {
        // Graceful degradation: return empty on any failure
        return new Map();
    } finally {
        clearTimeout(timeout);
    }
};

// --- Target version resolution ---

const sortVersionCandidates = (a: { parsed: ParsedVersion; raw: string }, b: { parsed: ParsedVersion; raw: string }): number => {
    if (a.parsed.major !== b.parsed.major) {
        return b.parsed.major - a.parsed.major;
    }

    if (a.parsed.minor !== b.parsed.minor) {
        return b.parsed.minor - a.parsed.minor;
    }

    return b.parsed.patch - a.parsed.patch;
};

const findTargetVersion = (versions: string[], latest: string, currentRange: string, target: UpdateTarget, includePrerelease: boolean): string | undefined => {
    const current = parseVersion(currentRange);

    if (!current) {
        return undefined;
    }

    if (target === "latest") {
        const latestParsed = parseVersion(latest);

        if (!latestParsed) {
            return undefined;
        }

        if (!includePrerelease && latestParsed.prerelease) {
            return undefined;
        }

        if (!isNewer(current, latestParsed)) {
            return undefined;
        }

        return latest;
    }

    // For minor/patch, find highest constrained version
    const candidates = versions
        .map((v) => {
            return { parsed: parseVersion(v), raw: v };
        })
        .filter((v): v is { parsed: ParsedVersion; raw: string } => {
            if (!v.parsed) {
                return false;
            }

            if (!includePrerelease && v.parsed.prerelease) {
                return false;
            }

            if (!isNewer(current, v.parsed)) {
                return false;
            }

            if (target === "patch") {
                return v.parsed.major === current.major && v.parsed.minor === current.minor;
            }

            // target === "minor"
            return v.parsed.major === current.major;
        })
        .toSorted(sortVersionCandidates);

    return candidates[0]?.raw;
};

// --- Check outdated ---

interface CheckOutdatedResult {
    failed: string[];
    outdated: OutdatedEntry[];
}

// --- checkOutdated helpers (sonarjs/cognitive-complexity) ---

const collectEntries = (
    catalogs: Map<string, Map<string, string>>,
    options: CatalogCheckOptions,
): { catalogName: string; packageName: string; range: string }[] => {
    const entries: { catalogName: string; packageName: string; range: string }[] = [];

    for (const [catalogName, deps] of catalogs) {
        for (const [packageName, range] of deps) {
            // Skip non-version protocols
            if (range.startsWith("workspace:") || range.startsWith("file:") || range.startsWith("link:") || range === "*") {
                continue;
            }

            if (matchesFilters(packageName, options.include, options.exclude)) {
                entries.push({ catalogName, packageName, range });
            }
        }
    }

    return entries;
};

const fetchVersionsBatched = async (
    uniquePackages: string[],
    npmrcConfig: NpmrcConfig | undefined,
    onProgress: ((current: number, total: number) => void) | undefined,
): Promise<{ failed: string[]; versionCache: Map<string, RegistryVersionInfo> }> => {
    const versionCache = new Map<string, RegistryVersionInfo>();
    const failed: string[] = [];
    const concurrency = 8;
    let completed = 0;

    for (let index = 0; index < uniquePackages.length; index += concurrency) {
        const batch = uniquePackages.slice(index, index + concurrency);
        // eslint-disable-next-line no-await-in-loop -- intentional batched processing to limit concurrency
        const results = await Promise.allSettled(
            batch.map(async (name) => {
                const registry = npmrcConfig ? getRegistryForPackage(name, npmrcConfig) : undefined;
                const info = await fetchPackageVersions(name, registry ? { authToken: registry.token, url: registry.url } : undefined);

                versionCache.set(name, info);

                return name;
            }),
        );

        for (const [batchIndex, batchResult] of results.entries()) {
            completed += 1;

            if (batchResult.status === "rejected") {
                const batchPackage = batch[batchIndex];

                if (batchPackage) {
                    failed.push(batchPackage);
                }
            }
        }

        if (onProgress) {
            onProgress(completed, uniquePackages.length);
        }
    }

    return { failed, versionCache };
};

const buildOutdatedEntries = (
    entries: { catalogName: string; packageName: string; range: string }[],
    versionCache: Map<string, RegistryVersionInfo>,
    options: CatalogCheckOptions,
): OutdatedEntry[] => {
    const outdated: OutdatedEntry[] = [];

    for (const entry of entries) {
        const info = versionCache.get(entry.packageName);

        if (!info) {
            continue;
        }

        const targetVersion = findTargetVersion(info.versions, info.latest, entry.range, options.target, options.includePrerelease);

        if (!targetVersion) {
            continue;
        }

        const current = parseVersion(entry.range);
        const target = parseVersion(targetVersion);

        if (!current || !target) {
            continue;
        }

        const updateType = getUpdateType(current, target);

        if (updateType === "none") {
            continue;
        }

        const prefix = extractPrefix(entry.range);

        outdated.push({
            catalogName: entry.catalogName,
            currentRange: entry.range,
            newRange: `${prefix}${targetVersion}`,
            packageName: entry.packageName,
            targetVersion,
            updateType,
        });
    }

    return outdated;
};

const enrichWithSecurity = async (outdated: OutdatedEntry[], entries: { catalogName: string; packageName: string; range: string }[]): Promise<void> => {
    // Check current versions for known vulnerabilities
    const packagesToScan = [
        ...new Map(
            entries.map((entry) => {
                const parsed = parseVersion(entry.range);

                return [
                    entry.packageName,
                    { name: entry.packageName, version: parsed ? `${String(parsed.major)}.${String(parsed.minor)}.${String(parsed.patch)}` : "" },
                ];
            }),
        ).values(),
    ].filter((p) => p.version);

    const vulnMap = await fetchVulnerabilities(packagesToScan);

    for (const entry of outdated) {
        const vulns = vulnMap.get(entry.packageName);

        if (vulns && vulns.length > 0) {
            entry.vulnerabilities = vulns;
        }
    }
};

const checkOutdated = async (
    catalogs: Map<string, Map<string, string>>,
    options: CatalogCheckOptions,
    npmrcConfig?: NpmrcConfig,
    onProgress?: (current: number, total: number) => void,
): Promise<CheckOutdatedResult> => {
    const entries = collectEntries(catalogs, options);

    // Deduplicate package names for fetching
    const uniquePackages = [...new Set(entries.map((entry) => entry.packageName))];

    const { failed, versionCache } = await fetchVersionsBatched(uniquePackages, npmrcConfig, onProgress);
    const outdated = buildOutdatedEntries(entries, versionCache, options);

    // Enrich with security data if requested
    if (options.security && outdated.length > 0) {
        await enrichWithSecurity(outdated, entries);
    }

    return { failed, outdated };
};

// --- Backup & Rollback ---

const getCatalogFilePath = (workspaceRoot: string, packageManager?: string): string => {
    if (packageManager === "bun") {
        return join(workspaceRoot, "package.json");
    }

    return join(workspaceRoot, "pnpm-workspace.yaml");
};

const createBackup = (workspaceRoot: string, packageManager?: string): string | undefined => {
    const filePath = getCatalogFilePath(workspaceRoot, packageManager);

    if (!existsSync(filePath)) {
        return undefined;
    }

    const backupPath = `${filePath}.bak`;
    const content = readFileSync(filePath, "utf8");

    writeFileSync(backupPath, content, "utf8");

    return backupPath;
};

const restoreFromBackup = (workspaceRoot: string, packageManager?: string): boolean => {
    const filePath = getCatalogFilePath(workspaceRoot, packageManager);
    const backupPath = `${filePath}.bak`;

    if (!existsSync(backupPath)) {
        return false;
    }

    const content = readFileSync(backupPath, "utf8");

    writeFileSync(filePath, content, "utf8");

    return true;
};

const hasBackup = (workspaceRoot: string, packageManager?: string): boolean => {
    const filePath = getCatalogFilePath(workspaceRoot, packageManager);

    return existsSync(`${filePath}.bak`);
};

// --- Output formatting ---

type OutputFormat = "json" | "minimal" | "table";

const formatOutdatedJson = (result: CheckOutdatedResult): string => JSON.stringify(result, undefined, 2);

const formatOutdatedMinimal = (outdated: OutdatedEntry[]): string =>
    outdated.map((entry) => `${entry.packageName}  ${entry.currentRange} → ${entry.newRange}`).join("\n");

const toFilterArray = (value: string | string[] | undefined): string[] => {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
};

const groupByCatalog = (entries: OutdatedEntry[]): Map<string, OutdatedEntry[]> => {
    const grouped = new Map<string, OutdatedEntry[]>();

    for (const entry of entries) {
        if (!grouped.has(entry.catalogName)) {
            grouped.set(entry.catalogName, []);
        }

        const group = grouped.get(entry.catalogName);

        if (group) {
            group.push(entry);
        }
    }

    return grouped;
};

const formatOutdatedTable = (outdated: OutdatedEntry[], logger: Console): void => {
    const byCatalog = groupByCatalog(outdated);

    for (const [catalogName, entries] of byCatalog) {
        const table = createTable();

        table.setHeaders(["Package", "Current", "Target", "Type"]);

        for (const entry of entries) {
            const hasSec = entry.vulnerabilities && entry.vulnerabilities.length > 0;
            const displayName = hasSec ? `[SEC] ${entry.packageName}` : entry.packageName;

            table.addRow([displayName, entry.currentRange, entry.newRange, entry.updateType]);

            if (entry.vulnerabilities) {
                for (const vuln of entry.vulnerabilities) {
                    table.addRow([`  ${vuln.severity} ${vuln.id}`, { colSpan: 3, content: vuln.summary }]);
                }
            }
        }

        logger.info(`Catalog: ${catalogName}\n${table.toString()}\n`);
    }
};

const formatSummary = (outdated: OutdatedEntry[]): string => {
    const majors = outdated.filter((entry) => entry.updateType === "major").length;
    const minors = outdated.filter((entry) => entry.updateType === "minor").length;
    const patches = outdated.filter((entry) => entry.updateType === "patch").length;
    const securityCount = outdated.filter((entry) => entry.vulnerabilities && entry.vulnerabilities.length > 0).length;
    const parts: string[] = [];

    if (majors) {
        parts.push(`${String(majors)} major`);
    }

    if (minors) {
        parts.push(`${String(minors)} minor`);
    }

    if (patches) {
        parts.push(`${String(patches)} patch`);
    }

    if (securityCount) {
        parts.push(`${String(securityCount)} with vulnerabilities`);
    }

    const summary = `Found ${String(outdated.length)} outdated (${parts.join(", ")})`;

    return boxen(summary, { headerText: "Summary", padding: { left: 1, right: 1 } });
};

// --- Apply updates ---

const buildLineMatchRegex = (packageName: string, range: string): RegExp => {
    const escapedName = packageName.replaceAll(REGEX_SPECIAL_CHARS_REGEX, String.raw`\$&`);
    const escapedRange = range.replaceAll(REGEX_SPECIAL_CHARS_REGEX, String.raw`\$&`);

    return new RegExp(String.raw`^(?:'${escapedName}'|"${escapedName}"|${escapedName}):\s*['"]?${escapedRange}['"]?`);
};

const lineMatchesPackage = (trimmed: string, packageName: string, range: string): boolean => {
    const regex = buildLineMatchRegex(packageName, range);

    return regex.test(trimmed);
};

// --- applyPnpmCatalogUpdates helpers (sonarjs/cognitive-complexity) ---

const buildUpdateMap = (updates: OutdatedEntry[]): Map<string, Map<string, { newRange: string; oldRange: string }>> => {
    const updateMap = new Map<string, Map<string, { newRange: string; oldRange: string }>>();

    for (const update of updates) {
        if (!updateMap.has(update.catalogName)) {
            updateMap.set(update.catalogName, new Map());
        }

        const catalogMap = updateMap.get(update.catalogName);

        if (catalogMap) {
            catalogMap.set(update.packageName, {
                newRange: update.newRange,
                oldRange: update.currentRange,
            });
        }
    }

    return updateMap;
};

const applyLineUpdate = (line: string, trimmed: string, catalogUpdates: Map<string, { newRange: string; oldRange: string }> | undefined): string => {
    if (!catalogUpdates) {
        return line;
    }

    for (const [pkgName, { newRange, oldRange }] of catalogUpdates) {
        if (lineMatchesPackage(trimmed, pkgName, oldRange)) {
            return line.replace(oldRange, newRange);
        }
    }

    return line;
};

const processYamlLineForUpdate = (
    line: string,
    section: YamlSection,
    currentCatalogName: string,
    updateMap: Map<string, Map<string, { newRange: string; oldRange: string }>>,
): string => {
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
        return line;
    }

    if (section === "catalog" && indent >= 2) {
        return applyLineUpdate(line, trimmed, updateMap.get("default"));
    }

    if (section === "catalogs" && indent >= 4 && currentCatalogName) {
        return applyLineUpdate(line, trimmed, updateMap.get(currentCatalogName));
    }

    return line;
};

const applyPnpmCatalogUpdates = (workspaceRoot: string, updates: OutdatedEntry[]): void => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const updateMap = buildUpdateMap(updates);

    let section: YamlSection = "none";
    let currentCatalogName = "";
    const result: string[] = [];

    for (const line of lines) {
        const trimmed = line.trimStart();
        const indent = line.length - trimmed.length;

        if (indent === 0 && trimmed.length > 0 && !trimmed.startsWith("#")) {
            section = detectTopLevelSection(trimmed);

            if (section === "catalogs") {
                currentCatalogName = "";
            }
        }

        if (section === "catalogs" && indent === 2 && trimmed.endsWith(":")) {
            currentCatalogName = trimmed.slice(0, -1).trim().replaceAll(QUOTES_TRIM_REGEX, "");
        }

        result.push(processYamlLineForUpdate(line, section, currentCatalogName, updateMap));
    }

    writeFileSync(filePath, result.join("\n"), "utf8");
};

const detectJsonIndent = (content: string): number | string => {
    const match = JSON_INDENT_REGEX.exec(content);

    if (!match) {
        return 2;
    }

    // Preserve tabs as-is; for spaces, return the count
    return match[1].includes("\t") ? match[1] : match[1].length;
};

const applyBunCatalogUpdates = (workspaceRoot: string, updates: OutdatedEntry[]): void => {
    const filePath = join(workspaceRoot, "package.json");
    const content = readFileSync(filePath, "utf8");
    const pkg = JSON.parse(content) as BunPackageJson;
    const indent = detectJsonIndent(content);

    for (const update of updates) {
        if (update.catalogName === "default") {
            if (pkg.workspaces?.catalog) {
                pkg.workspaces.catalog[update.packageName] = update.newRange;
            }
        } else if (pkg.workspaces?.catalogs?.[update.catalogName]) {
            pkg.workspaces.catalogs[update.catalogName][update.packageName] = update.newRange;
        }
    }

    writeFileSync(filePath, `${JSON.stringify(pkg, undefined, indent)}\n`, "utf8");
};

const applyCatalogUpdates = (workspaceRoot: string, updates: OutdatedEntry[], packageManager?: string, backup = true): string | undefined => {
    let backupPath: string | undefined;

    if (backup) {
        backupPath = createBackup(workspaceRoot, packageManager);
    }

    if (packageManager === "bun") {
        applyBunCatalogUpdates(workspaceRoot, updates);
    } else {
        applyPnpmCatalogUpdates(workspaceRoot, updates);
    }

    return backupPath;
};

// --- Interactive selection ---

const promptPackageSelection = async (outdated: OutdatedEntry[]): Promise<OutdatedEntry[]> => {
    const { createInterface } = await import("node:readline");
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    const ask = (question: string): Promise<string> =>
        new Promise((resolve) => {
            rl.question(question, (answer) => resolve(answer.trim()));
        });

    process.stdout.write("\nOutdated catalog dependencies:\n");

    for (const [index, element] of outdated.entries()) {
        if (!element) {
            continue;
        }

        process.stdout.write(`  ${String(index + 1)}. ${element.packageName}: ${element.currentRange} → ${element.newRange} (${element.updateType})\n`);
    }

    process.stdout.write("\n");

    const answer = await ask("Apply updates? [a]ll / [n]one / [s]elect: ");

    if (answer.toLowerCase() === "a" || answer.toLowerCase() === "all") {
        rl.close();

        return outdated;
    }

    if (answer.toLowerCase() === "n" || answer.toLowerCase() === "none") {
        rl.close();

        return [];
    }

    if (answer.toLowerCase() === "s" || answer.toLowerCase() === "select") {
        const selection = await ask("Enter numbers to apply (comma-separated): ");

        rl.close();

        const indices = selection
            .split(",")
            .map((s) => Number.parseInt(s.trim(), 10) - 1)
            .filter((i) => i >= 0 && i < outdated.length);

        return indices.map((i) => outdated[i]).filter((entry): entry is OutdatedEntry => entry !== undefined);
    }

    // Unrecognized input — default to no updates for safety
    rl.close();

    return [];
};

// --- All exports at end of file (import/exports-last) ---

export type {
    CatalogCheckOptions,
    CatalogProvider,
    CheckOutdatedResult,
    NpmrcConfig,
    OutdatedEntry,
    OutputFormat,
    ParsedVersion,
    SecurityVulnerability,
    UpdateTarget,
};

export {
    applyCatalogUpdates,
    checkOutdated,
    createBackup,
    detectJsonIndent,
    extractPrefix,
    fetchPackageVersions,
    fetchVulnerabilities,
    findTargetVersion,
    formatOutdatedJson,
    formatOutdatedMinimal,
    formatOutdatedTable,
    formatSummary,
    getRegistryForPackage,
    getUpdateType,
    groupByCatalog,
    hasBackup,
    hasCatalogs,
    isNewer,
    loadNpmrc,
    matchesFilters,
    matchesPattern,
    parseBunCatalogs,
    parseCatalogsFromYaml,
    parseNpmrc,
    parseVersion,
    promptPackageSelection,
    readCatalogs,
    restoreFromBackup,
    toFilterArray,
};
