/**
 * Utility helpers for the `vis create` command.
 *
 * - Package name validation & sanitisation
 * - Directory emptiness / conflict checks
 * - Target directory resolution
 */

import { readdirSync } from "node:fs";

import { isAccessibleSync } from "@visulima/fs";
import { basename, resolve } from "@visulima/path";
import validate from "validate-npm-package-name";

// ── Package name helpers ──────────────────────────────────────────

/**
 * Validate an npm package name using the official `validate-npm-package-name` library.
 * Handles blacklisted names, core module conflicts, length limits, etc.
 * @param name Package name to validate.
 * @returns `true` when `name` is valid for new npm packages.
 */
export const isValidPackageName = (name: string): boolean => {
    if (!name) {
        return false;
    }

    const result = validate(name);

    return result.validForNewPackages;
};

/**
 * Sanitise an arbitrary string into a valid npm package name.
 * @param raw Arbitrary string to sanitise.
 * @returns Lowercased, hyphen-separated name with special chars stripped.
 */
export const toValidPackageName = (raw: string): string =>
    raw
        .toLowerCase()
        .trim()
        .replaceAll(/\s+/g, "-")
        .replaceAll(/[^a-z\d\-~]/g, "-")
        .replace(/^[._-]+/, "")
        .replaceAll(/-{2,}/g, "-")
        .replace(/-$/, "");

// ── Directory helpers ─────────────────────────────────────────────

/** Files that are safe to ignore when deciding if a directory is "empty". */
const IGNORED_FILES = new Set([".DS_Store", ".git", ".gitkeep", "Thumbs.db"]);

/**
 * Check if a directory is empty or contains only ignored files (.DS_Store, .git, etc.).
 * @param dir Absolute path to check.
 * @returns `true` when `dir` does not exist or contains only ignored files.
 */
export const isEmptyDir = (dir: string): boolean => {
    if (!isAccessibleSync(dir)) {
        return true;
    }

    const entries = readdirSync(dir);

    return entries.every((entry) => IGNORED_FILES.has(entry));
};

/**
 * Resolve `projectName` relative to `cwd` into an absolute target directory path.
 * @param projectName Project name or relative path.
 * @param cwd Base directory to resolve from.
 * @returns Object with absolute `targetDir` and sanitised `packageName`.
 */
export const resolveTargetDir = (projectName: string, cwd: string): { packageName: string; targetDir: string } => {
    const targetDir = resolve(cwd, projectName);
    const packageName = toValidPackageName(basename(targetDir));

    return { packageName, targetDir };
};

/**
 * Check whether scaffolding can proceed without overwriting user files.
 * @param dir Absolute path to the target directory.
 * @returns `true` when the directory is safe to write into (empty or non-existent).
 */
export const canSafelyOverwrite = (dir: string): boolean => isEmptyDir(dir);
