import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { join } from "@visulima/path";

import type { BuiltinContext } from "./types";

/**
 * Mirrors `pre-commit/pre-commit-hooks/check_merge_conflict.py:is_in_merge`.
 */
const isInMerge = (root: string): boolean => {
    const gitDirResult = spawnSync("git", ["rev-parse", "--git-dir"], { cwd: root, encoding: "utf8" });

    if (gitDirResult.status !== 0) {
        return false;
    }

    const rawDir = gitDirResult.stdout.trim();
    const gitDir = rawDir.startsWith("/") ? rawDir : join(root, rawDir);

    if (!existsSync(join(gitDir, "MERGE_MSG"))) {
        return false;
    }

    return existsSync(join(gitDir, "MERGE_HEAD")) || existsSync(join(gitDir, "rebase-apply")) || existsSync(join(gitDir, "rebase-merge"));
};

const PATTERNS: ReadonlyArray<string> = ["<<<<<<< ", "======= ", "=======\r\n", "=======\n", ">>>>>>> "];

/**
 * Mirrors `pre-commit/pre-commit-hooks/check_merge_conflict.py`: only
 * scans for conflict markers when git is mid-merge/rebase, unless the
 * caller passes `--assume-in-merge`. Skipping the guard means every
 * legit `&lt;&lt;&lt;&lt;&lt;&lt;&lt;` in docs would fail the hook.
 * @param files Files (relative to `context.root`) to scan.
 * @param args Raw CLI args; `--assume-in-merge` skips the mid-merge guard.
 * @param context Builtin context with logger and workspace root.
 * @returns Exit code: `0` when no markers found / not mid-merge, `1` on any marker hit.
 */
const runCheckMergeConflict = (files: ReadonlyArray<string>, args: ReadonlyArray<string>, context: BuiltinContext): number => {
    const assumeInMerge = args.includes("--assume-in-merge");

    if (!assumeInMerge && !isInMerge(context.root)) {
        return 0;
    }

    let rc = 0;

    for (const file of files) {
        const content = readFileSync(join(context.root, file), "utf8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i]! + (i < lines.length - 1 ? "\n" : "");

            for (const pattern of PATTERNS) {
                if (line.startsWith(pattern)) {
                    context.logger.info(`${file}:${i + 1}: Merge conflict string ${JSON.stringify(pattern.trim())} found`);
                    rc = 1;
                }
            }
        }
    }

    return rc;
};

export { runCheckMergeConflict };
