/**
 * Template discovery — identifies and resolves template sources from user input.
 *
 * Supports:
 * - Built-in templates prefixed with `vis:` (app, library, monorepo, generator)
 * - npm `create-*` packages (with shorthand expansion)
 * - Git repositories from GitHub, GitLab, and Bitbucket (all URL formats)
 */

import type { TemplateConfig, TemplateType } from "./templates/types";

// ── Built-in templates ────────────────────────────────────────────

const BUILTIN_MAP: Record<string, TemplateType> = {
    "vis:app": "builtin:app",
    "vis:application": "builtin:app",
    "vis:generator": "builtin:generator",
    "vis:lib": "builtin:library",
    "vis:library": "builtin:library",
    "vis:monorepo": "builtin:monorepo",
};

// ── Git URL detection ─────────────────────────────────────────────

/**
 * Patterns that identify a git repository URL.
 *
 * Matches:
 * - https://github.com/owner/repo (and gitlab.com, bitbucket.org)
 * - git@github.com:owner/repo
 * - github:owner/repo, gitlab:owner/repo, bitbucket:owner/repo
 * - owner/repo (GitHub shorthand — but NOT scoped npm packages)
 * - owner/repo#branch
 * - Any of the above with /tree/branch/path or /blob/branch/path
 */

const GIT_HOST_PREFIXES = [
    // Full HTTPS URLs
    "https://github.com/",
    "https://gitlab.com/",
    "https://bitbucket.org/",
    "https://raw.githubusercontent.com/",
    "https://git.sr.ht/",
    // SSH URLs
    "git@github.com:",
    "git@gitlab.com:",
    "git@bitbucket.org:",
    "git@git.sr.ht:",
    // Provider prefixes (giget-compatible)
    "github:",
    "gh:",
    "gitlab:",
    "bitbucket:",
    "sourcehut:",
    "git:",
];

/**
 * Check if the input looks like a git repository reference.
 * Returns the raw input as the source for the git-download module to parse.
 */
export const isGitUrl = (input: string): boolean => {
    // Explicit host prefix
    for (const prefix of GIT_HOST_PREFIXES) {
        if (input.startsWith(prefix)) {
            return true;
        }
    }

    // owner/repo shorthand (but NOT @scope/package — that's npm)
    if (!input.startsWith("@") && /^[^/#@][^/#]*\/[^/#]+/.test(input)) {
        return true;
    }

    return false;
};

// ── npm shorthand expansion ───────────────────────────────────────

/**
 * Expand shorthand npm create names following the `npm create` convention:
 *
 * - `vite`       → `create-vite`
 * - `@scope/foo` → `@scope/create-foo`
 * - `create-vue` → `create-vue` (already expanded)
 */
export const expandCreateShorthand = (name: string): string => {
    // Already has the `create-` prefix
    if (name.startsWith("create-") || (name.startsWith("@") && name.includes("/create-"))) {
        return name;
    }

    // Scoped: @scope/foo → @scope/create-foo
    if (name.startsWith("@")) {
        const slashIndex = name.indexOf("/");

        if (slashIndex !== -1) {
            const scope = name.slice(0, slashIndex);
            const pkg = name.slice(slashIndex + 1);

            return `${scope}/create-${pkg}`;
        }

        // Bare @scope without slash — invalid, return as-is
        return name;
    }

    // Bare name: vite → create-vite
    return `create-${name}`;
};

// ── Main discovery ────────────────────────────────────────────────

/**
 * Given the raw template string from the user, determine what kind of
 * template it is and return a resolved {@link TemplateConfig}.
 */
export const discoverTemplate = (input: string, extraArgs: string[] = []): TemplateConfig => {
    if (!input) {
        throw new Error("No template specified.");
    }

    // 1. Built-in?
    const lower = input.toLowerCase();
    const builtinType = BUILTIN_MAP[lower];

    if (builtinType) {
        return { args: extraArgs, source: lower, type: builtinType };
    }

    // 2. Git repository URL? (GitHub, GitLab, Bitbucket)
    if (isGitUrl(input)) {
        return { args: extraArgs, source: input, type: "remote:git" };
    }

    // 3. Assume npm create package
    return { args: extraArgs, source: expandCreateShorthand(input), type: "remote:npm" };
};

// ── Parent directory inference ─────────────────────────────────────

/**
 * Suggest the most appropriate parent directory for a new project based on
 * the template type and current workspace layout.
 */
export const inferParentDir = (type: TemplateType): string => {
    switch (type) {
        case "builtin:app": {
            return "apps";
        }
        case "builtin:generator":
        case "builtin:library": {
            return "packages";
        }
        default: {
            return ".";
        }
    }
};
