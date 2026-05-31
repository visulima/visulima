import { spawnSync } from "node:child_process";

import { isAbsolute, join } from "@visulima/path";

/**
 * Resolve the set of files changed relative to a git ref. Used by
 * `vis lint --since` and `vis fmt --since` to narrow the input file
 * list to just the diff vs the given ref.
 *
 * The diff is computed with `--diff-filter=ACMR` — added, copied,
 * modified, renamed. Deletions are filtered out because we cannot
 * lint files that no longer exist on disk. Untracked files are
 * included via a separate `ls-files --others --exclude-standard`
 * pass so a freshly-created file shows up before its first commit.
 *
 * Returns absolute paths so the caller can route them through
 * existing adapters / ignore rules without further normalization.
 *
 * When the ref doesn't exist or git itself fails (not a repo, etc.),
 * returns `undefined` so callers can fall back to a workspace-wide
 * run with a sensible warning.
 */
export const changedFilesSince = (root: string, ref: string): string[] | undefined => {
    const tracked = runGit(root, ["diff", "--name-only", "--diff-filter=ACMR", "-z", `${ref}...HEAD`]);

    if (tracked === undefined) {
        return undefined;
    }

    const unstaged = runGit(root, ["diff", "--name-only", "--diff-filter=ACMR", "-z"]);
    const staged = runGit(root, ["diff", "--name-only", "--diff-filter=ACMR", "--cached", "-z"]);
    const untracked = runGit(root, ["ls-files", "--others", "--exclude-standard", "-z"]);

    const all = new Set<string>();

    for (const list of [tracked, unstaged ?? "", staged ?? "", untracked ?? ""]) {
        for (const entry of list.split("\0")) {
            if (entry.length === 0) {
                continue;
            }

            all.add(isAbsolute(entry) ? entry : join(root, entry));
        }
    }

    return [...all].sort();
};

const runGit = (cwd: string, args: ReadonlyArray<string>): string | undefined => {
    const result = spawnSync("git", [...args], {
        cwd,
        encoding: "utf8",
        // git diff against a missing ref is fast-failing; 10s ceiling is
        // generous for any realistic workspace size.
        timeout: 10_000,
    });

    if (result.status !== 0) {
        return undefined;
    }

    return result.stdout;
};

/**
 * Filter a file list to those whose extension is claimed by `adapter`.
 * Returns the input order, deduplicated.
 */
export const filterByExtensions = (files: ReadonlyArray<string>, extensions: ReadonlyArray<string>): string[] => {
    const allowed = new Set(extensions.map((ext) => ext.toLowerCase()));
    const out: string[] = [];
    const seen = new Set<string>();

    for (const file of files) {
        const lastDot = file.lastIndexOf(".");

        if (lastDot === -1 || lastDot === file.length - 1) {
            continue;
        }

        const extension = file.slice(lastDot + 1).toLowerCase();

        if (!allowed.has(extension)) {
            continue;
        }

        if (seen.has(file)) {
            continue;
        }

        seen.add(file);
        out.push(file);
    }

    return out;
};
