/**
 * Utility helpers for the `vis create` command.
 *
 * - Package name validation & sanitisation
 * - Directory emptiness / conflict checks
 * - Target directory resolution
 */

import { existsSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

// ── Package name helpers ──────────────────────────────────────────

/**
 * Lightweight npm package name validation (covers the common cases).
 * Returns `true` when `name` is a valid, un-scoped or scoped npm name.
 */
export const isValidPackageName = (name: string): boolean => {
    // Must be non-empty, ≤214 chars, lowercase, no leading dot/underscore
    if (!name || name.length > 214) {
        return false;
    }

    // Scoped packages: @scope/name
    if (name.startsWith("@")) {
        const slashIndex = name.indexOf("/");

        if (slashIndex === -1 || slashIndex === name.length - 1) {
            return false;
        }

        const scope = name.slice(1, slashIndex);
        const pkg = name.slice(slashIndex + 1);

        return /^[a-z\d][\w.-]*$/.test(scope) && /^[a-z\d][\w.-]*$/.test(pkg);
    }

    return /^[a-z\d][\w.-]*$/.test(name);
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
