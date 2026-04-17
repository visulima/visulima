// `fs.glob` + `path.matchesGlob` are flagged as experimental below
// Node 22.17 but are stable in the 22.x runtimes we ship against,
// and avoid pulling in a glob dependency.
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { glob, stat } from "node:fs/promises";
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { matchesGlob } from "node:path";

import { isAbsolute, join, relative, resolve } from "@visulima/path";

import type { OutputSpec } from "./types";

const GLOB_METACHARS = /[*?[\]{}]/;

/**
 * Normalises `absolutePath` to a workspace-relative path, returning
 * `undefined` when the path escapes `workspaceRoot` (outside-ref or
 * empty-string). Used everywhere candidate paths come in so we never
 * archive something that can't be portably restored.
 */
const toWorkspaceRelative = (workspaceRoot: string, absolutePath: string): string | undefined => {
    const rel = relative(workspaceRoot, absolutePath);

    if (rel.length === 0 || rel.startsWith("..")) {
        return undefined;
    }

    return rel;
};

/**
 * Expands a task's `OutputSpec[]` into the concrete file list to
 * archive:
 *
 * - literal paths → kept as-is (the archiver recursively copies
 *   directories, so `"dist"` captures its whole tree);
 * - positive globs → expanded via `fs.glob`, filtered to files only;
 * - negatives (`!pattern`) → applied to the combined result;
 * - `{ auto: true }` → pulls in `autoWrites` entries that fall inside
 *   the workspace.
 *
 * Returns deduped, sorted workspace-relative paths so archives are
 * byte-reproducible across invocations.
 *
 * Silent degradation: missing literal paths, empty glob matches, and
 * `{ auto: true }` without tracked writes all contribute nothing
 * rather than throwing.
 */
export const resolveOutputs = async (workspaceRoot: string, outputs: OutputSpec[] | undefined, autoWrites?: ReadonlyArray<string>): Promise<string[]> => {
    if (!outputs || outputs.length === 0) {
        return [];
    }

    const positives: string[] = [];
    const negatives: string[] = [];
    let wantsAuto = false;

    for (const entry of outputs) {
        if (typeof entry !== "string") {
            if (entry.auto) {
                wantsAuto = true;
            }

            continue;
        }

        if (entry.length === 0) {
            continue;
        }

        if (entry.startsWith("!")) {
            const pattern = entry.slice(1);

            if (pattern.length > 0) {
                negatives.push(pattern);
            }

            continue;
        }

        positives.push(entry);
    }

    const resolved = new Set<string>();

    if (wantsAuto && autoWrites) {
        for (const write of autoWrites) {
            const absolute = isAbsolute(write) ? write : resolve(workspaceRoot, write);
            const rel = toWorkspaceRelative(workspaceRoot, absolute);

            if (rel) {
                resolved.add(rel);
            }
        }
    }

    // Run all positive patterns concurrently — independent FS walks
    // with no ordering constraints, so a task declaring multiple
    // output roots (`["dist/**", "build/**"]`) overlaps their walks.
    const patternResults = await Promise.all(positives.map((pattern) => expandPattern(workspaceRoot, pattern)));

    for (const paths of patternResults) {
        for (const rel of paths) {
            resolved.add(rel);
        }
    }

    if (negatives.length === 0) {
        return [...resolved].sort();
    }

    return [...resolved].filter((candidate) => !negatives.some((pattern) => matchesGlob(candidate, pattern))).sort();
};

/**
 * Expands a single positive pattern — literal stat or `fs.glob` walk
 * — to the set of workspace-relative file paths it matches. Missing
 * literals and empty glob results both resolve to an empty list so
 * the caller can `Promise.all` safely.
 */
const expandPattern = async (workspaceRoot: string, pattern: string): Promise<string[]> => {
    if (!GLOB_METACHARS.test(pattern)) {
        const absolute = resolve(workspaceRoot, pattern);
        const rel = toWorkspaceRelative(workspaceRoot, absolute);

        if (!rel) {
            return [];
        }

        try {
            await stat(absolute);

            return [rel];
        } catch {
            return [];
        }
    }

    // `withFileTypes: true` gives us Dirent inline — no follow-up
    // fstat per match to separate files from directories.
    const paths: string[] = [];

    for await (const entry of glob(pattern, { cwd: workspaceRoot, withFileTypes: true })) {
        if (!entry.isFile()) {
            continue;
        }

        const rel = toWorkspaceRelative(workspaceRoot, join(entry.parentPath, entry.name));

        if (rel) {
            paths.push(rel);
        }
    }

    return paths;
};
