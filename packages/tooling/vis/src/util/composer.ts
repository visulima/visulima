/**
 * Composer manifests: the shared reader and the workspace walk. The release discovery
 * (`release/core/composer-projects.ts`) and the task resolver (`config/composer-projects.ts`)
 * both use it, so they see the same set of `composer.json` files.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Directories that never hold a package the workspace owns. Dot-directories are skipped too (`.worktrees`, `.git`). */
const SKIPPED_DIRECTORIES = new Set(["node_modules", "vendor"]);

/** Parses a `composer.json` (or `composer.lock`) body. Throws when the top level is not an object. */
export const parseComposerJson = (raw: string): Record<string, unknown> => {
    const value: unknown = JSON.parse(raw);

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new TypeError("the top level is not a JSON object");
    }

    return value as Record<string, unknown>;
};

/**
 * The version a lock entry carries. Composer's pretty version keeps the tag's `v` (`v6.4.1`),
 * while Packagist's advisory data and the purls use the bare number, so the `v` is dropped.
 */
export const composerVersionFromLock = (raw: string): string => raw.replace(/^v(?=\d)/u, "");

/** The keys of a `require`-style map (`{ "vendor/package": "^1.0" }`). Anything else is no entries. */
export const requireKeys = (manifest: Record<string, unknown>, key: "require" | "require-dev"): string[] => {
    const map = manifest[key];

    return typeof map === "object" && map !== null && !Array.isArray(map) ? Object.keys(map) : [];
};

/**
 * Absolute directories under `root` (including `root`) that hold a `composer.json`.
 * `vendor`, `node_modules` and dot-directories are not entered. Sorted for a stable order.
 */
export const findComposerManifestDirs = (root: string): string[] => {
    const dirs: string[] = [];

    const visit = (dir: string): void => {
        if (existsSync(join(dir, "composer.json"))) {
            dirs.push(dir);
        }

        let entries;

        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            // Symlinks are not followed: `isDirectory()` is false for them, so a link cannot loop.
            if (!entry.isDirectory() || entry.name.startsWith(".") || SKIPPED_DIRECTORIES.has(entry.name)) {
                continue;
            }

            visit(join(dir, entry.name));
        }
    };

    visit(root);

    return dirs.sort();
};
