import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join, relative } from "@visulima/path";

/**
 * Pattern set used to decide whether a file participates in a lint /
 * fmt run. Built by merging:
 *
 * 1. `.gitignore` at the workspace root (when present)
 * 2. Tool-native ignore files supplied by individual adapters
 *    (eslint passes `.eslintignore`, prettier passes `.prettierignore`)
 * 3. User-supplied patterns from `vis.config.ts` (`lint.ignore`,
 *    `fmt.ignore`)
 *
 * Patterns use gitignore semantics: lines starting with `#` are
 * comments, blank lines are skipped, leading `!` negates a prior
 * match, trailing `/` restricts to directories.
 *
 * This module deliberately implements the minimum needed by Phase 1 —
 * each adapter still applies its own ignore semantics through its
 * native CLI, so this filter is the union of *vis-level* rules, not
 * a re-implementation of full gitignore behavior.
 */

export interface IgnoreRule {
    /** Original pattern, unmodified — kept for debugging. */
    readonly pattern: string;
    /** True when the rule negates a previous match (`!` prefix). */
    readonly negated: boolean;
    /** True when the pattern only matches directories (trailing `/`). */
    readonly directoryOnly: boolean;
    /** Compiled regex used for matching. */
    readonly regex: RegExp;
}

const COMMENT_OR_BLANK = /^\s*(?:#.*)?$/;

/**
 * Translate a gitignore-style pattern to a RegExp anchored at the
 * workspace root. The translation is intentionally simple: `*` does
 * not cross `/`, `**` does, leading `/` anchors to root.
 */
const compilePattern = (pattern: string): RegExp => {
    let body = pattern;

    if (body.startsWith("/")) {
        body = body.slice(1);
    }

    let regex = "";
    let index = 0;

    while (index < body.length) {
        const char = body[index]!;

        if (char === "*") {
            if (body[index + 1] === "*") {
                regex += ".*";
                index += 2;

                if (body[index] === "/") {
                    index += 1;
                }
            } else {
                regex += "[^/]*";
                index += 1;
            }
        } else if (char === "?") {
            regex += "[^/]";
            index += 1;
        } else if (".+()[]{}^$|\\".includes(char)) {
            regex += `\\${char}`;
            index += 1;
        } else {
            regex += char;
            index += 1;
        }
    }

    // Match either an exact hit or any descendant.
    return new RegExp(`^${regex}(?:/.*)?$`);
};

const parsePatterns = (raw: string): IgnoreRule[] => {
    const rules: IgnoreRule[] = [];

    for (const line of raw.split(/\r?\n/)) {
        if (COMMENT_OR_BLANK.test(line)) {
            continue;
        }

        let pattern = line.trim();
        const negated = pattern.startsWith("!");

        if (negated) {
            pattern = pattern.slice(1);
        }

        const directoryOnly = pattern.endsWith("/");

        if (directoryOnly) {
            pattern = pattern.slice(0, -1);
        }

        rules.push({
            directoryOnly,
            negated,
            pattern: line.trim(),
            regex: compilePattern(pattern),
        });
    }

    return rules;
};

/**
 * Load ignore patterns from a file, returning an empty array if the
 * file doesn't exist. Used by adapters that want to feed
 * `.eslintignore` / `.prettierignore` into the shared filter.
 */
export const loadIgnoreFile = (path: string): IgnoreRule[] => {
    if (!isAccessibleSync(path)) {
        return [];
    }

    try {
        return parsePatterns(readFileSync(path));
    } catch {
        return [];
    }
};

/**
 * Build a merged ignore rule set from the standard inputs. Adapters
 * may append their own rules to the returned array before passing it
 * to `isIgnored`.
 */
export const buildIgnoreRules = (
    root: string,
    extras: ReadonlyArray<string> = [],
    extraFiles: ReadonlyArray<string> = [],
): IgnoreRule[] => {
    const rules: IgnoreRule[] = [];

    rules.push(...loadIgnoreFile(join(root, ".gitignore")));

    for (const file of extraFiles) {
        rules.push(...loadIgnoreFile(file));
    }

    rules.push(...parsePatterns(extras.join("\n")));

    return rules;
};

/**
 * Decide whether a file is ignored. Resolves the file to a path
 * relative to `root` and walks the rule list; later rules override
 * earlier ones, matching gitignore precedence semantics.
 *
 * `isDirectory` defaults to `false` — call sites that know the file
 * is a directory should pass `true` so directory-only patterns (`dist/`)
 * apply correctly.
 */
export const isIgnored = (root: string, filePath: string, rules: ReadonlyArray<IgnoreRule>, isDirectory = false): boolean => {
    const relativePath = relative(root, filePath).replaceAll("\\", "/");
    let ignored = false;

    for (const rule of rules) {
        if (rule.directoryOnly && !isDirectory) {
            continue;
        }

        if (rule.regex.test(relativePath)) {
            ignored = !rule.negated;
        }
    }

    return ignored;
};

/**
 * Filter a list of files down to those that survive the ignore set.
 * Preserves input order — callers usually feed an already-sorted
 * list (glob output) and rely on stable ordering downstream.
 */
export const filterIgnored = (root: string, files: ReadonlyArray<string>, rules: ReadonlyArray<IgnoreRule>): string[] => {
    const out: string[] = [];

    for (const file of files) {
        if (!isIgnored(root, file, rules)) {
            out.push(file);
        }
    }

    return out;
};
