/**
 * Package manager override and resolution management.
 *
 * Handles the correct override location for each package manager:
 * - **pnpm v10+**: top-level `overrides` in `pnpm-workspace.yaml`
 * - **pnpm v9-**: `pnpm.overrides` in `package.json`
 * - **npm**: `overrides` in `package.json` (uses `$<name>` references
 *   for direct dependencies to avoid EOVERRIDE errors)
 * - **yarn / bun**: `resolutions` in `package.json`
 *
 * All overrides are root-level — no PM supports per-workspace overrides.
 *
 * @see https://pnpm.io/settings — pnpm v10+ workspace settings
 * @see https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides
 * @see https://yarnpkg.com/configuration/manifest#resolutions
 * @see https://bun.sh/docs/pm/overrides
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { isAccessibleSync, readYamlSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { coerce } from "semver";

/** Supported package manager names. */
type PackageManagerName = "bun" | "npm" | "pnpm" | "yarn";

/** Package manager identity with version for PM-specific behavior. */
interface PmInfo {
    name: PackageManagerName;
    version: string;
}

/** A single override entry mapping an original package to its replacement spec. */
interface OverrideEntry {
    /** The original package name being overridden (e.g., `"is-regex"`). */
    original: string;
    /** The npm alias spec (e.g., `"npm:@socketregistry/is-regex@^1"`). */
    spec: string;
}

/** Result of reading existing overrides from the project. */
interface OverridesResult {
    /** Current overrides as a flat `{ packageName: spec }` map. */
    overrides: Record<string, string>;
    /** The file where overrides are stored. */
    source: "package.json" | "pnpm-workspace.yaml";
}

/** Result of applying override entries. */
interface ApplyOverridesResult {
    /** Package names that were newly added. */
    added: string[];
    /** Package names whose specs were changed. */
    updated: string[];
}

const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "peerDependenciesMeta", "optionalDependencies", "bundleDependencies"];
const OVERRIDE_FIELDS = ["overrides", "pnpm", "resolutions"];
const AFTER_FIELDS = ["engines", "files"];

/** Returns `true` when the pnpm major version is >= 10 (overrides moved to `pnpm-workspace.yaml`). */
const isPnpmV10Plus = (version: string): boolean => {
    const major = coerce(version)?.major;

    return major !== undefined && major >= 10;
};

/**
 * Reads existing overrides from `pnpm-workspace.yaml`.
 * Used for pnpm v10+ where the `overrides` key is a top-level YAML field.
 */
const readPnpmWorkspaceOverrides = (workspaceRoot: string): OverridesResult => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!isAccessibleSync(filePath)) {
        return { overrides: {}, source: "pnpm-workspace.yaml" };
    }

    try {
        const data = readYamlSync<{ overrides?: Record<string, string> }>(filePath);

        return { overrides: data?.overrides ?? {}, source: "pnpm-workspace.yaml" };
    } catch {
        return { overrides: {}, source: "pnpm-workspace.yaml" };
    }
};

/**
 * Reads existing overrides from `package.json` for npm, pnpm v9-, yarn, or bun.
 */
const readPkgJsonOverrides = (pkgJson: Record<string, unknown>, pm: PackageManagerName): OverridesResult => {
    let overrides: Record<string, string> = {};

    if (pm === "pnpm") {
        overrides = ((pkgJson.pnpm as Record<string, unknown> | undefined)?.overrides as Record<string, string>) ?? {};
    } else if (pm === "yarn" || pm === "bun") {
        overrides = (pkgJson.resolutions as Record<string, string>) ?? {};
    } else {
        overrides = (pkgJson.overrides as Record<string, string>) ?? {};
    }

    return { overrides, source: "package.json" };
};

/**
 * Reads existing overrides for the detected package manager, choosing
 * `pnpm-workspace.yaml` for pnpm v10+ and `package.json` for everything else.
 */
const readOverrides = (workspaceRoot: string, pkgJson: Record<string, unknown>, pm: PmInfo): OverridesResult => {
    if (pm.name === "pnpm" && isPnpmV10Plus(pm.version)) {
        return readPnpmWorkspaceOverrides(workspaceRoot);
    }

    return readPkgJsonOverrides(pkgJson, pm.name);
};

/**
 * Finds the best insert position for a new field in `package.json`,
 * placing it near dependency-related fields for readability.
 */
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

/** Detects the indent style used in a JSON string. */
const detectIndent = (content: string): string => {
    const match = /\n(\s+)/.exec(content);

    return match?.[1] ?? "  ";
};

/**
 * Writes overrides to `pnpm-workspace.yaml` (pnpm v10+).
 *
 * Uses regex-based insertion/replacement instead of full YAML
 * serialization to preserve comments and custom formatting.
 */
const writePnpmWorkspaceOverrides = (workspaceRoot: string, sorted: Record<string, string>): void => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!existsSync(filePath)) {
        return;
    }

    let content = readFileSync(filePath, "utf8");

    const overrideLines = Object.entries(sorted)
        .map(([key, value]) => `  '${key}': '${value}'`)
        .join("\n");
    const overridesBlock = `overrides:\n${overrideLines}\n`;

    if (/^overrides:\s*$/m.test(content) || /^overrides:\s*\n/m.test(content)) {
        content = content.replace(/^overrides:\s*\n(?:(?:[ \t]+.*)?\n)*/m, overridesBlock);
    } else {
        content = `${content.trimEnd()}\n\n${overridesBlock}`;
    }

    writeFileSync(filePath, content);
};

/**
 * Writes overrides to `package.json` with smart field placement.
 *
 * When adding a new field, it is positioned near existing dependency fields
 * rather than appended to the end of the file.
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
 * Applies override entries to the correct config file for the package manager.
 *
 * For npm, direct dependencies use `$<name>` reference syntax to avoid
 * npm's EOVERRIDE error when an override conflicts with a direct dep range.
 *
 * @param workspaceRoot - Absolute path to the workspace root directory.
 * @param pkgJsonPath - Absolute path to the root `package.json`.
 * @param entries - Override entries to apply.
 * @param pm - Package manager name and version.
 * @returns Lists of added and updated package names.
 */
const applyOverrides = (workspaceRoot: string, pkgJsonPath: string, entries: OverrideEntry[], pm: PmInfo): ApplyOverridesResult => {
    const raw = readFileSync(pkgJsonPath, "utf8");
    const pkgJson = JSON.parse(raw) as Record<string, unknown>;

    const { overrides: existing, source } = readOverrides(workspaceRoot, pkgJson, pm);
    const added: string[] = [];
    const updated: string[] = [];

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

/**
 * Reads the lockfile text for a workspace root.
 *
 * Returns the raw text content for regex-based package name scanning.
 * Falls back to an empty string if the lockfile is missing or unreadable.
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @param pm - Package manager name (determines lockfile name).
 */
const readLockfileText = (workspaceRoot: string, pm: PackageManagerName): string => {
    const lockfileNames: Record<string, string[]> = {
        bun: ["bun.lock", "bun.lockb"],
        npm: ["package-lock.json"],
        pnpm: ["pnpm-lock.yaml"],
        yarn: ["yarn.lock"],
    };

    for (const name of lockfileNames[pm] ?? []) {
        const filePath = join(workspaceRoot, name);

        try {
            return readFileSync(filePath, "utf8");
        } catch {
            continue;
        }
    }

    return "";
};

/**
 * Checks if a package name appears in the lockfile text using PM-specific string patterns.
 *
 * This avoids parsing the entire lockfile — a single `string.includes()` is
 * sufficient for presence checks.
 *
 * @param lockText - Raw lockfile content.
 * @param packageName - Package name to search for.
 * @param pm - Package manager name (determines the search pattern).
 */
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
