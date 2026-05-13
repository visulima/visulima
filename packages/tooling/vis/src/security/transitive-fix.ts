/**
 * Transitive override writers for `vis audit --fix-transitive`.
 *
 * Each package manager has its own override surface — pnpm writes to
 * `pnpm-workspace.yaml` (v10+) or `package.json` (v9 and earlier), npm
 * and bun write to `package.json#overrides`, and yarn (both classic and
 * berry) writes to `package.json#resolutions`. This module abstracts
 * over those differences so callers pass a vendor-neutral
 * `OverridePlan` and get back a deterministic write result.
 *
 * Writes are atomic — the file is staged to a `.tmp` sibling and
 * renamed into place via `fs.renameSync`, which is atomic on every POSIX
 * filesystem and on NTFS. A crash mid-write leaves the original file
 * intact.
 *
 * Existing entries are merged, never replaced: the writer reads the
 * current overrides, unions them with the plan, and re-emits with
 * sorted keys so the diff stays reviewable across runs.
 */

import { renameSync, unlinkSync, writeFileSync } from "node:fs";

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { readYamlSync } from "@visulima/fs/yaml";
import { join } from "@visulima/path";
import { coerce } from "semver";

import { resolveIndentForFile } from "../util/editorconfig";

/** Package managers that support transitive overrides. */
export type TransitiveFixPm = "bun" | "npm" | "pnpm" | "yarn";

/** Package manager identity required to choose the override surface. */
export interface TransitiveFixPmInfo {
    name: TransitiveFixPm;
    /** PM version string. Used to gate pnpm v10+ workspace-yaml behavior. */
    version: string;
}

/** A single override: pin transitive `&lt;packageName>` to `&lt;spec>`. */
export interface OverrideEntry {
    packageName: string;
    /** Version spec (`"^1.2.3"`, `"1.2.3"`, `">=1.2.3"`, etc). */
    spec: string;
}

/** Plan produced from audit findings. */
export interface OverridePlan {
    entries: OverrideEntry[];
}

/** Where the resolved override is written. */
export type OverrideSurface = "package.json#overrides" | "package.json#pnpm.overrides" | "package.json#resolutions" | "pnpm-workspace.yaml";

/**
 * Per-entry classification after merging with the current state.
 *
 * `unchanged` entries are emitted so callers can show "0 changes" in
 * dry-run mode without losing the per-package context.
 */
export type OverrideEntryStatus = "added" | "unchanged" | "updated";

export interface OverrideEntryResult extends OverrideEntry {
    /** Existing spec before the plan applied, when present. */
    previousSpec?: string;
    status: OverrideEntryStatus;
}

export interface ApplyOverridesResult {
    /** True when at least one entry was added or updated. */
    changed: boolean;
    /** Per-entry merge classification. */
    entries: OverrideEntryResult[];
    /** Absolute path of the file that will be (or was) written. */
    filePath: string;
    /** Final content that would be written. Always populated, even in dry-run. */
    nextContent: string;
    /** Existing file content (empty string when the file does not yet exist). */
    previousContent: string;
    /** Which override surface this PM uses. */
    surface: OverrideSurface;
}

const PNPM_V10_PLUS = (version: string): boolean => {
    const major = coerce(version)?.major;

    return major !== undefined && major >= 10;
};

const sortByKey = (record: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

const stringifyJson = (value: Record<string, unknown>, indent: string): string => `${JSON.stringify(value, undefined, indent)}\n`;

/**
 * Compute where the override surface for the given PM lives.
 * Exposed so `--fix-transitive` dry-run can print the target path
 * without performing the write.
 */
export const resolveOverrideSurface = (workspaceRoot: string, pm: TransitiveFixPmInfo): { filePath: string; surface: OverrideSurface } => {
    if (pm.name === "pnpm" && PNPM_V10_PLUS(pm.version)) {
        return { filePath: join(workspaceRoot, "pnpm-workspace.yaml"), surface: "pnpm-workspace.yaml" };
    }

    const pkgJson = join(workspaceRoot, "package.json");

    if (pm.name === "pnpm") {
        return { filePath: pkgJson, surface: "package.json#pnpm.overrides" };
    }

    if (pm.name === "yarn") {
        return { filePath: pkgJson, surface: "package.json#resolutions" };
    }

    // bun + npm
    return { filePath: pkgJson, surface: "package.json#overrides" };
};

const readExistingOverrides = (workspaceRoot: string, pm: TransitiveFixPmInfo): Record<string, string> => {
    const { filePath, surface } = resolveOverrideSurface(workspaceRoot, pm);

    if (!isAccessibleSync(filePath)) {
        return {};
    }

    if (surface === "pnpm-workspace.yaml") {
        try {
            const data = readYamlSync(filePath) as { overrides?: Record<string, string> } | undefined;

            return data?.overrides ?? {};
        } catch {
            return {};
        }
    }

    try {
        const pkg = JSON.parse(readFileSync(filePath)) as Record<string, unknown>;

        if (surface === "package.json#pnpm.overrides") {
            const pnpmBlock = (pkg.pnpm as Record<string, unknown> | undefined) ?? {};

            return (pnpmBlock.overrides as Record<string, string> | undefined) ?? {};
        }

        if (surface === "package.json#resolutions") {
            return (pkg.resolutions as Record<string, string> | undefined) ?? {};
        }

        return (pkg.overrides as Record<string, string> | undefined) ?? {};
    } catch {
        return {};
    }
};

/**
 * Render the pnpm-workspace.yaml block for `overrides:`.
 *
 * Hand-rolled rather than full YAML serialization: callers want to
 * preserve comments and unrelated keys in the surrounding file, and the
 * upstream `js-yaml` writer would normalize unrelated formatting.
 */
const renderPnpmWorkspaceOverrides = (existing: string, overrides: Record<string, string>): string => {
    const sortedKeys = Object.keys(overrides).sort();

    if (
        sortedKeys.length === 0 // Empty plan + no existing block → no-op.
        && !/^overrides\s*:/m.test(existing)
    ) {
        return existing;
    }

    const block = `overrides:\n${sortedKeys.map((key) => `  '${key}': '${overrides[key]!}'`).join("\n")}\n`;

    if (existing.length === 0) {
        return block;
    }

    // Replace an existing block, mapping key + indented children.
    if (/^overrides\s*:/m.test(existing)) {
        const replaced = existing.replace(/^overrides\s*:[^\n]*\n(?:[ \t][^\n]*\n)*/m, block);

        return replaced.endsWith("\n") ? replaced : `${replaced}\n`;
    }

    const trimmed = existing.endsWith("\n") ? existing : `${existing}\n`;

    return `${trimmed}\n${block}`;
};

const renderPackageJsonWithOverrides = (filePath: string, existingContent: string, surface: OverrideSurface, overrides: Record<string, string>): string => {
    const indent = resolveIndentForFile(filePath, existingContent.length > 0 ? existingContent : undefined);
    const pkg = existingContent.length > 0 ? (JSON.parse(existingContent) as Record<string, unknown>) : {};

    if (surface === "package.json#pnpm.overrides") {
        const pnpmBlock = (pkg.pnpm as Record<string, unknown> | undefined) ?? {};

        pnpmBlock.overrides = overrides;
        pkg.pnpm = pnpmBlock;
    } else if (surface === "package.json#resolutions") {
        pkg.resolutions = overrides;
    } else {
        pkg.overrides = overrides;
    }

    return stringifyJson(pkg, indent);
};

/**
 * Plan + render an override write for `pm` against `workspaceRoot`. Pure
 * function: returns the would-be content but does not touch disk. Use
 * {@link applyOverridePlan} to commit, or feed `nextContent` into a
 * diff for the `--fix-transitive` dry-run preview.
 *
 * Entries are merged with the file's current overrides — never replaced —
 * and the resulting map is sorted by package name so diffs stay stable
 * across runs.
 */
export const planOverrideWrite = (workspaceRoot: string, plan: OverridePlan, pm: TransitiveFixPmInfo): ApplyOverridesResult => {
    const { filePath, surface } = resolveOverrideSurface(workspaceRoot, pm);
    const existingOverrides = readExistingOverrides(workspaceRoot, pm);
    const existingContent = isAccessibleSync(filePath) ? readFileSync(filePath) : "";

    const entries: OverrideEntryResult[] = [];
    const merged: Record<string, string> = { ...existingOverrides };

    for (const entry of plan.entries) {
        const previous = existingOverrides[entry.packageName];

        if (previous === entry.spec) {
            entries.push({ ...entry, previousSpec: previous, status: "unchanged" });

            continue;
        }

        if (previous === undefined) {
            entries.push({ ...entry, status: "added" });
        } else {
            entries.push({ ...entry, previousSpec: previous, status: "updated" });
        }

        merged[entry.packageName] = entry.spec;
    }

    const sortedOverrides = sortByKey(merged);
    const changed = entries.some((e) => e.status !== "unchanged");

    const nextContent: string
        = surface === "pnpm-workspace.yaml"
            ? renderPnpmWorkspaceOverrides(existingContent, sortedOverrides)
            : renderPackageJsonWithOverrides(filePath, existingContent, surface, sortedOverrides);

    return {
        changed,
        entries,
        filePath,
        nextContent,
        previousContent: existingContent,
        surface,
    };
};

/**
 * Commit a planned override write to disk atomically.
 *
 * Writes to `&lt;filePath>.tmp` then renames into place. The temp file is
 * removed if the rename fails so we never leave orphaned siblings
 * behind in the workspace.
 *
 * Returns the same result the caller passed in for fluent chaining
 * (`const plan = planOverrideWrite(...); applyOverridePlan(plan);`).
 */
export const applyOverridePlan = (result: ApplyOverridesResult): ApplyOverridesResult => {
    if (!result.changed) {
        return result;
    }

    if (result.surface === "pnpm-workspace.yaml" && result.previousContent.length === 0) {
        throw new Error(`${result.filePath} not found. Run \`pnpm init\` or create pnpm-workspace.yaml before applying overrides for pnpm v10+.`);
    }

    const tempPath = `${result.filePath}.tmp`;

    try {
        writeFileSync(tempPath, result.nextContent);
        renameSync(tempPath, result.filePath);
    } catch (error) {
        try {
            unlinkSync(tempPath);
        } catch {
            // best-effort cleanup; the rename error is the real failure
        }

        throw error;
    }

    return result;
};

/**
 * Build an `OverridePlan` from audit findings.
 *
 * `findings[i].vulnerability.fixedVersions` is the OSV-reported list of
 * fixed versions, smallest first. We pick the lowest entry and emit a
 * caret-pinned override (`^1.2.3`) — same shape the existing
 * `--show-fixes` output recommends, so the apply path matches what the
 * user reviewed in dry-run.
 *
 * Findings without a fixed version are skipped: there is no remediation
 * to write, and emitting `*` would silently downgrade vulnerable users
 * to whatever the registry returns at install time.
 *
 * Duplicate package names collapse to the highest-precedence fix — if
 * multiple findings disagree on the lowest-fixed-version, the last one
 * wins (stable insertion order). Callers needing a different tiebreak
 * should pre-sort their findings.
 */
export const buildOverridePlanFromFindings = (findings: ReadonlyArray<{ packageName: string; vulnerability: { fixedVersions: string[] } }>): OverridePlan => {
    const byName = new Map<string, string>();

    for (const finding of findings) {
        const lowest = finding.vulnerability.fixedVersions[0];

        if (!lowest) {
            continue;
        }

        const coerced = coerce(lowest);
        const spec = coerced ? `^${coerced.version}` : lowest;

        byName.set(finding.packageName, spec);
    }

    const entries: OverrideEntry[] = [...byName.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([packageName, spec]) => {
            return { packageName, spec };
        });

    return { entries };
};
