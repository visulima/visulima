/**
 * Disk loader for change files (`&lt;changesDir>/*.md`).
 *
 * Wraps `parseChangeFile` with fs reads + directory enumeration.
 * Skips non-`.md` files and the conventional `README.md` / `_config.json`
 * sentinel filenames bumpy uses.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, resolve as resolvePath, sep as pathSep } from "node:path";

import { DEFAULT_CHANGES_DIR } from "../config";
import { VisReleaseError } from "../errors";
import type { ChangeFile } from "../types";
import { parseChangeFile } from "./change-file";

const RESERVED_FILENAMES = new Set(["README.md", "readme.md"]);

export interface ReadChangeFilesOptions {
    /** Override `changesDir` from config. Default: `.vis/release`. */
    changesDir?: string;
    /** Workspace root (`changesDir` is resolved relative to this). */
    cwd: string;
}

export interface ReadChangeFilesResult {
    files: ChangeFile[];
    /** Per-file parse warnings (not fatal — parse errors throw). */
    warnings: string[];
}

export const readChangeFiles = async (options: ReadChangeFilesOptions): Promise<ReadChangeFilesResult> => {
    const changesDir = options.changesDir ?? DEFAULT_CHANGES_DIR;

    // Use `resolve` (not `join`) so an absolute `changesDir` resolves to
    // itself rather than being silently nested under `cwd`. The traversal
    // check below then rejects any value outside the workspace.
    const cwdResolved = resolvePath(options.cwd);
    const dirResolved = resolvePath(options.cwd, changesDir);
    const dir = dirResolved;
    const cwdWithSep = cwdResolved.endsWith(pathSep) ? cwdResolved : `${cwdResolved}${pathSep}`;

    if (dirResolved !== cwdResolved && !dirResolved.startsWith(cwdWithSep)) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            message: `changesDir resolves outside the workspace: ${dirResolved} (workspace: ${cwdResolved}). Set release.changesDir to a path inside the repo.`,
        });
    }

    const warnings: string[] = [];

    let entries: string[];

    try {
        entries = await readdir(dir);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            // No changes dir → no pending releases. Not an error.
            return { files: [], warnings: [] };
        }

        throw new VisReleaseError({
            cause: error,
            code: "CONFIG_INVALID",
            message: `Cannot read change-files directory ${dir}: ${(error as Error).message}`,
        });
    }

    // Filter to .md files (excluding reserved sentinels) up front, then read
    // in parallel. For a PR with many pending change files this turns
    // sequential ~5ms-per-file into one wall-clock batch.
    const candidates = entries.filter((name) => !RESERVED_FILENAMES.has(name) && name.endsWith(".md"));
    const settled = await Promise.all(candidates.map(async (name) => {
        const path = join(dir, name);
        const content = await readFile(path, "utf8");

        // Parse errors propagate — a malformed change file is user error
        // and silently dropping it can hide a broken release.
        return parseChangeFile(content, path);
    }));

    return { files: settled, warnings };
};
