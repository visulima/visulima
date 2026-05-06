import { isAccessibleSync, walkSync } from "@visulima/fs";
import { join, resolve } from "@visulima/path";

import { readPnpmWorkspacePatterns, readWorkspacePatterns } from "../config/workspace";

/**
 * A workspace pattern matched a directory, but the directory has no
 * `package.json`.
 *
 * That's almost always a stale/abandoned package: the folder exists
 * but isn't a valid pnpm/npm/yarn workspace member, so installs and
 * task discovery silently skip it. Either the directory should be
 * deleted or a `package.json` scaffolded.
 *
 * Detection-only by default — autocreating a package.json at a
 * mystery directory would mask the real intent. Use `vis create` /
 * the `package-json/init` skill if you want to scaffold.
 */
export interface MissingPackageJsonIssue {
    /** Workspace-relative directory that's missing the file. */
    packageDir: string;
}

const TRAILING_SLASH_RE = /\/+$/;
const NODE_MODULES_RE = /node_modules/;
const DOT_GIT_RE = /\.git/;
const REGEX_SPECIALS_RE = /[$()+.?[\\\]^{|}]/g;
const NESTED_OR_DOUBLE_SUFFIX_RE = /\/\*\*$|\/\*\/\*$/;

/**
 * Resolve a positive workspace pattern to every directory that matches —
 * including those *without* a `package.json`. The `collectWorkspace*`
 * helpers in `util/workspace-deps.ts` deliberately filter out
 * package-less dirs (downstream lints would crash trying to read a
 * non-existent file); this lint specifically needs the unfiltered list.
 */
const collectPatternMatches = (workspaceRoot: string, pattern: string): string[] => {
    const cleanPattern = pattern.replace(TRAILING_SLASH_RE, "");

    if (cleanPattern.startsWith("!")) {
        return [];
    }

    const matches: string[] = [];

    if (cleanPattern.endsWith("/*")) {
        const base = cleanPattern.slice(0, -2);
        const baseDirectory = resolve(workspaceRoot, base);

        if (!isAccessibleSync(baseDirectory)) {
            return [];
        }

        for (const entry of walkSync(baseDirectory, { includeFiles: false, includeSymlinks: false, maxDepth: 1, skip: [NODE_MODULES_RE, DOT_GIT_RE] })) {
            if (entry.path === baseDirectory || entry.name.startsWith(".")) {
                continue;
            }

            matches.push(join(base, entry.name));
        }

        return matches;
    }

    if (cleanPattern.endsWith("/**") || cleanPattern.endsWith("/*/*")) {
        const base = cleanPattern.replace(NESTED_OR_DOUBLE_SUFFIX_RE, "");
        const baseDirectory = resolve(workspaceRoot, base);

        if (!isAccessibleSync(baseDirectory)) {
            return [];
        }

        for (const entry of walkSync(baseDirectory, { includeFiles: false, includeSymlinks: false, skip: [NODE_MODULES_RE, DOT_GIT_RE] })) {
            if (entry.path === baseDirectory) {
                continue;
            }

            const relativePath = entry.path.slice(baseDirectory.length + 1);

            matches.push(`${base}/${relativePath}`);
        }

        return matches;
    }

    if (!cleanPattern.includes("/") && cleanPattern.includes("*")) {
        const escaped = cleanPattern.replaceAll(REGEX_SPECIALS_RE, "\\$&").replaceAll("*", ".*");
        const regex = new RegExp(`^${escaped}$`);

        for (const entry of walkSync(workspaceRoot, { includeFiles: false, includeSymlinks: false, maxDepth: 1, skip: [NODE_MODULES_RE, DOT_GIT_RE] })) {
            if (entry.path === workspaceRoot) {
                continue;
            }

            if (regex.test(entry.name)) {
                matches.push(entry.name);
            }
        }

        return matches;
    }

    const fullPath = resolve(workspaceRoot, cleanPattern);

    if (isAccessibleSync(fullPath)) {
        matches.push(cleanPattern);
    }

    return matches;
};

/**
 * Walk every workspace pattern and report the directories that match
 * but lack a `package.json`. The root is excluded — sherif treats it
 * the same way, and `lint` already has dedicated `root-*` rules.
 *
 * Reads patterns from `pnpm-workspace.yaml` first, then
 * `package.json#workspaces` (mirrors the rest of vis's lookup order).
 * Excludes (`!pattern`) are intentionally not honored — vis's pattern
 * resolver doesn't honor them yet, and silently respecting them here
 * would diverge from the rest of the lint surface.
 */
export const lintMissingPackageJson = (workspaceRoot: string): MissingPackageJsonIssue[] => {
    const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);
    const patterns = pnpmPatterns ?? readWorkspacePatterns(workspaceRoot) ?? [];
    const seen = new Set<string>();
    const issues: MissingPackageJsonIssue[] = [];

    for (const pattern of patterns) {
        for (const directory of collectPatternMatches(workspaceRoot, pattern)) {
            if (directory === "." || seen.has(directory)) {
                continue;
            }

            seen.add(directory);

            if (!isAccessibleSync(join(workspaceRoot, directory, "package.json"))) {
                issues.push({ packageDir: directory });
            }
        }
    }

    return issues;
};
