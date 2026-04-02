import { findCacheDirSync } from "@visulima/find-cache-dir";
import { ensureDirSync, isAccessibleSync, readFileSync, readJsonSync, removeSync, walkSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { dirname, join } from "@visulima/path";
import { Box, renderToString, Table, Text } from "@visulima/tui";
import React from "react";

import { resolveWorkspacePatterns } from "./workspace";

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

const VALID_DEP_TYPES = new Set(["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]);

/**
 * Returns the backup directory inside node_modules/.cache/vis/backup.
 * Throws if the cache directory cannot be resolved (e.g., no node_modules).
 */
const getBackupDir = (workspaceRoot: string): string => {
    const cacheDir = findCacheDirSync("vis", { create: true, cwd: workspaceRoot });

    if (!cacheDir) {
        throw new Error("Cannot resolve cache directory. Ensure node_modules exists in your workspace. " + "Run your package manager's install command first.");
    }

    return join(cacheDir, "backup");
};

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

interface ReadCatalogOptions {
    dev?: boolean;
    prod?: boolean;
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

    return match?.[1] ?? "";
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

    if (!isAccessibleSync(filePath)) {
        return false;
    }

    const content = readFileSync(filePath);

    return CATALOG_SECTION_REGEX.test(content) || CATALOGS_SECTION_REGEX.test(content);
};

const readPnpmCatalogs = (workspaceRoot: string): Map<string, Map<string, string>> => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!isAccessibleSync(filePath)) {
        return new Map();
    }

    const content = readFileSync(filePath);

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

const readPackageJsonSafe = (filePath: string): BunPackageJson | undefined => {
    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    try {
        return readJsonSync(filePath) as BunPackageJson;
    } catch {
        return undefined;
    }
};

const hasBunCatalogs = (workspaceRoot: string): boolean => {
    const pkg = readPackageJsonSafe(join(workspaceRoot, "package.json"));

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
    const pkg = readPackageJsonSafe(join(workspaceRoot, "package.json"));

    if (!pkg) {
        return new Map();
    }

    return parseBunCatalogs(pkg);
};

// --- Catalog reading: npm/yarn (package.json deps) ---

const parseCompositeCatalogName = (name: string): { depType: string; relativePath: string } | undefined => {
    const colonIndex = name.lastIndexOf(":");

    if (colonIndex === -1) {
        return undefined;
    }

    const depType = name.slice(colonIndex + 1);

    if (!VALID_DEP_TYPES.has(depType)) {
        return undefined;
    }

    return { depType, relativePath: name.slice(0, colonIndex) };
};

const getDepTypesToInclude = (options?: ReadCatalogOptions): string[] => {
    if (options?.dev) {
        return ["devDependencies"];
    }

    if (options?.prod) {
        return ["dependencies"];
    }

    return ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
};

const collectInternalPackageNames = (workspaceRoot: string, rootName: string | undefined, workspaceDirectories: string[]): Set<string> => {
    const names = new Set<string>();

    if (rootName) {
        names.add(rootName);
    }

    for (const directory of workspaceDirectories) {
        const pkgPath = join(workspaceRoot, directory, "package.json");

        if (isAccessibleSync(pkgPath)) {
            try {
                const pkg = readJsonSync(pkgPath) as { name?: string };

                if (pkg.name) {
                    names.add(pkg.name);
                }
            } catch {
                // skip invalid package.json
            }
        }
    }

    return names;
};

const filterExternalDeps = (deps: Record<string, string>, internalNames: Set<string>): Map<string, string> => {
    const filtered = new Map<string, string>();

    for (const [name, range] of Object.entries(deps)) {
        if (internalNames.has(name)) {
            continue;
        }

        if (range.startsWith("workspace:") || range.startsWith("file:") || range.startsWith("link:")) {
            continue;
        }

        filtered.set(name, range);
    }

    return filtered;
};

const scanDirectoryDeps = (
    workspaceRoot: string,
    directory: string,
    rootPkgPath: string,
    depTypes: string[],
    internalNames: Set<string>,
    catalogs: Map<string, Map<string, string>>,
): void => {
    const pkgPath = directory === "." ? rootPkgPath : join(workspaceRoot, directory, "package.json");

    if (!isAccessibleSync(pkgPath)) {
        return;
    }

    let pkg: Record<string, unknown>;

    try {
        pkg = readJsonSync(pkgPath) as Record<string, unknown>;
    } catch {
        return;
    }

    for (const depType of depTypes) {
        const deps = pkg[depType] as Record<string, string> | undefined;

        if (!deps || typeof deps !== "object") {
            continue;
        }

        const filtered = filterExternalDeps(deps, internalNames);

        if (filtered.size > 0) {
            catalogs.set(`${directory}:${depType}`, filtered);
        }
    }
};

const readPackageJsonDeps = (workspaceRoot: string, options?: ReadCatalogOptions): Map<string, Map<string, string>> => {
    const catalogs = new Map<string, Map<string, string>>();
    const rootPkgPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(rootPkgPath)) {
        return catalogs;
    }

    const rootPkg = readJsonSync(rootPkgPath) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        name?: string;
        optionalDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
        workspaces?: string[] | { packages: string[] };
    };

    let workspaceDirectories: string[] = [];
    const workspacesField = rootPkg.workspaces;

    if (workspacesField) {
        const patterns = Array.isArray(workspacesField) ? workspacesField : workspacesField.packages;

        workspaceDirectories = resolveWorkspacePatterns(workspaceRoot, patterns);
    }

    const internalNames = collectInternalPackageNames(workspaceRoot, rootPkg.name, workspaceDirectories);
    const depTypes = getDepTypesToInclude(options);
    const directoriesToScan = [".", ...workspaceDirectories];

    for (const directory of directoriesToScan) {
        scanDirectoryDeps(workspaceRoot, directory, rootPkgPath, depTypes, internalNames, catalogs);
    }

    return catalogs;
};

const hasPackageJsonDeps = (workspaceRoot: string): boolean => {
    const pkgPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(pkgPath)) {
        return false;
    }

    try {
        const pkg = readJsonSync(pkgPath) as Record<string, unknown>;

        return !!(pkg.dependencies || pkg.devDependencies || pkg.peerDependencies || pkg.optionalDependencies);
    } catch {
        return false;
    }
};

const applyPackageJsonUpdates = (workspaceRoot: string, updates: OutdatedEntry[]): void => {
    const byFile = new Map<string, { depType: string; newRange: string; packageName: string }[]>();

    for (const update of updates) {
        const parsed = parseCompositeCatalogName(update.catalogName);

        if (!parsed) {
            continue;
        }

        const filePath = parsed.relativePath === "." ? join(workspaceRoot, "package.json") : join(workspaceRoot, parsed.relativePath, "package.json");

        if (!byFile.has(filePath)) {
            byFile.set(filePath, []);
        }

        const fileList = byFile.get(filePath);

        if (fileList) {
            fileList.push({ depType: parsed.depType, newRange: update.newRange, packageName: update.packageName });
        }
    }

    for (const [filePath, fileUpdates] of byFile) {
        const pkg = readJsonSync(filePath) as Record<string, Record<string, string>>;

        for (const { depType, newRange, packageName } of fileUpdates) {
            if (pkg[depType]) {
                pkg[depType][packageName] = newRange;
            }
        }

        writeJsonSync(filePath, pkg, { detectIndent: true, overwrite: true });
    }
};

// --- Unified catalog API ---

type CatalogProvider = "bun" | "pnpm";

const hasCatalogs = (workspaceRoot: string, packageManager?: string): boolean => {
    if (packageManager === "bun") {
        return hasBunCatalogs(workspaceRoot) || hasPackageJsonDeps(workspaceRoot);
    }

    if (packageManager === "npm" || packageManager === "yarn") {
        return hasPackageJsonDeps(workspaceRoot);
    }

    // pnpm: try catalogs first, fall back to package.json deps
    return hasPnpmCatalogs(workspaceRoot) || hasPackageJsonDeps(workspaceRoot);
};

const readCatalogs = (workspaceRoot: string, packageManager?: string, options?: ReadCatalogOptions): Map<string, Map<string, string>> => {
    if (packageManager === "bun") {
        const catalogs = readBunCatalogs(workspaceRoot);

        return catalogs.size > 0 ? catalogs : readPackageJsonDeps(workspaceRoot, options);
    }

    if (packageManager === "npm" || packageManager === "yarn") {
        return readPackageJsonDeps(workspaceRoot, options);
    }

    // pnpm: try catalogs first, fall back to package.json deps
    const catalogs = readPnpmCatalogs(workspaceRoot);

    return catalogs.size > 0 ? catalogs : readPackageJsonDeps(workspaceRoot, options);
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

        if (scopeMatch?.[1]) {
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

        if (authMatch?.[1]) {
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
    let config = homeDirectory && isAccessibleSync(userNpmrc) ? parseNpmrc(readFileSync(userNpmrc)) : empty;

    // Merge project-level .npmrc on top (higher precedence)
    const projectNpmrc = join(workspaceRoot, ".npmrc");

    if (isAccessibleSync(projectNpmrc)) {
        config = mergeNpmrcConfigs(config, parseNpmrc(readFileSync(projectNpmrc)));
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
    const timeout = setTimeout(() => { controller.abort(); }, timeoutMs);

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
    const timeout = setTimeout(() => { controller.abort(); }, timeoutMs);

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

const createPackageJsonBackup = (workspaceRoot: string, updates: OutdatedEntry[]): string | undefined => {
    const backupDirectory = getBackupDir(workspaceRoot);
    const filesToBackup = new Set<string>();

    for (const update of updates) {
        const parsed = parseCompositeCatalogName(update.catalogName);

        if (parsed) {
            filesToBackup.add(parsed.relativePath === "." ? "package.json" : join(parsed.relativePath, "package.json"));
        }
    }

    if (filesToBackup.size === 0) {
        return undefined;
    }

    ensureDirSync(backupDirectory);

    for (const relativePath of filesToBackup) {
        const sourcePath = join(workspaceRoot, relativePath);

        if (isAccessibleSync(sourcePath)) {
            const destinationPath = join(backupDirectory, relativePath);
            const destinationDirectory = dirname(destinationPath);

            ensureDirSync(destinationDirectory);
            writeFileSync(destinationPath, readFileSync(sourcePath));
        }
    }

    return backupDirectory;
};

const createBackup = (workspaceRoot: string, packageManager?: string, updates?: OutdatedEntry[]): string | undefined => {
    if ((packageManager === "npm" || packageManager === "yarn") && updates) {
        return createPackageJsonBackup(workspaceRoot, updates);
    }

    const filePath = getCatalogFilePath(workspaceRoot, packageManager);

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    const backupPath = `${filePath}.bak`;

    // Always overwrite existing backup with latest state
    const content = readFileSync(filePath);

    writeFileSync(backupPath, content);

    return backupPath;
};

const restorePackageJsonBackup = (workspaceRoot: string): boolean => {
    const backupDirectory = getBackupDir(workspaceRoot);

    if (!isAccessibleSync(backupDirectory)) {
        return false;
    }

    for (const entry of walkSync(backupDirectory, { includeDirs: false })) {
        const relativePath = entry.path.slice(backupDirectory.length + 1);
        const destinationPath = join(workspaceRoot, relativePath);

        writeFileSync(destinationPath, readFileSync(entry.path));
    }

    removeSync(backupDirectory);

    return true;
};

const restoreFromBackup = (workspaceRoot: string, packageManager?: string): boolean => {
    if (packageManager === "npm" || packageManager === "yarn") {
        return restorePackageJsonBackup(workspaceRoot);
    }

    const filePath = getCatalogFilePath(workspaceRoot, packageManager);
    const backupPath = `${filePath}.bak`;

    if (!isAccessibleSync(backupPath)) {
        return false;
    }

    const content = readFileSync(backupPath);

    writeFileSync(filePath, content);

    return true;
};

const hasBackup = (workspaceRoot: string, packageManager?: string): boolean => {
    if (packageManager === "npm" || packageManager === "yarn") {
        try {
            const backupDir = getBackupDir(workspaceRoot);

            return isAccessibleSync(backupDir);
        } catch {
            return false;
        }
    }

    const filePath = getCatalogFilePath(workspaceRoot, packageManager);

    return isAccessibleSync(`${filePath}.bak`);
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

const formatCatalogDisplayName = (catalogName: string): string => {
    const parsed = parseCompositeCatalogName(catalogName);

    if (parsed) {
        const location = parsed.relativePath === "." ? "root" : parsed.relativePath;

        return `${location} (${parsed.depType})`;
    }

    return `Catalog: ${catalogName}`;
};

const formatOutdatedTable = (outdated: OutdatedEntry[], logger: Console): void => {
    const byCatalog = groupByCatalog(outdated);
    const columns = process.stdout.columns || 80;

    for (const [catalogName, entries] of byCatalog) {
        const tableData = entries.flatMap((entry) => {
            const hasSec = entry.vulnerabilities && entry.vulnerabilities.length > 0;
            const displayName = hasSec ? `[SEC] ${entry.packageName}` : entry.packageName;

            const rows: { current: string; package: string; target: string; type: string }[] = [
                { current: entry.currentRange, package: displayName, target: entry.newRange, type: entry.updateType },
            ];

            if (entry.vulnerabilities) {
                for (const vuln of entry.vulnerabilities) {
                    rows.push({ current: vuln.summary, package: `  ${vuln.severity} ${vuln.id}`, target: "", type: "" });
                }
            }

            return rows;
        });

        const displayName = formatCatalogDisplayName(catalogName);
        const output = renderToString(React.createElement(Table, { data: tableData }), { columns });

        logger.info(`${displayName}\n${output}\n`);
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
    const columns = process.stdout.columns || 80;

    return renderToString(
        React.createElement(
            Box,
            { flexDirection: "column", paddingX: 1 },
            React.createElement(Text, { bold: true }, "\u2500 Summary"),
            React.createElement(Text, null, "  " + summary),
        ),
        { columns },
    );
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
    const content = readFileSync(filePath);
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

    writeFileSync(filePath, result.join("\n"));
};

const detectJsonIndent = (content: string): number | string => {
    const match = JSON_INDENT_REGEX.exec(content);

    if (!match) {
        return 2;
    }

    // Preserve tabs as-is; for spaces, return the count
    const indent = match[1];

    if (!indent) {
        return 2;
    }

    return indent.includes("\t") ? indent : indent.length;
};

const applyBunCatalogUpdates = (workspaceRoot: string, updates: OutdatedEntry[]): void => {
    const filePath = join(workspaceRoot, "package.json");
    const pkg = readJsonSync(filePath) as BunPackageJson;

    for (const update of updates) {
        if (update.catalogName === "default") {
            if (pkg.workspaces?.catalog) {
                pkg.workspaces.catalog[update.packageName] = update.newRange;
            }
        } else {
            const catalogEntry = pkg.workspaces?.catalogs?.[update.catalogName];

            if (catalogEntry) {
                catalogEntry[update.packageName] = update.newRange;
            }
        }
    }

    writeJsonSync(filePath, pkg, { detectIndent: true, overwrite: true });
};

const applyCatalogUpdates = (workspaceRoot: string, updates: OutdatedEntry[], packageManager?: string, backup = true): string | undefined => {
    let backupPath: string | undefined;

    if (backup) {
        backupPath = createBackup(workspaceRoot, packageManager, updates);
    }

    if (packageManager === "npm" || packageManager === "yarn") {
        applyPackageJsonUpdates(workspaceRoot, updates);
    } else if (packageManager === "bun") {
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
            rl.question(question, (answer) => { resolve(answer.trim()); });
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

// --- Changelog ---

const GITHUB_REPO_REGEX = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git|\/|$)/;

interface ChangelogInfo {
    npmUrl: string;
    packageName: string;
    releaseUrl?: string;
    repoUrl?: string;
}

const fetchChangelogInfo = async (packages: OutdatedEntry[], timeoutMs: number = 10_000): Promise<ChangelogInfo[]> => {
    const results: ChangelogInfo[] = [];

    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, timeoutMs);

    try {
        const fetches = packages.map(async (entry): Promise<ChangelogInfo> => {
            const npmUrl = `https://www.npmjs.com/package/${entry.packageName}`;

            try {
                // eslint-disable-next-line n/no-unsupported-features/node-builtins -- fetch is available in Node 20.19+
                const response = await fetch(`https://registry.npmjs.org/${entry.packageName}`, {
                    headers: { Accept: "application/json" },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    return { npmUrl, packageName: entry.packageName };
                }

                const data = (await response.json()) as { repository?: { url?: string } };
                const repoUrl = data.repository?.url;

                if (!repoUrl) {
                    return { npmUrl, packageName: entry.packageName };
                }

                const match = GITHUB_REPO_REGEX.exec(repoUrl);

                if (!match) {
                    return { npmUrl, packageName: entry.packageName, repoUrl };
                }

                const owner = match[1];
                const repo = match[2];
                const releaseUrl = `https://github.com/${owner}/${repo}/releases/tag/v${entry.targetVersion}`;

                return { npmUrl, packageName: entry.packageName, releaseUrl, repoUrl: `https://github.com/${owner}/${repo}` };
            } catch {
                return { npmUrl, packageName: entry.packageName };
            }
        });

        results.push(...await Promise.all(fetches));
    } finally {
        clearTimeout(timeout);
    }

    return results;
};

// --- All exports at end of file (import/exports-last) ---

export type {
    CatalogCheckOptions,
    CatalogProvider,
    ChangelogInfo,
    CheckOutdatedResult,
    NpmrcConfig,
    OutdatedEntry,
    OutputFormat,
    ParsedVersion,
    ReadCatalogOptions,
    SecurityVulnerability,
    UpdateTarget,
};

export {
    applyCatalogUpdates,
    applyPackageJsonUpdates,
    checkOutdated,
    createBackup,
    detectJsonIndent,
    extractPrefix,
    fetchChangelogInfo,
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
    hasPackageJsonDeps,
    isNewer,
    loadNpmrc,
    matchesFilters,
    matchesPattern,
    parseBunCatalogs,
    parseCatalogsFromYaml,
    parseCompositeCatalogName,
    parseNpmrc,
    parseVersion,
    promptPackageSelection,
    readCatalogs,
    readPackageJsonDeps,
    restoreFromBackup,
    toFilterArray,
};
