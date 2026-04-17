import { execFileSync } from "node:child_process";

import { isAbsolute, join } from "@visulima/path";

const runGit = (root: string, args: string[]): string => {
    try {
        return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    } catch {
        return "";
    }
};

const splitFiles = (stdout: string): string[] =>
    stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

/** Absolute paths of files currently staged for commit (A/C/M/R only). */
export const stagedFiles = (root: string): string[] =>
    splitFiles(runGit(root, ["diff", "--cached", "--name-only", "--diff-filter=ACMR"])).map((p) => (isAbsolute(p) ? p : join(root, p)));

/** Absolute paths of files changed since `ref` (defaults to upstream/HEAD~1). */
export const filesSince = (root: string, ref: string): string[] => {
    const stdout = runGit(root, ["diff", "--name-only", "--diff-filter=ACMR", `${ref}...HEAD`]);
    const list = splitFiles(stdout);

    // Fallback for the common case where the user hasn't set up a merge-base yet.
    if (list.length === 0) {
        const fallback = runGit(root, ["diff", "--name-only", "--diff-filter=ACMR", ref]);

        return splitFiles(fallback).map((p) => (isAbsolute(p) ? p : join(root, p)));
    }

    return list.map((p) => (isAbsolute(p) ? p : join(root, p)));
};

/** True if `git` is on PATH and `root` is a working tree. */
export const hasGit = (root: string): boolean => runGit(root, ["rev-parse", "--show-toplevel"]).length > 0;
