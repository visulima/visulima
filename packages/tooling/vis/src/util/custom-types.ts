import { writeJsonSync } from "@visulima/fs";
import { join, relative } from "@visulima/path";

import { isNewer, parseVersion } from "./catalog";
import { collectWorkspaceDirectories, readPkg } from "./workspace-deps";

/**
 * Custom-type families ported from syncpack. Each family pins a runtime /
 * package-manager version somewhere other than a `*Dependencies` block, so
 * the workspace-versions drift check would otherwise miss it. Adopting the
 * four classic strategies — `name@version`, `versionsByName`, `string`, and
 * the `devEngines` array — but lifted to a built-in registry instead of the
 * `customTypes` string-DSL.
 *
 * - `engines` — `pkg.engines.{node,pnpm,yarn,npm,...}` (versionsByName).
 * - `packageManager` — `pkg.packageManager` (`name@version` or `name@version+sha512.&lt;hash&gt;`).
 * - `volta` — `pkg.volta.{node,pnpm,yarn}` (versionsByName).
 * - `devEngines.runtime` / `devEngines.packageManager` — the proposed
 *   array form (`{ name, version, onFail? }[]`).
 */
export type CustomDepType = "devEngines.packageManager" | "devEngines.runtime" | "engines" | "packageManager" | "volta";

/**
 * One concrete declaration of a custom-type version pin, parallel to the
 * regular dep instance. The `customType` discriminates the write encoding
 * — `applyCustomTypeFixes` dispatches on it to write the right shape back.
 */
export interface CustomDepInstance {
    customType: CustomDepType;

    /** `node` / `pnpm` / `yarn` / `npm` — the field name within the block. */
    depName: string;
    packageDir: string;
    packageJsonPath: string;
    packageName: string | undefined;

    /**
     * Original value as written in the file. For `packageManager`, this
     * is the full `name@version+hash` form; for object/array fields,
     * it's the version field's value verbatim. Used by the fixer when
     * the file's encoding differs from `specifier`.
     */
    rawValue: string;

    /**
     * Version specifier as it would appear in a regular dep block.
     * Hash suffixes on `packageManager` (`pnpm@9.0.0+sha512...`) are
     * stripped here so semver compare works; the original raw string
     * is preserved on `rawValue` for the writer to reconstruct.
     */
    specifier: string;
}

export interface CustomTypeDriftIssue {
    canonicalSource: string;
    customType: CustomDepType;
    depName: string;
    /** What the fixer should write into `specifier`'s slot. */
    fix: string;
    packageDir: string;
    packageJsonPath: string;
    packageName: string | undefined;
    specifier: string;
}

export interface LintCustomTypesOptions {
    /** Restrict to a single dep name (e.g. just `node`). */
    dep?: string;
    /** Dep names to skip entirely (exact match against the `name` field). */
    ignoreDeps?: string[];
    /** Drift resolution; `catalog` is not meaningful for custom types and falls back to `highest`. */
    resolve?: "highest" | "lowest";
}

const ENGINES_FIELDS = ["engines", "volta"] as const;

/**
 * `volta.extends` points at another package.json to inherit Volta config from
 * — it's not a runtime version pin, so we skip it during iteration.
 */
const VOLTA_META_FIELDS = new Set(["extends"]);

const PACKAGE_MANAGER_REGEX = /^([@\w./-]+?)@([^+]+)(\+.+)?$/;

interface ParsedPackageManager {
    hash: string;
    name: string;
    version: string;
}

const parsePackageManager = (raw: string): ParsedPackageManager | undefined => {
    const match = PACKAGE_MANAGER_REGEX.exec(raw.trim());

    if (!match?.[1] || !match[2]) {
        return undefined;
    }

    return { hash: match[3] ?? "", name: match[1], version: match[2] };
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

interface DevEnginesEntry {
    name: string;
    onFail?: string;
    version?: string;
}

const isDevEnginesEntry = (value: unknown): value is DevEnginesEntry =>
    typeof value === "object" && value !== null && !Array.isArray(value) && typeof (value as DevEnginesEntry).name === "string";

/**
 * Walk every workspace package and emit a {@link CustomDepInstance} for each
 * custom-type version pin. Missing fields are silently skipped — workspaces
 * that don't use `volta` etc. shouldn't spam noise.
 *
 * Malformed entries (numeric `engines.node`, `packageManager: "pnpm"` with no
 * version, etc.) are dropped — better to lint nothing than emit half-real
 * data the drift detector would report as fake violations.
 */
export const iterateCustomTypeDeps = (workspaceRoot: string): CustomDepInstance[] => {
    const directories = collectWorkspaceDirectories(workspaceRoot);
    const out: CustomDepInstance[] = [];

    for (const directory of directories) {
        const packageJsonPath = join(workspaceRoot, directory, "package.json");
        const pkg = readPkg(packageJsonPath);

        if (!pkg) {
            continue;
        }

        const packageName = typeof pkg.name === "string" ? pkg.name : undefined;
        const packageDir = directory === "." ? "." : relative(workspaceRoot, join(workspaceRoot, directory));

        for (const field of ENGINES_FIELDS) {
            const block = pkg[field];

            if (!isPlainObject(block)) {
                continue;
            }

            for (const [depName, specifier] of Object.entries(block)) {
                // Skip non-string siblings (e.g. `engines.strict: true`, `volta.extends: "../base.json"`)
                // rather than dropping the whole block — a single typo shouldn't disable the lint.
                if (typeof specifier !== "string") {
                    continue;
                }

                if (field === "volta" && VOLTA_META_FIELDS.has(depName)) {
                    continue;
                }

                out.push({
                    customType: field,
                    depName,
                    packageDir,
                    packageJsonPath,
                    packageName,
                    rawValue: specifier,
                    specifier,
                });
            }
        }

        if (typeof pkg.packageManager === "string") {
            const parsed = parsePackageManager(pkg.packageManager);

            if (parsed) {
                out.push({
                    customType: "packageManager",
                    depName: parsed.name,
                    packageDir,
                    packageJsonPath,
                    packageName,
                    rawValue: pkg.packageManager,
                    specifier: parsed.version,
                });
            }
        }

        const { devEngines } = pkg;

        if (typeof devEngines === "object" && devEngines !== null && !Array.isArray(devEngines)) {
            for (const block of ["runtime", "packageManager"] as const) {
                const value = (devEngines as Record<string, unknown>)[block];

                if (value === undefined) {
                    continue;
                }

                const entries = Array.isArray(value) ? value : [value];

                for (const entry of entries) {
                    if (!isDevEnginesEntry(entry) || typeof entry.version !== "string") {
                        continue;
                    }

                    out.push({
                        customType: block === "runtime" ? "devEngines.runtime" : "devEngines.packageManager",
                        depName: entry.name,
                        packageDir,
                        packageJsonPath,
                        packageName,
                        rawValue: entry.version,
                        specifier: entry.version,
                    });
                }
            }
        }
    }

    return out;
};

const pinKey = (customType: CustomDepType, depName: string): string => `${customType} ${depName}`;

const pickCanonical = (instances: CustomDepInstance[], direction: "highest" | "lowest"): CustomDepInstance | undefined => {
    const sorted = [...instances].sort((a, b) => (a.packageName ?? a.packageDir).localeCompare(b.packageName ?? b.packageDir));
    let chosen: CustomDepInstance | undefined;

    for (const instance of sorted) {
        const parsed = parseVersion(instance.specifier);

        if (!parsed) {
            continue;
        }

        if (!chosen) {
            chosen = instance;

            continue;
        }

        const chosenParsed = parseVersion(chosen.specifier);

        if (!chosenParsed) {
            chosen = instance;

            continue;
        }

        const candidateIsHigher = isNewer(chosenParsed, parsed);
        const candidateIsLower = isNewer(parsed, chosenParsed);

        if ((direction === "highest" && candidateIsHigher) || (direction === "lowest" && candidateIsLower)) {
            chosen = instance;
        }
    }

    return chosen;
};

/**
 * Find drift across custom-type version pins. Each (customType × depName)
 * cluster is checked independently — `engines.node` and `volta.node`
 * intentionally don't cross-couple here. Use a versionGroup (item 5) to
 * couple them when that lands.
 */
export const lintCustomTypes = (instances: CustomDepInstance[], options: LintCustomTypesOptions = {}): CustomTypeDriftIssue[] => {
    const ignored = new Set(options.ignoreDeps);
    const resolve = options.resolve ?? "highest";
    const issues: CustomTypeDriftIssue[] = [];

    const eligible = instances.filter((instance) => {
        if (options.dep !== undefined && instance.depName !== options.dep) {
            return false;
        }

        return !ignored.has(instance.depName);
    });

    const grouped = new Map<string, CustomDepInstance[]>();

    for (const instance of eligible) {
        const key = pinKey(instance.customType, instance.depName);
        const list = grouped.get(key);

        if (list) {
            list.push(instance);
        } else {
            grouped.set(key, [instance]);
        }
    }

    for (const [, group] of grouped) {
        if (group.length < 2) {
            continue;
        }

        const distinct = new Set(group.map((instance) => instance.specifier));

        if (distinct.size <= 1) {
            continue;
        }

        const canonical = pickCanonical(group, resolve);

        if (!canonical) {
            continue;
        }

        for (const instance of group) {
            if (instance.specifier === canonical.specifier) {
                continue;
            }

            // Skip "any-version" pins like `engines.node: "*"` or `"current"` —
            // they're deliberately permissive, not drift to be normalised.
            if (parseVersion(instance.specifier) === undefined) {
                continue;
            }

            issues.push({
                canonicalSource: canonical.packageName ?? canonical.packageDir,
                customType: instance.customType,
                depName: instance.depName,
                fix: canonical.specifier,
                packageDir: instance.packageDir,
                packageJsonPath: instance.packageJsonPath,
                packageName: instance.packageName,
                specifier: instance.specifier,
            });
        }
    }

    return issues;
};

/**
 * Apply drift fixes back to the source package.json files. Each customType
 * has its own write encoding (engines.X = string, packageManager = `name@version`,
 * devEngines.runtime = `{name, version}` array). Hash suffixes on
 * `packageManager` are stripped on bump — content-integrity hashes are tied
 * to a specific package, not a version, so users must regenerate via their PM.
 *
 * The fixer preserves the input shape: a single-object `devEngines.runtime`
 * stays a single object after fix; an array stays an array. We mutate the
 * existing entry in place rather than normalising encodings.
 */
export const applyCustomTypeFixes = (issues: CustomTypeDriftIssue[]): string[] => {
    const byFile = new Map<string, CustomTypeDriftIssue[]>();

    for (const issue of issues) {
        const list = byFile.get(issue.packageJsonPath);

        if (list) {
            list.push(issue);
        } else {
            byFile.set(issue.packageJsonPath, [issue]);
        }
    }

    const written: string[] = [];

    for (const [filePath, pending] of byFile) {
        const pkg = readPkg(filePath);

        if (!pkg) {
            // File disappeared or became unreadable between iterate and apply.
            continue;
        }

        let didWrite = false;

        for (const issue of pending) {
            if (issue.customType === "engines" || issue.customType === "volta") {
                const block = pkg[issue.customType];

                if (isPlainObject(block)) {
                    (block as Record<string, string>)[issue.depName] = issue.fix;
                    didWrite = true;
                }

                continue;
            }

            if (issue.customType === "packageManager") {
                const raw = pkg.packageManager;

                if (typeof raw === "string") {
                    const parsed = parsePackageManager(raw);

                    if (parsed) {
                        pkg.packageManager = `${parsed.name}@${issue.fix}`;
                        didWrite = true;
                    }
                }

                continue;
            }

            const blockKey = issue.customType === "devEngines.runtime" ? "runtime" : "packageManager";
            const { devEngines } = pkg;

            if (!isPlainObject(devEngines)) {
                continue;
            }

            const block = devEngines[blockKey];

            if (block === undefined) {
                continue;
            }

            // Single-object form: mutating the entry already writes through to
            // `devEngines[blockKey]` since we hold the same reference. No
            // reassignment needed.
            const entries = Array.isArray(block) ? block : [block];

            for (const entry of entries) {
                if (isDevEnginesEntry(entry) && entry.name === issue.depName) {
                    entry.version = issue.fix;
                    didWrite = true;
                }
            }
        }

        if (didWrite) {
            writeJsonSync(filePath, pkg, { detectIndent: true, overwrite: true });
            written.push(filePath);
        }
    }

    return written;
};
