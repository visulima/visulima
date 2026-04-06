/**
 * Template discovery — identifies and resolves template sources from user input.
 *
 * Supports:
 * - Built-in templates prefixed with `vis:` (app, library, monorepo, generator)
 * - npm `create-*` packages (with shorthand expansion)
 * - Git repositories from GitHub, GitLab, Bitbucket, and Sourcehut (all URL formats)
 * - Direct tarball/registry URLs via giget's http/https providers
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

/**
 * All prefixes that route to giget's `downloadTemplate` (remote:git).
 * Covers every giget provider: github/gh, gitlab, bitbucket, sourcehut, git, http/https.
 *
 * Note: `http://` and `https://` are intentionally included as catch-all entries
 * so giget's HTTP provider can handle direct tarball or registry URLs
 * (e.g., `https://example.com/templates/my-template.tar.gz`).
 * They must be listed AFTER the more specific host prefixes (github.com, etc.)
 * so those match first. Invalid URLs are rejected later by giget in remote.ts.
 *
 * The `isGitUrl()` function below also handles `owner/repo` shorthand
 * detection separately — bare names without a prefix are routed to npm instead.
 */
const GIGET_PREFIXES = [
    // Full HTTPS URLs for known hosts (must come before generic https://)
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
    // Catch-all: direct tarball / registry URLs (giget http/https provider)
    "http://",
    "https://",
];

/**
 * Check if the input looks like a git/tarball URL that giget can handle.
 */
export const isGitUrl = (input: string): boolean => {
    // Explicit host or provider prefix
    for (const prefix of GIGET_PREFIXES) {
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
