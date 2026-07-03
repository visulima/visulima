import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { readYamlSync } from "@visulima/fs/yaml";
import { isAbsolute, join, resolve } from "@visulima/path";

/**
 * One entry in a `patchedDependencies` map.
 *
 * Both pnpm and bun spell the field the same way (`patchedDependencies`)
 * and use the same shape: a record keyed by `&lt;name>@&lt;version>` whose
 * value is a path to a `.patch` file resolved relative to the manifest
 * the field lives in. The version-bound key is what makes the patch
 * brittle — bump the dep and the key no longer matches, so the patch
 * silently goes unapplied.
 *
 * The two PMs differ only on **where** the field lives:
 *   - pnpm: top-level of `pnpm-workspace.yaml`
 *   - bun:  top-level of `package.json`
 */
export interface PatchedDependencyEntry {
    /** Package name parsed out of the `&lt;name>@&lt;version>` key. Preserves the `@scope/` prefix. */
    name: string;
    /** Path to the patch file as written in config — pre-resolution. */
    patchFile: string;
    /** Resolved absolute path to the patch file (joined against workspaceRoot). */
    resolvedPatchFile: string;
    /** Version range parsed out of the key. */
    version: string;
}

const PATCH_KEY_RE = /^(@[\w./-]+\/[\w./-]+|[\w.-]+)@(.+)$/;

const parsePatchKey = (key: string): { name: string; version: string } | undefined => {
    const matched = PATCH_KEY_RE.exec(key);

    if (!matched) {
        return undefined;
    }

    return { name: matched[1] as string, version: matched[2] as string };
};

/**
 * Reads `patchedDependencies` from the package manager's native config.
 * Returns an empty array when the field is absent, the file is missing,
 * the parse fails, or the package manager doesn't support patches in a
 * vis-readable shape (npm, yarn — yarn uses `resolutions` with
 * `patch:` URLs, a different format we deliberately don't conflate).
 *
 * The returned entries are pre-resolved against `workspaceRoot` so
 * downstream callers can `isAccessibleSync(entry.resolvedPatchFile)`
 * without re-deriving the base directory.
 */
export const readPatchedDependencies = (workspaceRoot: string, packageManager: string): PatchedDependencyEntry[] => {
    let raw: Record<string, unknown> | undefined;

    try {
        if (packageManager === "pnpm") {
            const yamlPath = join(workspaceRoot, "pnpm-workspace.yaml");

            if (isAccessibleSync(yamlPath)) {
                const data = readYamlSync(yamlPath) as { patchedDependencies?: Record<string, unknown> } | undefined;

                raw = data?.patchedDependencies;
            }
        } else if (packageManager === "bun") {
            const jsonPath = join(workspaceRoot, "package.json");

            if (isAccessibleSync(jsonPath)) {
                const data = readJsonSync(jsonPath) as { patchedDependencies?: Record<string, unknown> } | undefined;

                raw = data?.patchedDependencies;
            }
        }
    } catch {
        // Non-critical: malformed YAML/JSON shouldn't crash the doctor —
        // treat it the same as "no patches configured" and let the
        // upstream parser surface the syntax error elsewhere.
        return [];
    }

    if (!raw || typeof raw !== "object") {
        return [];
    }

    const entries: PatchedDependencyEntry[] = [];

    for (const [key, value] of Object.entries(raw)) {
        if (typeof value !== "string" || value.length === 0) {
            continue;
        }

        const parsed = parsePatchKey(key);

        if (!parsed) {
            continue;
        }

        entries.push({
            name: parsed.name,
            patchFile: value,
            resolvedPatchFile: isAbsolute(value) ? value : resolve(workspaceRoot, value),
            version: parsed.version,
        });
    }

    return entries;
};

/**
 * One unhealthy `patchedDependencies` entry. Only `missing-file` is
 * surfaced today — version-key drift (key says `lodash@4.17.21` but the
 * lockfile resolves `lodash` to `4.17.22`) requires lockfile parsing
 * we don't do here yet.
 */
export interface PatchIssue {
    entry: PatchedDependencyEntry;
    /** `missing-file` — the patch file referenced by the entry doesn't exist on disk. */
    kind: "missing-file";
}

export const findPatchIssues = (entries: ReadonlyArray<PatchedDependencyEntry>): PatchIssue[] => {
    const issues: PatchIssue[] = [];

    for (const entry of entries) {
        if (!isAccessibleSync(entry.resolvedPatchFile)) {
            issues.push({ entry, kind: "missing-file" });
        }
    }

    return issues;
};
