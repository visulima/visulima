/**
 * Package manager override and resolution management.
 *
 * Handles the correct override location for each package manager:
 * - **pnpm v10+**: top-level `overrides` in `pnpm-workspace.yaml`
 * - **pnpm v9-**: `pnpm.overrides` in `package.json`
 * - **npm**: `overrides` in `package.json` (uses `$&lt;name>` references
 *   for direct dependencies to avoid EOVERRIDE errors)
 * - **yarn / bun**: `resolutions` in `package.json`
 *
 * All overrides are root-level — no PM supports per-workspace overrides.
 * @see https://pnpm.io/settings — pnpm v10+ workspace settings
 * @see https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides
 * @see https://yarnpkg.com/configuration/manifest#resolutions
 * @see https://bun.sh/docs/pm/overrides
 */

import { isAccessibleSync, readFileSync, writeFileSync } from "@visulima/fs";
import { readYamlSync } from "@visulima/fs/yaml";
import { join } from "@visulima/path";
import { coerce } from "semver";

import { resolveIndentForFile } from "../util/editorconfig";

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
    /** Current overrides — values may be strings or nested objects (npm supports nested overrides). */
    overrides: Record<string, string | Record<string, string>>;
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

/**
 * Returns `true` when the pnpm major version is >= 10 (overrides moved to `pnpm-workspace.yaml`).
 *
 * pnpm v10+ reads overrides exclusively from `pnpm-workspace.yaml`; v9 and
 * earlier read them from `package.json#pnpm.overrides`. pnpm v11 removes the
 * package.json fallback entirely — settings are no longer read from the `pnpm`
 * field in `package.json` — so the v9- branch in {@link readPkgJsonOverrides}
 * is strictly legacy support for projects still pinned to pnpm 9.
 */
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
        const data = readYamlSync(filePath) as { overrides?: Record<string, string | Record<string, string>> } | undefined;

        return { overrides: data?.overrides ?? {}, source: "pnpm-workspace.yaml" };
    } catch {
        return { overrides: {}, source: "pnpm-workspace.yaml" };
    }
};

/**
 * Reads existing overrides from `package.json` for npm, pnpm v9-, yarn, or bun.
 */
const readPkgJsonOverrides = (pkgJson: Record<string, unknown>, pm: PackageManagerName): OverridesResult => {
    let overrides: Record<string, string | Record<string, string>> = {};

    if (pm === "pnpm") {
        overrides = ((pkgJson.pnpm as Record<string, unknown> | undefined)?.overrides as typeof overrides) ?? {};
    } else if (pm === "yarn" || pm === "bun") {
        overrides = (pkgJson.resolutions as typeof overrides) ?? {};
    } else {
        overrides = (pkgJson.overrides as typeof overrides) ?? {};
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
    const simpleField = field;

    for (const f of OVERRIDE_FIELDS) {
        const index = keys.indexOf(f);

        if (index !== -1 && f !== simpleField) {
            return simpleField === "overrides" ? index : index + 1;
        }
    }

    let highest = -1;

    for (const f of DEP_FIELDS) {
        const index = keys.indexOf(f);

        if (index > highest) {
            highest = index;
        }
    }

    if (highest !== -1) {
        return highest + 1;
    }

    for (const f of AFTER_FIELDS) {
        const index = keys.indexOf(f);

        if (index !== -1) {
            return index;
        }
    }

    return keys.length;
};

/**
 * Writes overrides to `pnpm-workspace.yaml` (pnpm v10+).
 *
 * Uses regex-based insertion/replacement instead of full YAML
 * serialization to preserve comments and custom formatting.
 */
const writePnpmWorkspaceOverrides = (workspaceRoot: string, sorted: Record<string, string>): void => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!isAccessibleSync(filePath)) {
        throw new Error(`pnpm-workspace.yaml not found at ${filePath}. Cannot write overrides for pnpm v10+.`);
    }

    let content = readFileSync(filePath);

    const overrideLines = Object.entries(sorted)
        .map(([key, value]) => `  '${key}': '${value}'`)
        .join("\n");
    const overridesBlock = `overrides:\n${overrideLines}\n`;

    content =
        /^overrides:\s*$/m.test(content) || /^overrides:\s*\n/m.test(content)
            ? content.replace(/^overrides:\s*\n(?:(?:[ \t].*)?\n)*/m, overridesBlock)
            : `${content.trimEnd()}\n\n${overridesBlock}`;

    writeFileSync(filePath, content);
};

/**
 * Writes overrides to `package.json` with smart field placement.
 *
 * When adding a new field, it is positioned near existing dependency fields
 * rather than appended to the end of the file.
 */
const writePkgJsonOverrides = (
    pkgJsonPath: string,
    pkgJson: Record<string, unknown>,
    sorted: Record<string, string>,
    pm: PackageManagerName,
    useEditorconfig?: boolean,
): void => {
    const raw = readFileSync(pkgJsonPath);
    const indent = resolveIndentForFile(pkgJsonPath, raw, { useEditorconfig });

    if (pm === "pnpm") {
        const pnpmObject = (pkgJson.pnpm as Record<string, unknown>) ?? {};

        pnpmObject.overrides = sorted;

        if (pkgJson.pnpm) {
            pkgJson.pnpm = pnpmObject;
            writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, indent)}\n`);
        } else {
            const keys = Object.keys(pkgJson);
            const index = findInsertIndex(keys, "pnpm");
            const jsonEntries = Object.entries(pkgJson);

            jsonEntries.splice(index, 0, ["pnpm", pnpmObject]);
            writeFileSync(pkgJsonPath, `${JSON.stringify(Object.fromEntries(jsonEntries), null, indent)}\n`);
        }
    } else {
        const field = pm === "yarn" || pm === "bun" ? "resolutions" : "overrides";

        if (pkgJson[field]) {
            pkgJson[field] = sorted;
            writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, indent)}\n`);
        } else {
            const keys = Object.keys(pkgJson);
            const index = findInsertIndex(keys, field);
            const jsonEntries = Object.entries(pkgJson);

            jsonEntries.splice(index, 0, [field, sorted]);
            writeFileSync(pkgJsonPath, `${JSON.stringify(Object.fromEntries(jsonEntries), null, indent)}\n`);
        }
    }
};

/**
 * Applies override entries to the correct config file for the package manager.
 *
 * For npm, direct dependencies use `$&lt;name>` reference syntax to avoid
 * npm's EOVERRIDE error when an override conflicts with a direct dep range.
 * @param workspaceRoot Absolute path to the workspace root directory.
 * @param pkgJsonPath Absolute path to the root `package.json`.
 * @param entries Override entries to apply.
 * @param pm Package manager name and version.
 * @returns Lists of added and updated package names.
 */
const applyOverrides = (workspaceRoot: string, pkgJsonPath: string, entries: OverrideEntry[], pm: PmInfo, useEditorconfig?: boolean): ApplyOverridesResult => {
    const raw = readFileSync(pkgJsonPath);
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

        // Preserve nested override objects (npm supports { "pkg": { "dep": "ver" } })
        if (typeof oldSpec === "object") {
            continue;
        }

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
        writePnpmWorkspaceOverrides(workspaceRoot, sorted as Record<string, string>);
    } else {
        writePkgJsonOverrides(pkgJsonPath, pkgJson, sorted as Record<string, string>, pm.name, useEditorconfig);
    }

    return { added, updated };
};

/**
 * Reads the lockfile text for a workspace root.
 *
 * Returns the raw text content for regex-based package name scanning.
 * Falls back to an empty string if the lockfile is missing or unreadable.
 * @param workspaceRoot Absolute path to the workspace root.
 * @param pm Package manager name (determines lockfile name).
 */
const readLockfileText = (workspaceRoot: string, pm: PackageManagerName): string => {
    const lockfileNames: Record<string, string[]> = {
        bun: ["bun.lock"],
        npm: ["npm-shrinkwrap.json", "package-lock.json"],
        pnpm: ["pnpm-lock.yaml"],
        yarn: ["yarn.lock"],
    };

    for (const name of lockfileNames[pm] ?? []) {
        const filePath = join(workspaceRoot, name);

        try {
            return readFileSync(filePath);
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
 * @param lockText Raw lockfile content.
 * @param packageName Package name to search for.
 * @param pm Package manager name (determines the search pattern).
 */
const lockfileContainsPackage = (lockText: string, packageName: string, pm: PackageManagerName): boolean => {
    if (!lockText) {
        return false;
    }

    const escaped = packageName.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

    switch (pm) {
        case "bun": {
            return lockText.includes(`"${packageName}":`) || new RegExp(String.raw`(^|\s|[",])${escaped}@`, "m").test(lockText);
        }

        case "npm": {
            return lockText.includes(`"${packageName}":`) || lockText.includes(`"node_modules/${packageName}":`);
        }

        case "pnpm": {
            // Match both resolved entries (package@version:) and dependency entries ('package':)
            return new RegExp(String.raw`(^|\s|['"/])${escaped}(@|['"]?:)`, "m").test(lockText);
        }

        case "yarn": {
            return new RegExp(String.raw`(^|\s|[",])${escaped}@`, "m").test(lockText);
        }

        default: {
            return false;
        }
    }
};

export type { ApplyOverridesResult, OverrideEntry, OverridesResult, PackageManagerName, PmInfo };
export { applyOverrides, lockfileContainsPackage, readLockfileText, readOverrides };
