/**
 * Template discovery — identifies and resolves template sources from user input.
 *
 * Supports:
 * - Built-in templates prefixed with `vis:` (app, library, monorepo, generator)
 * - npm `create-*` packages (with shorthand expansion)
 * - GitHub URLs (normalised to degit format)
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

// ── GitHub URL detection ──────────────────────────────────────────

const GITHUB_URL_RE = /^(?:https?:\/\/)?(?:www\.)?github\.com\/(?<owner>[^/]+)\/(?<repo>[^/#]+)(?:\/tree\/(?<branch>[^/]+)(?:\/(?<subdir>.+))?)?/;
const GITHUB_SHORT_RE = /^(?<owner>[^/#@]+)\/(?<repo>[^/#@]+)(?:#(?<branch>.+))?$/;

/**
 * Parse a GitHub URL or shorthand (`owner/repo`, `owner/repo#branch`)
 * into a degit-compatible source string.
 *
 * Returns `null` when the input is not a GitHub reference.
 */
export const parseGitHubUrl = (input: string): string | null => {
    const full = GITHUB_URL_RE.exec(input);

    if (full?.groups) {
        const { branch, owner, repo, subdir } = full.groups;
        let source = `${owner}/${repo}`;

        if (subdir) {
            source += `/${subdir}`;
        }

        if (branch) {
            source += `#${branch}`;
        }

        return source;
    }

    // owner/repo or owner/repo#branch — but not scoped npm packages (@scope/name)
    if (!input.startsWith("@")) {
        const short = GITHUB_SHORT_RE.exec(input);

        if (short?.groups) {
            const { branch, owner, repo } = short.groups;
            let source = `${owner}/${repo}`;

            if (branch) {
                source += `#${branch}`;
            }

            return source;
        }
    }

    return null;
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
    if (name.startsWith("create-") || name.startsWith("@") && name.includes("/create-")) {
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
    // 1. Built-in?
    const lower = input.toLowerCase();
    const builtinType = BUILTIN_MAP[lower];

    if (builtinType) {
        return { args: extraArgs, source: lower, type: builtinType };
    }

    // 2. GitHub URL or shorthand?
    const ghSource = parseGitHubUrl(input);

    if (ghSource) {
        return { args: extraArgs, source: ghSource, type: "remote:github" };
    }

    // 3. Assume npm create package
    return { args: extraArgs, source: expandCreateShorthand(input), type: "remote:npm" };
};

// ── Parent directory inference ─────────────────────────────────────

/**
 * Suggest the most appropriate parent directory for a new project based on
 * the template type and current workspace layout.
 */
export const inferParentDir = (type: TemplateType, _cwd: string): string => {
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
