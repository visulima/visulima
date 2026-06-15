/**
 * Pre-release mode (`vis release pre enter|exit|status`).
 *
 * Changesets-compatible pre-mode: while the workspace is "in pre mode",
 * every `vis release version` produces a prerelease (e.g. `1.2.0-alpha.5`)
 * instead of a stable bump. Useful for long-running release sprints on
 * a non-channel-derived flow — e.g. sustaining an alpha line on the
 * default branch for a few weeks before exiting to stable.
 *
 * State lives in `.vis/release/pre.json` (tracked, like staged.json):
 *
 *     {
 *       "version": 1,
 *       "mode": "pre",                  // or "exit-pending"
 *       "tag": "alpha",                 // the prerelease identifier
 *       "initialVersions": { "@scope/a": "1.2.0", ... },
 *       "changesets": ["abc.md", "def.md"],
 *       "enteredAt": "2026-05-22T14:00:00Z"
 *     }
 *
 * Lifecycle:
 *
 *   - `pre enter &lt;tag>`  — writes pre.json with `mode: "pre"` and a
 *     snapshot of every package's current version. Subsequent
 *     `version` runs append the version step's change-file ids to
 *     `changesets` (for the eventual exit consolidation) and use
 *     `tag` as the prerelease id.
 *
 *   - `pre exit`         — flips to `mode: "exit-pending"`. The NEXT
 *     `vis release version` run consolidates all the accumulated
 *     pre-mode changesets into one stable bump, then deletes
 *     pre.json.
 *
 *   - `pre status`       — read-only inspection.
 *
 * Why not just use channels? Channels are branch-derived (push to
 * `alpha` → publish alpha). Pre-mode is operator-controlled — flip
 * a switch on whatever branch you're on, sprint, flip back. Both
 * primitives coexist.
 */

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { VisReleaseError } from "../errors";

export type PreMode = "exit-pending" | "pre";

export interface PreModeFile {
    /** ISO-8601 timestamp when `pre enter` was called. */
    enteredAt: string;

    /**
     * Snapshot of every package's version at `pre enter` time. Used
     * by the exit-consolidation to compute one stable bump from
     * `initialVersion → currentVersion` regardless of intermediate
     * prerelease counters.
     */
    initialVersions: Record<string, string>;

    /**
     * `pre`           — actively in pre mode; future `version` runs
     *                   produce prereleases.
     * `exit-pending`  — `pre exit` was called; the NEXT `version` run
     *                   exits and deletes this file.
     */
    mode: PreMode;
    /** Prerelease identifier (e.g. `"alpha"`, `"beta"`, `"rc"`). */
    tag: string;
    version: 1;
}

export const preModeFilePath = (cwd: string, changesDir: string): string =>
    join(cwd, changesDir, "pre.json");

export const readPreMode = async (cwd: string, changesDir: string): Promise<PreModeFile | undefined> => {
    const path = preModeFilePath(cwd, changesDir);

    let content: string;

    try {
        content = await readFile(path, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return undefined;
        }

        throw new VisReleaseError({
            cause: error,
            code: "STATE_FILE_CORRUPT",
            message: `Failed to read pre-mode file at ${path}: ${(error as Error).message}`,
        });
    }

    let parsed: PreModeFile;

    try {
        parsed = JSON.parse(content) as PreModeFile;
    } catch (error) {
        throw new VisReleaseError({
            cause: error,
            code: "STATE_FILE_CORRUPT",
            message: `Pre-mode file at ${path} is not valid JSON: ${(error as Error).message}.`,
        });
    }

    if (parsed.version !== 1) {
        throw new VisReleaseError({
            code: "STATE_FILE_CORRUPT",
            message: `Pre-mode file at ${path} reports unknown version ${parsed.version}.`,
        });
    }

    if (parsed.mode !== "pre" && parsed.mode !== "exit-pending") {
        throw new VisReleaseError({
            code: "STATE_FILE_CORRUPT",
            message: `Pre-mode file at ${path} has invalid mode ${JSON.stringify(parsed.mode)}.`,
        });
    }

    if (typeof parsed.tag !== "string" || parsed.tag.length === 0) {
        throw new VisReleaseError({
            code: "STATE_FILE_CORRUPT",
            message: `Pre-mode file at ${path} is missing a tag.`,
        });
    }

    return parsed;
};

export const writePreMode = async (
    cwd: string,
    changesDir: string,
    file: PreModeFile,
): Promise<string> => {
    const path = preModeFilePath(cwd, changesDir);

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(file, null, 2)}\n`);

    return path;
};

export const deletePreMode = async (cwd: string, changesDir: string): Promise<boolean> => {
    const path = preModeFilePath(cwd, changesDir);

    try {
        await unlink(path);

        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return false;
        }

        throw error;
    }
};

/**
 * Pure helper used by the `pre enter` command to assemble the initial
 * file content from a snapshot of workspace packages.
 */
export const buildEnterFile = (
    tag: string,
    packages: ReadonlyArray<{ name: string; version: string }>,
): PreModeFile => {
    const initialVersions: Record<string, string> = {};

    for (const pkg of packages) {
        initialVersions[pkg.name] = pkg.version;
    }

    return {
        enteredAt: new Date().toISOString(),
        initialVersions,
        mode: "pre",
        tag,
        version: 1,
    };
};
