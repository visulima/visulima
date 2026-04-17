import { basename, relative } from "@visulima/path";
import zeptomatch from "zeptomatch";

/**
 * Matches files against a glob pattern. Mirrors lint-staged's picomatch
 * `matchBase: true` semantics: patterns without a path separator match
 * against each candidate's basename, path-style patterns match against
 * paths relative to `cwd`. Negation (`!prefix`) is delegated to zeptomatch.
 *
 * `caseInsensitive` matches lint-staged's `picomatch({ nocase: true })`
 * when the working tree is on a case-insensitive filesystem (HFS+/APFS
 * default on macOS, NTFS on Windows). Both sides are lowercased before
 * comparison since zeptomatch itself has no nocase option.
 */
const isPathStyle = (pattern: string): boolean => pattern.includes("/");

const normalizeForMatch = (value: string, caseInsensitive: boolean): string => (caseInsensitive ? value.toLowerCase() : value);

export interface MatchOptions {
    readonly caseInsensitive?: boolean;
}

export const matchFiles = (pattern: string, files: ReadonlyArray<string>, cwd: string, options: MatchOptions = {}): string[] => {
    const pathStyle = isPathStyle(pattern);
    const caseInsensitive = options.caseInsensitive === true;
    const effectivePattern = normalizeForMatch(pattern, caseInsensitive);
    const matched: string[] = [];

    for (const absolute of files) {
        const candidate = pathStyle ? relative(cwd, absolute) : basename(absolute);

        if (zeptomatch(effectivePattern, normalizeForMatch(candidate, caseInsensitive))) {
            matched.push(absolute);
        }
    }

    return matched;
};

/**
 * Filters a staged file list against a top-level ignore list. A file is
 * dropped when any of the ignore patterns matches — basename-style for
 * patterns without a path separator, path-style relative to `cwd`
 * otherwise. Mirrors the `matchFiles` semantics (including `caseInsensitive`)
 * so users don't have to think twice about the ignore syntax.
 */
export const applyIgnore = (
    files: ReadonlyArray<string>,
    ignore: ReadonlyArray<string> | undefined,
    cwd: string,
    options: MatchOptions = {},
): string[] => {
    if (!ignore || ignore.length === 0) {
        return [...files];
    }

    const caseInsensitive = options.caseInsensitive === true;

    return files.filter((absolute) => {
        for (const pattern of ignore) {
            const candidate = isPathStyle(pattern) ? relative(cwd, absolute) : basename(absolute);
            const effectivePattern = normalizeForMatch(pattern, caseInsensitive);

            if (zeptomatch(effectivePattern, normalizeForMatch(candidate, caseInsensitive))) {
                return false;
            }
        }

        return true;
    });
};
