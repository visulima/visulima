/**
 * Package manager override/resolution management.
 *
 * Reads and writes the correct override field for each package manager:
 * - pnpm v10+: `overrides` in pnpm-workspace.yaml
 * - pnpm v9-: `pnpm.overrides` in package.json
 * - npm: `overrides` in package.json
 * - yarn/bun: `resolutions` in package.json
 *
 * Handles npm's `$<name>` reference syntax for direct dependencies
 * to avoid EOVERRIDE errors.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { isAccessibleSync, readYamlSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { coerce } from "semver";

// ── Types ───────────────────────────────────────────────────────────

type PackageManagerName = "bun" | "npm" | "pnpm" | "yarn";

interface PmInfo {
    name: PackageManagerName;
    version: string;
}

interface OverrideEntry {
    /** The original package name being overridden. */
    original: string;
    /** The override spec (e.g., "npm:@socketregistry/is-regex@^1"). */
    spec: string;
}

interface OverridesResult {
    /** Current overrides as a flat map. */
    overrides: Record<string, string>;
    /** Where the overrides are stored. */
    source: "package.json" | "pnpm-workspace.yaml";
}

interface ApplyOverridesResult {
    added: string[];
    updated: string[];
}

// ── Dep field ordering for smart placement ──────────────────────────

const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "peerDependenciesMeta", "optionalDependencies", "bundleDependencies"];
const OVERRIDE_FIELDS = ["overrides", "pnpm", "resolutions"];
const AFTER_FIELDS = ["engines", "files"];

// ── pnpm version helpers ────────────────────────────────────────────

/**
 * Returns true if pnpm version is 10+ (overrides go in pnpm-workspace.yaml).
 */
const isPnpmV10Plus = (version: string): boolean => {
    const major = coerce(version)?.major;

    return major !== undefined && major >= 10;
};

// ── Readers ─────────────────────────────────────────────────────────

/**
 * Reads existing overrides from pnpm-workspace.yaml (pnpm v10+).
 */
const readPnpmWorkspaceOverrides = (workspaceRoot: string): OverridesResult => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!isAccessibleSync(filePath)) {
        return { overrides: {}, source: "pnpm-workspace.yaml" };
    }

    try {
        const data = readYamlSync<{ overrides?: Record<string, string> }>(filePath);

        return {
            overrides: data?.overrides ?? {},
            source: "pnpm-workspace.yaml",
        };
    } catch {
        return { overrides: {}, source: "pnpm-workspace.yaml" };
    }
};

/**
 * Reads existing overrides from package.json.
 */
const readPkgJsonOverrides = (pkgJson: Record<string, unknown>, pm: PackageManagerName): OverridesResult => {
    let overrides: Record<string, string> = {};

    if (pm === "pnpm") {
        const pnpmObj = pkgJson.pnpm as Record<string, unknown> | undefined;

        overrides = (pnpmObj?.overrides as Record<string, string>) ?? {};
    } else if (pm === "yarn" || pm === "bun") {
        overrides = (pkgJson.resolutions as Record<string, string>) ?? {};
    } else {
        overrides = (pkgJson.overrides as Record<string, string>) ?? {};
    }

    return { overrides, source: "package.json" };
};

/**
 * Reads existing overrides for the detected package manager.
 */
const readOverrides = (workspaceRoot: string, pkgJson: Record<string, unknown>, pm: PmInfo): OverridesResult => {
    if (pm.name === "pnpm" && isPnpmV10Plus(pm.version)) {
        return readPnpmWorkspaceOverrides(workspaceRoot);
    }

    return readPkgJsonOverrides(pkgJson, pm.name);
};

// ── Writers ─────────────────────────────────────────────────────────

const findInsertIndex = (keys: string[], field: string): number => {
    const simpleField = field === "pnpm" ? "pnpm" : field;

    for (const f of OVERRIDE_FIELDS) {
        const idx = keys.indexOf(f);

        if (idx !== -1 && f !== simpleField) {
            return simpleField === "overrides" ? idx : idx + 1;
        }
    }

    let highest = -1;

    for (const f of DEP_FIELDS) {
        const idx = keys.indexOf(f);

        if (idx > highest) {
            highest = idx;
        }
    }

    if (highest !== -1) {
        return highest + 1;
    }

    for (const f of AFTER_FIELDS) {
        const idx = keys.indexOf(f);

        if (idx !== -1) {
            return idx;
        }
    }

    return keys.length;
};

const detectIndent = (content: string): string => {
    const match = /\n(\s+)/.exec(content);

    return match?.[1] ?? "  ";
};

/**
 * Writes overrides to pnpm-workspace.yaml (pnpm v10+).
 * Uses regex-based insertion/replacement to preserve comments and formatting.
 */
const writePnpmWorkspaceOverrides = (workspaceRoot: string, sorted: Record<string, string>): void => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!existsSync(filePath)) {
        return;
    }

    let content = readFileSync(filePath, "utf8");

    // Build YAML block for overrides
    const overrideLines = Object.entries(sorted)
        .map(([key, value]) => `  '${key}': '${value}'`)
        .join("\n");

    const overridesBlock = `overrides:\n${overrideLines}\n`;

    if (/^overrides:\s*$/m.test(content) || /^overrides:\s*\n/m.test(content)) {
        // Replace existing overrides block (everything until next top-level key or EOF)
        content = content.replace(/^overrides:\s*\n(?:(?:[ \t]+.*)?\n)*/m, overridesBlock);
    } else {
        // Append after catalogs/packages sections or at end
        content = `${content.trimEnd()}\n\n${overridesBlock}`;
    }

    writeFileSync(filePath, content);
};

/**
 * Writes overrides to package.json with smart field placement.
 */
const writePkgJsonOverrides = (pkgJsonPath: string, pkgJson: Record<string, unknown>, sorted: Record<string, string>, pm: PackageManagerName): void => {
    const raw = readFileSync(pkgJsonPath, "utf8");
    const indent = detectIndent(raw);

    if (pm === "pnpm") {
        const pnpmObj = (pkgJson.pnpm as Record<string, unknown>) ?? {};

        pnpmObj.overrides = sorted;

        if (!pkgJson.pnpm) {
            const keys = Object.keys(pkgJson);
            const idx = findInsertIndex(keys, "pnpm");
            const jsonEntries = Object.entries(pkgJson);

            jsonEntries.splice(idx, 0, ["pnpm", pnpmObj]);
            writeFileSync(pkgJsonPath, JSON.stringify(Object.fromEntries(jsonEntries), null, indent) + "\n");
        } else {
            pkgJson.pnpm = pnpmObj;
            writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, indent) + "\n");
        }
    } else {
        const field = pm === "yarn" || pm === "bun" ? "resolutions" : "overrides";

        if (!pkgJson[field]) {
            const keys = Object.keys(pkgJson);
            const idx = findInsertIndex(keys, field);
            const jsonEntries = Object.entries(pkgJson);

            jsonEntries.splice(idx, 0, [field, sorted]);
            writeFileSync(pkgJsonPath, JSON.stringify(Object.fromEntries(jsonEntries), null, indent) + "\n");
        } else {
            pkgJson[field] = sorted;
            writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, indent) + "\n");
        }
    }
};

/**
 * Applies override entries and writes to the correct file for the PM.
 *
 * - pnpm v10+: writes to pnpm-workspace.yaml
 * - pnpm v9-: writes to package.json pnpm.overrides
 * - npm: writes to package.json overrides (with $-ref for direct deps)
 * - yarn/bun: writes to package.json resolutions
 */
const applyOverrides = (workspaceRoot: string, pkgJsonPath: string, entries: OverrideEntry[], pm: PmInfo): ApplyOverridesResult => {
    const raw = readFileSync(pkgJsonPath, "utf8");
    const pkgJson = JSON.parse(raw) as Record<string, unknown>;

    const { overrides: existing, source } = readOverrides(workspaceRoot, pkgJson, pm);
    const added: string[] = [];
    const updated: string[] = [];

    // Collect direct dependency names for npm $-reference
    const directDeps = new Set<string>();

    if (pm.name === "npm") {
        for (const field of ["dependencies", "devDependencies"] as const) {
            const deps = pkgJson[field] as Record<string, string> | undefined;

            if (deps) {
                for (const name of Object.keys(deps)) {
                    directDeps.add(name);
                }
            }
        }
    }

    for (const entry of entries) {
        const oldSpec = existing[entry.original];
        let newSpec = entry.spec;

        if (pm.name === "npm" && directDeps.has(entry.original)) {
            newSpec = `$${entry.original}`;
        }

        if (oldSpec === newSpec) {
            continue;
        }

        if (oldSpec) {
            updated.push(entry.original);
        } else {
            added.push(entry.original);
        }

        existing[entry.original] = newSpec;
    }

    if (added.length === 0 && updated.length === 0) {
        return { added, updated };
    }

    const sorted = Object.fromEntries(Object.entries(existing).sort(([a], [b]) => a.localeCompare(b)));

    if (source === "pnpm-workspace.yaml") {
        writePnpmWorkspaceOverrides(workspaceRoot, sorted);
    } else {
        writePkgJsonOverrides(pkgJsonPath, pkgJson, sorted, pm.name);
    }

    return { added, updated };
};

// ── Lockfile scanning ───────────────────────────────────────────────

const readLockfileText = (workspaceRoot: string, pm: PackageManagerName): string => {
    const lockfileNames: Record<string, string[]> = {
        bun: ["bun.lock", "bun.lockb"],
        npm: ["package-lock.json"],
        pnpm: ["pnpm-lock.yaml"],
        yarn: ["yarn.lock"],
    };

    for (const name of lockfileNames[pm] ?? []) {
        const filePath = join(workspaceRoot, name);

        if (existsSync(filePath)) {
            try {
                return readFileSync(filePath, "utf8");
            } catch {
                return "";
            }
        }
    }

    return "";
};

const lockfileContainsPackage = (lockText: string, packageName: string, pm: PackageManagerName): boolean => {
    if (!lockText) {
        return false;
    }

    switch (pm) {
        case "npm": {
            return lockText.includes(`"${packageName}":`);
        }

        case "pnpm": {
            return lockText.includes(`${packageName}@`) || lockText.includes(`'${packageName}'`);
        }

        case "yarn": {
            return lockText.includes(`${packageName}@`);
        }

        case "bun": {
            return lockText.includes(`"${packageName}":`) || lockText.includes(`${packageName}@`);
        }

        default: {
            return false;
        }
    }
};

export type { ApplyOverridesResult, OverrideEntry, OverridesResult, PackageManagerName, PmInfo };
export { applyOverrides, lockfileContainsPackage, readLockfileText, readOverrides };
