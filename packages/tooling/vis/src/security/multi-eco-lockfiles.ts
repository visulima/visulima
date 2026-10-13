/**
 * Per-ecosystem lockfile readers for `vis audit`.
 *
 * Each reader returns `{ name, version }[]` for a non-npm OSV ecosystem.
 * Parsers are regex/JSON-only to avoid pulling a heavyweight TOML/XML
 * runtime dep — lockfile formats are stable and our needs are narrow.
 */
import { existsSync, readFileSync } from "node:fs";

import { join } from "@visulima/path";

import { readGradleLockEntries } from "../sbom/gradle";
import { parseMixLockEntries } from "../sbom/hex";
import { readMavenModules } from "../sbom/maven";
import { parseNuGetLockEntries } from "../sbom/nuget";
import { composerVersionFromLock } from "../util/composer";
import type { InstalledPackage } from "./dependency-scan";

const ECOSYSTEM_LOCKFILES: Record<string, string[]> = {
    "crates.io": ["Cargo.lock"],
    Go: ["go.sum"],
    Hex: ["mix.lock"],
    Maven: ["gradle.lockfile", "pom.xml"],
    NuGet: ["packages.lock.json"],
    Packagist: ["composer.lock"],
    Pub: ["pubspec.lock"],
    PyPI: ["uv.lock", "poetry.lock", "Pipfile.lock"],
    RubyGems: ["Gemfile.lock"],
    SwiftURL: ["Package.resolved"],
};

const ECOSYSTEM_ALIASES: Record<string, string> = {
    cargo: "crates.io",
    composer: "Packagist",
    "crates.io": "crates.io",
    dart: "Pub",
    go: "Go",
    gradle: "Maven",
    hex: "Hex",
    maven: "Maven",
    npm: "npm",
    nuget: "NuGet",
    packagist: "Packagist",
    pub: "Pub",
    pypi: "PyPI",
    rubygems: "RubyGems",
    swift: "SwiftURL",
    swifturl: "SwiftURL",
};

export const canonicalEcosystem = (raw: string): string => ECOSYSTEM_ALIASES[raw.toLowerCase()] ?? raw;

/** Lock file names vis reads for an ecosystem, in preference order. Empty when vis has no reader for it. */
export const lockfileNamesForEcosystem = (ecosystem: string): string[] => ECOSYSTEM_LOCKFILES[canonicalEcosystem(ecosystem)] ?? [];

export const findEcosystemLockfile = (workspaceRoot: string, ecosystem: string): string | undefined => {
    const canonical = canonicalEcosystem(ecosystem);
    const candidates = ECOSYSTEM_LOCKFILES[canonical] ?? [];

    for (const name of candidates) {
        const path = join(workspaceRoot, name);

        if (existsSync(path)) {
            return path;
        }
    }

    return undefined;
};

const dedupe = (entries: InstalledPackage[]): InstalledPackage[] => {
    const seen = new Set<string>();
    const out: InstalledPackage[] = [];

    for (const entry of entries) {
        const key = `${entry.name}@${entry.version}`;

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        out.push(entry);
    }

    return out;
};

const TOML_PACKAGE_BLOCK_RE = /\[\[package\]\]([\s\S]*?)(?=\[\[|$)/g;
const TOML_NAME_RE = /^\s*name\s*=\s*"([^"]+)"\s*$/m;
const TOML_VERSION_RE = /^\s*version\s*=\s*"([^"]+)"\s*$/m;

const parseTomlPackages = (content: string): InstalledPackage[] => {
    const entries: InstalledPackage[] = [];

    for (const match of content.matchAll(TOML_PACKAGE_BLOCK_RE)) {
        const block = match[1] ?? "";
        const name = TOML_NAME_RE.exec(block)?.[1];
        const version = TOML_VERSION_RE.exec(block)?.[1];

        if (name && version) {
            entries.push({ isDev: false, name, version });
        }
    }

    return entries;
};

const parsePipfileLock = (content: string): InstalledPackage[] => {
    let json: unknown;

    try {
        json = JSON.parse(content);
    } catch {
        return [];
    }

    if (typeof json !== "object" || json === null) {
        return [];
    }

    const entries: InstalledPackage[] = [];

    for (const section of ["default", "develop"]) {
        const block = (json as Record<string, unknown>)[section];

        if (typeof block !== "object" || block === null) {
            continue;
        }

        for (const [name, meta] of Object.entries(block as Record<string, unknown>)) {
            if (typeof meta !== "object" || meta === null) {
                continue;
            }

            const rawVersion = (meta as Record<string, unknown>).version;

            if (typeof rawVersion !== "string") {
                continue;
            }

            const version = rawVersion.replace(/^==/, "").trim();

            if (version.length > 0) {
                entries.push({ isDev: false, name, version });
            }
        }
    }

    return entries;
};

/**
 * `composer.lock`: the `packages` and `packages-dev` arrays, each entry with a `name` and
 * `version`. The version is Composer's pretty version, which keeps the tag's `v`; the
 * `v` is dropped so the version matches the bare numbers the advisory data uses.
 */
const parseComposerLock = (content: string): InstalledPackage[] => {
    const entries: InstalledPackage[] = [];
    let lock: Record<string, unknown>;

    try {
        lock = JSON.parse(content) as Record<string, unknown>;
    } catch {
        // A lockfile that does not parse yields no packages, the same as the other readers.
        return entries;
    }

    for (const [key, isDev] of [
        ["packages", false],
        ["packages-dev", true],
    ] as const) {
        const list = lock[key];

        if (!Array.isArray(list)) {
            continue;
        }

        for (const item of list as { name?: unknown; version?: unknown }[]) {
            if (typeof item.name === "string" && typeof item.version === "string") {
                entries.push({ isDev, name: item.name, version: composerVersionFromLock(item.version) });
            }
        }
    }

    return entries;
};

const parseGoSum = (content: string): InstalledPackage[] => {
    const entries: InstalledPackage[] = [];

    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (trimmed.length === 0) {
            continue;
        }

        const parts = trimmed.split(/\s+/);

        if (parts.length < 3) {
            continue;
        }

        const [name, versionField] = parts;

        if (!name || !versionField?.endsWith("/go.mod")) {
            continue;
        }

        const version = versionField.slice(0, -"/go.mod".length);

        if (version.length === 0) {
            continue;
        }

        entries.push({ isDev: false, name, version });
    }

    return entries;
};

const GEM_SPEC_RE = /^ {4}([^ ()]+) \(([^()]+)\)\s*$/;

const parseGemfileLock = (content: string): InstalledPackage[] => {
    const entries: InstalledPackage[] = [];
    let inGemSpecs = false;
    let inSpecs = false;

    for (const line of content.split(/\r?\n/)) {
        if (line.startsWith("GEM")) {
            inGemSpecs = true;
            inSpecs = false;
            continue;
        }

        if (inGemSpecs && /^[A-Z]/.test(line)) {
            inGemSpecs = false;
            inSpecs = false;
            continue;
        }

        if (inGemSpecs && line.trim() === "specs:") {
            inSpecs = true;
            continue;
        }

        if (inSpecs) {
            const match = GEM_SPEC_RE.exec(line);

            if (match) {
                const [, name, rawVersion] = match;
                // A platform variant (`1.16.0-arm64-darwin`) is the same gem version for OSV.
                const version = rawVersion?.split("-")[0];

                if (name && version) {
                    entries.push({ isDev: false, name, version });
                }
            }
        }
    }

    return entries;
};

/**
 * `pubspec.lock`: the `packages` map, each entry with a `source` and a `version`. Only
 * `source: hosted` entries are pub.dev packages; `sdk`, `git` and `path` entries have no
 * pub.dev version and are skipped. `dependency: direct dev` marks a dev package.
 */
const parsePubspecLock = (content: string): InstalledPackage[] => {
    const records: { dependency?: string; name: string; source?: string; version?: string }[] = [];
    let inPackages = false;

    for (const line of content.split(/\r?\n/)) {
        if (/^\S/.test(line)) {
            inPackages = line.trimEnd() === "packages:";

            continue;
        }

        const last = records.at(-1);
        const header = /^ {2}(\S+):\s*$/.exec(line);

        if (inPackages && header?.[1] !== undefined) {
            records.push({ name: header[1] });

            continue;
        }

        const [, key, value] = /^ {4}(dependency|source|version): "?([^"]*)"?\s*$/.exec(line) ?? [];

        if (inPackages && last !== undefined && key !== undefined && value !== undefined) {
            if (key === "source") {
                last.source = value;
            } else if (key === "version") {
                last.version = value;
            } else {
                last.dependency = value;
            }
        }
    }

    return records
        .filter((record) => record.source === "hosted" && record.version !== undefined && record.version.length > 0)
        .map((record) => {
            return { isDev: record.dependency === "direct dev", name: record.name, version: record.version! };
        });
};

/**
 * The package name SwiftPM uses for a pin, which is the host/owner/repo form OSV's SwiftURL
 * records use: no scheme, no `.git` suffix. `git@host:owner/repo.git` is read the same way.
 */
export const swiftPackageName = (location: string): string =>
    location
        .trim()
        .replace(/^[a-z+]+:\/\//i, "")
        .replace(/^[^@/]+@([^:/]+):/, "$1/")
        .replace(/\.git$/, "")
        .replace(/\/+$/, "");

/**
 * `Package.resolved` (format v2 and v3): a top-level `pins` array. Each pin has a `location`
 * and a `state.version`. A pin pinned to a branch or revision has no version and is skipped.
 */
const parsePackageResolved = (content: string): InstalledPackage[] => {
    let json: unknown;

    try {
        json = JSON.parse(content);
    } catch {
        return [];
    }

    const pins = typeof json === "object" && json !== null ? (json as { pins?: unknown }).pins : undefined;

    if (!Array.isArray(pins)) {
        return [];
    }

    const entries: InstalledPackage[] = [];

    for (const pin of pins as { location?: unknown; state?: { version?: unknown } }[]) {
        if (typeof pin.location === "string" && typeof pin.state?.version === "string" && pin.state.version.length > 0) {
            entries.push({ isDev: false, name: swiftPackageName(pin.location), version: pin.state.version });
        }
    }

    return entries;
};

/**
 * The Maven packages the audit checks: each resolved dependency declared in the workspace's pom tree (every
 * scope, inherited ones included), and every `gradle.lockfile` entry, transitive ones included. A declared
 * dependency whose version the pom does not pin is not checked; it is reported in `unresolved` instead.
 */
const mavenAudit = (workspaceRoot: string): { packages: InstalledPackage[]; unresolved: string[] } => {
    const packages: InstalledPackage[] = [];
    const unresolved: string[] = [];

    for (const module of readMavenModules(workspaceRoot)) {
        for (const dependency of module.dependencies) {
            if (dependency.group === undefined || dependency.artifact === undefined || dependency.version === undefined) {
                unresolved.push(dependency.group !== undefined && dependency.artifact !== undefined ? `${dependency.group}:${dependency.artifact}` : (dependency.unresolved ?? ""));

                continue;
            }

            packages.push({ isDev: false, name: `${dependency.group}:${dependency.artifact}`, version: dependency.version });
        }
    }

    for (const entry of readGradleLockEntries(workspaceRoot)) {
        packages.push({ isDev: false, name: `${entry.group}:${entry.artifact}`, version: entry.version });
    }

    return { packages: dedupe(packages), unresolved: [...new Set(unresolved)] };
};

/** Maven dependencies the audit could not check because the pom does not pin their version. */
export const mavenUnresolvedDependencies = (workspaceRoot: string): string[] => mavenAudit(workspaceRoot).unresolved;

export const lockedPackagesForEcosystem = (workspaceRoot: string, ecosystem: string): InstalledPackage[] => {
    if (canonicalEcosystem(ecosystem) === "Maven") {
        return mavenAudit(workspaceRoot).packages;
    }

    const lockfile = findEcosystemLockfile(workspaceRoot, ecosystem);

    if (!lockfile) {
        return [];
    }

    let content: string;

    try {
        content = readFileSync(lockfile, "utf8");
    } catch {
        return [];
    }

    const filename = lockfile.split(/[/\\]/).pop() ?? "";

    let parsed: InstalledPackage[];

    switch (filename) {
        case "Cargo.lock":
        case "poetry.lock":
        case "uv.lock": {
            parsed = parseTomlPackages(content);
            break;
        }
        case "composer.lock": {
            parsed = parseComposerLock(content);
            break;
        }
        case "Gemfile.lock": {
            parsed = parseGemfileLock(content);
            break;
        }
        case "go.sum": {
            parsed = parseGoSum(content);
            break;
        }
        case "mix.lock": {
            parsed = parseMixLockEntries(content).map((entry) => {
                return { isDev: false, name: entry.name, version: entry.version };
            });
            break;
        }
        case "Package.resolved": {
            parsed = parsePackageResolved(content);
            break;
        }
        case "packages.lock.json": {
            parsed = parseNuGetLockEntries(content).map((entry) => {
                return { isDev: false, name: entry.name, version: entry.version };
            });
            break;
        }
        case "Pipfile.lock": {
            parsed = parsePipfileLock(content);
            break;
        }
        case "pubspec.lock": {
            parsed = parsePubspecLock(content);
            break;
        }
        default: {
            return [];
        }
    }

    return dedupe(parsed);
};
