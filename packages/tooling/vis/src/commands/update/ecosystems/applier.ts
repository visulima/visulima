import { readFileSync, writeFileSync } from "@visulima/fs";

import type { EcosystemUpdate } from "./types";

/**
 * Result returned by {@link applyEcosystemUpdates}. The lists are not
 * mutually exclusive — a single update may end up in `applied` even if
 * another update against the same file failed (we batch by file).
 */
export interface ApplyResult {
    readonly applied: EcosystemUpdate[];
    readonly skipped: { reason: string; update: EcosystemUpdate }[];
}

/**
 * Sort updates by file then by line so when we rewrite a file's contents
 * line-by-line, each line's index hasn't shifted. We only ever replace
 * substrings inside a line — never add/remove lines — so index drift is
 * a non-issue, but stable ordering keeps the applier deterministic.
 */
const orderUpdates = (updates: EcosystemUpdate[]): EcosystemUpdate[] =>
    updates.toSorted((a, b) => {
        if (a.file !== b.file) {
            return a.file < b.file ? -1 : 1;
        }

        return a.line - b.line;
    });

/**
 * Applies a batch of ecosystem updates to the filesystem. Each update
 * carries its own (file, line, original, replacement) tuple so we can
 * rewrite without re-parsing the file or running the full scanner again.
 *
 * The applier groups updates by file, rebuilds the file's text by
 * line-targeted substring replacement, and writes once per file.
 *
 * No backups are written here — `vis update`'s catalog path already
 * snapshots the workspace before running, and the per-file rewrite is
 * confined to the exact original tokens, which is recoverable with
 * `git checkout --`. A future enhancement could mirror the catalog
 * backup mechanism for ecosystem files when not in a git repo.
 */
export const applyEcosystemUpdates = (updates: EcosystemUpdate[]): ApplyResult => {
    const applied: EcosystemUpdate[] = [];
    const skipped: ApplyResult["skipped"] = [];

    if (updates.length === 0) {
        return { applied, skipped };
    }

    const ordered = orderUpdates(updates);
    const grouped = new Map<string, EcosystemUpdate[]>();

    for (const update of ordered) {
        const bucket = grouped.get(update.file) ?? [];

        bucket.push(update);
        grouped.set(update.file, bucket);
    }

    for (const [file, fileUpdates] of grouped) {
        let content: string;

        try {
            content = readFileSync(file);
        } catch (error) {
            for (const update of fileUpdates) {
                skipped.push({ reason: `read failed: ${(error as Error).message}`, update });
            }

            continue;
        }

        const newline = content.includes("\r\n") ? "\r\n" : "\n";
        // `split` on `/\r?\n/` already produces a trailing empty element
        // for a file that ends with a newline, so `lines.join(newline)`
        // reproduces the trailing newline naturally. We must NOT append
        // an extra newline afterwards or every applied file accumulates
        // blank lines at EOF on each invocation.
        const lines = content.split(/\r?\n/);
        const success: EcosystemUpdate[] = [];

        for (const update of fileUpdates) {
            const lineIndex = update.line - 1;
            const line = lines[lineIndex];

            if (line === undefined) {
                skipped.push({ reason: `line ${String(update.line)} out of range`, update });
                continue;
            }

            const originalIndex = line.indexOf(update.original);

            if (originalIndex === -1) {
                // The file has drifted since the scan (most likely a
                // formatter rewrote it). Skip rather than corrupt the
                // file with a misaligned rewrite.
                skipped.push({ reason: "original token not found on expected line", update });
                continue;
            }

            // When the new replacement carries its own `# vN.M.P` hint,
            // strip a pre-existing version-hint comment so we don't end
            // up with two. Non-version comments (e.g. `# pinned for CI`,
            // `# v3.5.3 keep pinned for SOC2`) are preserved — they're
            // user intent, not bookkeeping. The strip is intentionally
            // narrow: it only fires when the trailing comment is *just*
            // a bare version token (optionally with `v`/`V` prefix and
            // patch/prerelease suffix) followed by nothing else.
            const head = line.slice(0, originalIndex);
            const tail = line.slice(originalIndex + update.original.length);
            const replacementHasVersionHint = /#\s*v?\d/.test(update.replacement);
            const bareVersionTail = /^\s*#\s*v?\d[\w.+-]*\s*$/i;
            const cleanedTail = replacementHasVersionHint && bareVersionTail.test(tail) ? "" : tail;

            lines[lineIndex] = `${head}${update.replacement}${cleanedTail}`;
            success.push(update);
        }

        if (success.length === 0) {
            continue;
        }

        const next = lines.join(newline);

        try {
            writeFileSync(file, next);
            applied.push(...success);
        } catch (error) {
            for (const update of success) {
                skipped.push({ reason: `write failed: ${(error as Error).message}`, update });
            }
        }
    }

    return { applied, skipped };
};
