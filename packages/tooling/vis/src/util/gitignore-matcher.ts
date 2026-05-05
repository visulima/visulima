import { readFileSync } from "node:fs";

import { isAbsolute, relative, resolve } from "@visulima/path";
import ignoreModule from "ignore";

interface IgnoreInstance {
    add: (pattern: string | string[]) => IgnoreInstance;
    ignores: (path: string) => boolean;
}

const ignoreFactory = (ignoreModule as { default?: () => IgnoreInstance }).default ?? ignoreModule;

const BUILTIN_EXCLUDES: string[] = [".git/", "node_modules/"];

const TRAILING_SLASH_RE = /\/+$/;

interface GitignoreMatcherOptions {
    /**
     * Always exclude `.git/` and `node_modules/`. Default: `true`.
     * The `ignore` package skips these by default for `filter`, but
     * `ignores()` does not — wire them in explicitly so both surfaces
     * agree.
     */
    builtinExcludes?: boolean;

    /**
     * Workspace root. Paths passed to the matcher are interpreted
     * relative to this directory.
     */
    cwd: string;

    /**
     * Additional gitignore-syntax files to layer on top of the root
     * `.gitignore`. Entries may be absolute, or relative to `cwd`.
     * Missing files are silently skipped so consumers can list optional
     * ignore sources without `existsSync` guards.
     */
    extraIgnoreFiles?: string[];

    /** Additional gitignore-syntax patterns to apply on top of every loaded file. */
    extraPatterns?: string[];

    /** Read the root `.gitignore` (at `cwd`). Default: `true`. */
    rootGitignore?: boolean;
}

interface GitignoreMatcher {
    /** Layer additional patterns on after construction. Returns the same matcher for chaining. */
    add: (patterns: string | string[]) => GitignoreMatcher;

    /** Drop ignored entries from `files`. Equivalent to `files.filter((f) => !matcher.ignores(f))`. */
    filter: (files: string[]) => string[];

    /**
     * Returns `true` when the given path is ignored. Absolute paths are
     * accepted and re-based against `cwd`; paths outside the workspace
     * are never reported as ignored.
     */
    ignores: (filePath: string) => boolean;
}

const safeRead = (filePath: string): string | undefined => {
    try {
        return readFileSync(filePath, "utf8");
    } catch {
        return undefined;
    }
};

const toForwardSlashes = (input: string): string => input.replaceAll("\\", "/");

/**
 * Extract gitignore-syntax exclude patterns from a list of workspace
 * patterns (pnpm-workspace.yaml `packages:` or package.json
 * `workspaces`). Returns the `!`-prefixed entries with the leading `!`
 * stripped, ready to be passed as `extraPatterns` of
 * {@link buildGitignoreMatcher}. Empty / undefined input yields `[]`.
 */
const extractWorkspaceExcludePatterns = (patterns: ReadonlyArray<string> | undefined): string[] => {
    if (!patterns || patterns.length === 0) {
        return [];
    }

    const result: string[] = [];

    for (const raw of patterns) {
        const trimmed = raw.replace(TRAILING_SLASH_RE, "");

        if (trimmed.startsWith("!")) {
            const stripped = trimmed.slice(1);

            if (stripped.length > 0) {
                result.push(stripped);
            }
        }
    }

    return result;
};

/**
 * Build a gitignore-aware matcher rooted at `cwd`. Layers, in order:
 * 1. built-in excludes (`.git/`, `node_modules/`),
 * 2. the root `.gitignore` (if present),
 * 3. extra ignore files supplied by the caller,
 * 4. extra inline patterns.
 *
 * Designed to be reused across commands that walk the workspace and
 * need to skip files inside ignored directories. Construction is cheap
 * — callers can build a fresh matcher per run.
 */
const buildGitignoreMatcher = (options: GitignoreMatcherOptions): GitignoreMatcher => {
    const { cwd } = options;
    const instance = ignoreFactory();

    if (options.builtinExcludes !== false) {
        instance.add(BUILTIN_EXCLUDES);
    }

    if (options.rootGitignore !== false) {
        const content = safeRead(resolve(cwd, ".gitignore"));

        if (content !== undefined) {
            instance.add(content);
        }
    }

    for (const file of options.extraIgnoreFiles ?? []) {
        const fullPath = isAbsolute(file) ? file : resolve(cwd, file);
        const content = safeRead(fullPath);

        if (content !== undefined) {
            instance.add(content);
        }
    }

    if (options.extraPatterns && options.extraPatterns.length > 0) {
        instance.add(options.extraPatterns);
    }

    const ignores = (filePath: string): boolean => {
        const absolute = isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
        const relativePath = toForwardSlashes(relative(cwd, absolute));

        if (relativePath === "" || relativePath.startsWith("../") || relativePath === "..") {
            return false;
        }

        return instance.ignores(relativePath);
    };

    const matcher: GitignoreMatcher = {
        add: (patterns) => {
            instance.add(patterns);

            return matcher;
        },
        filter: (files) => files.filter((file) => !ignores(file)),
        ignores,
    };

    return matcher;
};

export { buildGitignoreMatcher, extractWorkspaceExcludePatterns };
export type { GitignoreMatcher, GitignoreMatcherOptions };
