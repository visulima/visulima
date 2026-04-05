/**
 * Utility helpers for the `vis create` command.
 *
 * - Package name validation & sanitisation
 * - Directory emptiness / conflict checks
 * - Target directory resolution
 */

import { existsSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import validate from "validate-npm-package-name";

// ── Package name helpers ──────────────────────────────────────────

/**
 * Validate an npm package name using the official `validate-npm-package-name` library.
 * Returns `true` when `name` is valid for new packages (handles blacklisted names,
 * core module conflicts, length limits, etc.).
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
 *
 * - lowercases
 * - replaces whitespace / special chars with hyphens
 * - strips leading dots, underscores, and hyphens
 * - collapses consecutive hyphens
 */
export const toValidPackageName = (raw: string): string =>
    raw
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z\d\-~]/g, "-")
        .replace(/^[._-]+/, "")
        .replace(/-{2,}/g, "-")
        .replace(/-$/, "");

// ── Directory helpers ─────────────────────────────────────────────

/** Files that are safe to ignore when deciding if a directory is "empty". */
const IGNORED_FILES = new Set([".DS_Store", ".git", ".gitkeep", "Thumbs.db"]);

/**
 * Returns `true` when `dir` does not exist or contains only ignored files.
 */
export const isEmptyDir = (dir: string): boolean => {
    if (!existsSync(dir)) {
        return true;
    }

    const entries = readdirSync(dir);

    return entries.every((entry) => IGNORED_FILES.has(entry));
};

/**
 * Resolve `projectName` relative to `cwd` into an absolute target directory path.
 * Also derives a sensible package name from the directory basename.
 */
export const resolveTargetDir = (
    projectName: string,
    cwd: string,
): { packageName: string; targetDir: string } => {
    const targetDir = resolve(cwd, projectName);
    const packageName = toValidPackageName(basename(targetDir));

    return { packageName, targetDir };
};

/**
 * Check whether the target directory exists and is non-empty,
 * meaning scaffolding would overwrite user files.
 */
export const canSafelyOverwrite = (dir: string): boolean => isEmptyDir(dir);
