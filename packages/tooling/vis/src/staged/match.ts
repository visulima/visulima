import { basename, relative } from "@visulima/path";
import zeptomatch from "zeptomatch";

/**
 * Matches files against a glob pattern. Mirrors lint-staged's picomatch
 * `matchBase: true` semantics: patterns without a path separator match
 * against each candidate's basename, path-style patterns match against
 * paths relative to `cwd`. Negation (`!prefix`) is delegated to zeptomatch.
 */
const isPathStyle = (pattern: string): boolean => pattern.includes("/");

export const matchFiles = (pattern: string, files: ReadonlyArray<string>, cwd: string): string[] => {
    const pathStyle = isPathStyle(pattern);
    const matched: string[] = [];

    for (const absolute of files) {
        const candidate = pathStyle ? relative(cwd, absolute) : basename(absolute);

        if (zeptomatch(pattern, candidate)) {
            matched.push(absolute);
        }
    }

    return matched;
};

/**
 * Filters a staged file list against a top-level ignore list. A file is
 * dropped when any of the ignore patterns matches — basename-style for
 * patterns without a path separator, path-style relative to `cwd`
 * otherwise. Mirrors the `matchFiles` semantics so users don't have to
 * think twice about the ignore syntax.
 */
export const applyIgnore = (files: ReadonlyArray<string>, ignore: ReadonlyArray<string> | undefined, cwd: string): string[] => {
    if (!ignore || ignore.length === 0) {
        return [...files];
    }

    return files.filter((absolute) => {
        for (const pattern of ignore) {
            const candidate = isPathStyle(pattern) ? relative(cwd, absolute) : basename(absolute);

            if (zeptomatch(pattern, candidate)) {
                return false;
            }
        }

        return true;
    });
};
