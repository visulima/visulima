/**
 * Per-ecosystem lockfile readers for `vis audit`.
 *
 * Each reader returns `{ name, version }[]` for a non-npm OSV ecosystem.
 * Parsers are regex/JSON-only to avoid pulling a heavyweight TOML/XML
 * runtime dep — lockfile formats are stable and our needs are narrow.
 */
import { existsSync, readFileSync } from "node:fs";

import { join } from "@visulima/path";

import type { InstalledPackage } from "./dependency-scan";

const ECOSYSTEM_LOCKFILES: Record<string, string[]> = {
    "crates.io": ["Cargo.lock"],
    Go: ["go.sum"],
    Maven: ["gradle.lockfile", "pom.xml"],
    PyPI: ["uv.lock", "poetry.lock", "Pipfile.lock"],
    RubyGems: ["Gemfile.lock"],
};

const ECOSYSTEM_ALIASES: Record<string, string> = {
    cargo: "crates.io",
    "crates.io": "crates.io",
    go: "Go",
    maven: "Maven",
    npm: "npm",
    pypi: "PyPI",
    rubygems: "RubyGems",
};

export const canonicalEcosystem = (raw: string): string => ECOSYSTEM_ALIASES[raw.toLowerCase()] ?? raw;

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

const POM_DEP_BLOCK_RE = /<dependency>([\s\S]*?)<\/dependency>/g;
const POM_GROUP_ID_RE = /<groupId>\s*([^<\s]+)\s*<\/groupId>/;
const POM_ARTIFACT_ID_RE = /<artifactId>\s*([^<\s]+)\s*<\/artifactId>/;
const POM_VERSION_RE = /<version>\s*([^<\s]+)\s*<\/version>/;

const parsePomXml = (content: string): InstalledPackage[] => {
    const entries: InstalledPackage[] = [];

    for (const match of content.matchAll(POM_DEP_BLOCK_RE)) {
        const block = match[1] ?? "";
        const groupId = POM_GROUP_ID_RE.exec(block)?.[1];
        const artifactId = POM_ARTIFACT_ID_RE.exec(block)?.[1];
        const version = POM_VERSION_RE.exec(block)?.[1];

        if (!groupId || !artifactId || !version || version.startsWith("${")) {
            continue;
        }

        entries.push({ isDev: false, name: `${groupId}:${artifactId}`, version });
    }

    return entries;
};

const parseGradleLockfile = (content: string): InstalledPackage[] => {
    const entries: InstalledPackage[] = [];

    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (trimmed.length === 0 || trimmed.startsWith("#")) {
            continue;
        }

        const eqIndex = trimmed.indexOf("=");
        const coords = eqIndex === -1 ? trimmed : trimmed.slice(0, eqIndex);
        const parts = coords.split(":");

        if (parts.length < 3) {
            continue;
        }

        const [groupId, artifactId, version] = parts;

        if (!groupId || !artifactId || !version) {
            continue;
        }

        entries.push({ isDev: false, name: `${groupId}:${artifactId}`, version });
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
                const [, name, version] = match;

                if (name && version) {
                    entries.push({ isDev: false, name, version });
                }
            }
        }
    }

    return entries;
};

export const lockedPackagesForEcosystem = (workspaceRoot: string, ecosystem: string): InstalledPackage[] => {
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
        case "Gemfile.lock": {
            parsed = parseGemfileLock(content);
            break;
        }
        case "go.sum": {
            parsed = parseGoSum(content);
            break;
        }
        case "gradle.lockfile": {
            parsed = parseGradleLockfile(content);
            break;
        }
        case "Pipfile.lock": {
            parsed = parsePipfileLock(content);
            break;
        }
        case "pom.xml": {
            parsed = parsePomXml(content);
            break;
        }
        default: {
            return [];
        }
    }

    return dedupe(parsed);
};
