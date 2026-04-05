/**
 * Package manager override/resolution management.
 *
 * Reads and writes the correct override field for each package manager:
 * - npm: `overrides` in package.json
 * - pnpm: `pnpm.overrides` in package.json
 * - yarn/bun: `resolutions` in package.json
 *
 * Handles npm's `$<name>` reference syntax for direct dependencies
 * to avoid EOVERRIDE errors.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";

// ── Types ───────────────────────────────────────────────────────────

type PackageManagerName = "bun" | "npm" | "pnpm" | "yarn";

interface OverrideEntry {
    /** The original package name being overridden. */
    original: string;
    /** The override spec (e.g., "npm:@socketregistry/is-regex@^1"). */
    spec: string;
}

interface OverridesResult {
    /** The field name in package.json (overrides, pnpm.overrides, or resolutions). */
    field: string;
    /** Current overrides as a flat map. */
    overrides: Record<string, string>;
}

interface ApplyOverridesResult {
    added: string[];
    updated: string[];
}

// ── Dep field ordering for smart placement ──────────────────────────

const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "peerDependenciesMeta", "optionalDependencies", "bundleDependencies"];
const OVERRIDE_FIELDS = ["overrides", "pnpm", "resolutions"];
const AFTER_FIELDS = ["engines", "files"];

// ── Readers ─────────────────────────────────────────────────────────

const getOverridesField = (pm: PackageManagerName): string => {
    switch (pm) {
        case "pnpm": {
            return "pnpm.overrides";
        }

        case "yarn":
        case "bun": {
            return "resolutions";
        }

        default: {
            return "overrides";
        }
    }
};

const readOverrides = (pkgJson: Record<string, unknown>, pm: PackageManagerName): OverridesResult => {
    const field = getOverridesField(pm);

    let overrides: Record<string, string> = {};

    if (pm === "pnpm") {
        const pnpmObj = pkgJson.pnpm as Record<string, unknown> | undefined;

        overrides = (pnpmObj?.overrides as Record<string, string>) ?? {};
    } else {
        const fieldName = field === "pnpm.overrides" ? "overrides" : field;

        overrides = (pkgJson[fieldName] as Record<string, string>) ?? {};
    }

    return { field, overrides };
};

// ── Writers ─────────────────────────────────────────────────────────

/**
 * Finds the best insert position for a new field in package.json,
 * placing it near dependency-related fields.
 */
const findInsertIndex = (keys: string[], field: string): number => {
    const simpleField = field === "pnpm.overrides" ? "pnpm" : field;

    // Try to place near existing override fields
    for (const f of OVERRIDE_FIELDS) {
        const idx = keys.indexOf(f);

        if (idx !== -1 && f !== simpleField) {
            return simpleField === "overrides" ? idx : idx + 1;
        }
    }

    // Place after the highest dep field
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

    // Place before engines/files
    for (const f of AFTER_FIELDS) {
        const idx = keys.indexOf(f);

        if (idx !== -1) {
            return idx;
        }
    }

    return keys.length;
};

/**
 * Detects the indent style used in a JSON string.
 */
const detectIndent = (content: string): string => {
    const match = /\n(\s+)/.exec(content);

    return match?.[1] ?? "  ";
};

/**
 * Applies override entries to a package.json object and writes it to disk.
 * Handles smart field placement and npm $-reference syntax.
 */
const applyOverrides = (
    pkgJsonPath: string,
    entries: OverrideEntry[],
    pm: PackageManagerName,
): ApplyOverridesResult => {
    const raw = readFileSync(pkgJsonPath, "utf8");
    const indent = detectIndent(raw);
    const pkgJson = JSON.parse(raw) as Record<string, unknown>;

    const { field, overrides: existing } = readOverrides(pkgJson, pm);
    const added: string[] = [];
    const updated: string[] = [];

    // Collect direct dependency names for npm $-reference
    const directDeps = new Set<string>();

    if (pm === "npm") {
        const deps = pkgJson.dependencies as Record<string, string> | undefined;
        const devDeps = pkgJson.devDependencies as Record<string, string> | undefined;

        if (deps) {
            for (const name of Object.keys(deps)) {
                directDeps.add(name);
            }
        }

        if (devDeps) {
            for (const name of Object.keys(devDeps)) {
                directDeps.add(name);
            }
        }
    }

    for (const entry of entries) {
        const oldSpec = existing[entry.original];
        let newSpec = entry.spec;

        // npm requires $<name> reference for direct deps to avoid EOVERRIDE
        if (pm === "npm" && directDeps.has(entry.original)) {
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

    // Sort overrides alphabetically
    const sorted = Object.fromEntries(Object.entries(existing).sort(([a], [b]) => a.localeCompare(b)));

    // Write the overrides to the correct field
    if (pm === "pnpm") {
        const pnpmObj = (pkgJson.pnpm as Record<string, unknown>) ?? {};

        pnpmObj.overrides = sorted;

        if (!pkgJson.pnpm) {
            // Smart placement for new pnpm field
            const keys = Object.keys(pkgJson);
            const idx = findInsertIndex(keys, "pnpm");
            const entries = Object.entries(pkgJson);

            entries.splice(idx, 0, ["pnpm", pnpmObj]);
            writeFileSync(pkgJsonPath, JSON.stringify(Object.fromEntries(entries), null, indent) + "\n");
        } else {
            pkgJson.pnpm = pnpmObj;
            writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, indent) + "\n");
        }
    } else {
        const simpleField = field === "pnpm.overrides" ? "overrides" : field;

        if (!pkgJson[simpleField]) {
            // Smart placement for new field
            const keys = Object.keys(pkgJson);
            const idx = findInsertIndex(keys, simpleField);
            const entries = Object.entries(pkgJson);

            entries.splice(idx, 0, [simpleField, sorted]);
            writeFileSync(pkgJsonPath, JSON.stringify(Object.fromEntries(entries), null, indent) + "\n");
        } else {
            pkgJson[simpleField] = sorted;
            writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, indent) + "\n");
        }
    }

    return { added, updated };
};

/**
 * Reads the lockfile text for a given workspace root (if it exists).
 * Returns the raw text for regex-based package name scanning.
 */
const readLockfileText = (workspaceRoot: string, pm: PackageManagerName): string => {
    const lockfileNames: Record<string, string[]> = {
        bun: ["bun.lock", "bun.lockb"],
        npm: ["package-lock.json"],
        pnpm: ["pnpm-lock.yaml"],
        yarn: ["yarn.lock"],
    };

    const names = lockfileNames[pm] ?? [];

    for (const name of names) {
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

/**
 * Checks if a package name appears in lockfile text using PM-specific patterns.
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
            // bun.lock can be JSON (package-lock-like) or yarn.lock-like
            return lockText.includes(`"${packageName}":`) || lockText.includes(`${packageName}@`);
        }

        default: {
            return false;
        }
    }
};

export type { ApplyOverridesResult, OverrideEntry, OverridesResult, PackageManagerName };
export { applyOverrides, getOverridesField, lockfileContainsPackage, readLockfileText, readOverrides };
