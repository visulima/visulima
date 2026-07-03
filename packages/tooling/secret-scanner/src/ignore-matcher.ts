import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import ignoreModule from "ignore";

import type { ScanOptions } from "./types";

// `ignore` ships as ESM and CJS; handle both default-export shapes transparently.
export interface IgnoreMatcher {
    add: (pattern: string | string[]) => IgnoreMatcher;
    ignores: (path: string) => boolean;
}

type IgnoreFactory = () => IgnoreMatcher;

const ignore: IgnoreFactory = (ignoreModule as { default?: IgnoreFactory }).default ?? ignoreModule;

/**
 * Build a gitignore matcher for the `scanFiles` path — it bypasses the native
 * walker and therefore has to filter paths itself. Returns `undefined` when the
 * caller supplied no ignore files or patterns (caller should skip filtering
 * entirely in that case).
 */
export const buildIgnoreMatcher = (options: ScanOptions | undefined): IgnoreMatcher | undefined => {
    const ignoreFiles = options?.walk?.excludeFromFiles ?? [];
    const patterns = options?.walk?.excludePatterns ?? [];

    if (ignoreFiles.length === 0 && patterns.length === 0) {
        return undefined;
    }

    const matcher = ignore();

    for (const file of ignoreFiles) {
        if (!existsSync(file)) {
            continue;
        }

        try {
            matcher.add(readFileSync(file, "utf8"));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            // eslint-disable-next-line no-console -- Diagnostic output; stderr is the intended channel for library warnings.
            console.error(`secret-scanner: failed to read ignore file ${file}: ${message}`);
        }
    }

    if (patterns.length > 0) {
        matcher.add(patterns);
    }

    return matcher;
};

/**
 * Filter `files` down to those *not* matched by `matcher`. When `matcher` is
 * undefined, the list passes through unchanged (callers don't need to special-
 * case the empty-matcher path).
 */
export const filterIgnoredFiles = (files: string[], matcher: IgnoreMatcher | undefined, cwd: string): string[] => {
    if (!matcher) {
        return files;
    }

    // On macOS, process.cwd() resolves symlinks (/private/var/…) while
    // mkdtemp & path.resolve keep the un-resolved form (/var/…). On Windows the
    // JS realpathSync also leaves 8.3 short names (RUNNER~1) and drive-letter
    // case unnormalized, so canonicalize through realpathSync.native — that way
    // relative() compares like with like instead of emitting an absolute path
    // (different-drive/-case) that would make matcher.ignores() throw.
    const canonicalize = (p: string): string => {
        try {
            return realpathSync.native(p);
        } catch {
            try {
                return realpathSync(p);
            } catch {
                return p;
            }
        }
    };

    const resolvedCwd = canonicalize(cwd);

    return files.filter((file) => {
        const absolute = isAbsolute(file) ? file : resolve(resolvedCwd, file);
        const realAbsolute = canonicalize(absolute);
        const relativePath = relative(resolvedCwd, realAbsolute);

        // Outside cwd (── "", "..", or an absolute path when on a different
        // drive) → not subject to cwd-relative ignore patterns. The absolute
        // guard is load-bearing: `ignore` throws on a non-relative path.
        if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
            return true;
        }

        return !matcher.ignores(relativePath);
    });
};
