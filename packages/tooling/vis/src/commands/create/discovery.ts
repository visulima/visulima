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

const BUILTIN_MAP: Record<string, TemplateType> = {
    "vis:app": "builtin:app",
    "vis:application": "builtin:app",
    "vis:generator": "builtin:generator",
    "vis:lib": "builtin:library",
    "vis:library": "builtin:library",
    "vis:monorepo": "builtin:monorepo",
};

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
 * @param input Raw user input string.
 * @returns `true` when the input matches a known git host, provider prefix, or URL scheme.
 */
export const isGitUrl = (input: string): boolean => {
    // Explicit host or provider prefix
    for (const prefix of GIGET_PREFIXES) {
        if (input.startsWith(prefix)) {
            return true;
        }
    }

    // owner/repo shorthand (but NOT @scope/package — that's npm)
    return !input.startsWith("@") && /^[^/#@][^/#]*\/[^/#]+/.test(input);
};

/**
 * Names that are used as direct npm executables (not `create-*` packages).
 * These must not be expanded — they are passed directly to `dlx` and
 * matched against AUTO_FIXES keys in remote.ts.
 */
const DIRECT_PACKAGES = new Set(["sv"]);

/**
 * Expand shorthand npm create names following the `npm create` convention.
 *
 * Mappings:
 * - `vite`       → `create-vite`.
 * - `@scope/foo` → `@scope/create-foo`.
 * - `create-vue` → `create-vue` (already expanded).
 * - `sv`         → `sv` (direct-package initialiser, not expanded).
 * @param name Bare package name or scoped package name.
 * @returns Expanded package name suitable for `dlx`.
 */
export const expandCreateShorthand = (name: string): string => {
    // Direct-package initializers that should not be expanded
    if (DIRECT_PACKAGES.has(name)) {
        return name;
    }

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

/**
 * Given the raw template string from the user, determine what kind of
 * template it is and return a resolved {@link TemplateConfig}.
 * @param input Raw template string (e.g., "vis:app", "vite", "user/repo").
 * @param extraArgs Additional CLI arguments to forward to the template runner.
 * @returns Resolved template configuration with type, source, and args.
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

/**
 * Suggest the most appropriate parent directory for a new project based on
 * the template type.
 * @param type The resolved template type.
 * @returns Suggested parent directory name ("apps", "packages", or ".").
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
