import { isAccessibleSync, readFileSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

/**
 * The single entry that covers everything vis writes into a workspace:
 * `cache/` (the big one — megabytes, grows every run), `last-failures/`
 * and `last-summary.json`.
 *
 * Deliberately the whole directory rather than three narrow patterns —
 * narrow entries are how `.vis/cache` ends up staged for commit while
 * the two files beside it are correctly ignored.
 */
export const VIS_IGNORE_ENTRY = ".vis/";

/** Patterns that `VIS_IGNORE_ENTRY` subsumes, matched after trimming. */
const REDUNDANT_VIS_ENTRIES = new Set([".vis", ".vis/*", ".vis/cache", ".vis/cache/", ".vis/last-failures", ".vis/last-failures/", ".vis/last-summary.json"]);

export interface EnsureGitignoreResult {
    /** Entries appended. */
    added: string[];
    /** True when the file was written. */
    changed: boolean;
    /** Entries removed as redundant or dead. */
    removed: string[];
}

/**
 * Ensure `.gitignore` ignores vis's working directory, optionally
 * dropping entries that a migration made dead.
 *
 * No-ops (without creating a file) when there is no `.gitignore` and
 * nothing to add — we only manage a file the repo already keeps, or one
 * we have a reason to create.
 * @param workspaceRoot Directory holding `.gitignore`.
 * @param options Behaviour switches.
 * @param options.create Write a `.gitignore` when absent (init does; migrate does not).
 * @param options.dropEntries Exact lines to remove, e.g. `.nx` after migrating off Nx.
 * @returns What was added, what was removed, and whether the file was written.
 */
export const ensureVisGitignore = (workspaceRoot: string, options: { create?: boolean; dropEntries?: ReadonlyArray<string> } = {}): EnsureGitignoreResult => {
    const { create = true, dropEntries = [] } = options;
    const gitignorePath = join(workspaceRoot, ".gitignore");
    const exists = isAccessibleSync(gitignorePath);

    if (!exists && !create) {
        return { added: [], changed: false, removed: [] };
    }

    const original = exists ? readFileSync(gitignorePath) : "";
    const lines = original.split("\n");

    const dropSet = new Set(dropEntries.map((entry) => entry.trim()));
    const removed: string[] = [];

    // Keep comments and blanks untouched; only ever drop exact matches so
    // a user's own broader pattern is never silently rewritten.
    const kept = lines.filter((line) => {
        const trimmed = line.trim();

        if (trimmed === "") {
            return true;
        }

        if (dropSet.has(trimmed) || REDUNDANT_VIS_ENTRIES.has(trimmed)) {
            removed.push(trimmed);

            return false;
        }

        return true;
    });

    const alreadyIgnored = kept.some((line) => line.trim() === VIS_IGNORE_ENTRY);
    const added: string[] = [];

    if (!alreadyIgnored) {
        added.push(VIS_IGNORE_ENTRY);

        // Trailing blank lines would push the new entry away from the
        // content; trim them, append, and restore exactly one newline.
        while (kept.length > 0 && kept[kept.length - 1]!.trim() === "") {
            kept.pop();
        }

        if (kept.length > 0) {
            kept.push("");
        }

        kept.push("# vis task runner cache and run state", VIS_IGNORE_ENTRY);
    }

    if (added.length === 0 && removed.length === 0) {
        return { added, changed: false, removed };
    }

    writeFileSync(gitignorePath, `${kept.join("\n").replace(/\n+$/, "")}\n`);

    return { added, changed: true, removed };
};
