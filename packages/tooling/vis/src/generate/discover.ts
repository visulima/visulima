/**
 * Template discovery for `vis generate`.
 *
 * Discovery sources, in priority order:
 *   1. Native templates in `&lt;workspace>/.vis/templates/&lt;name>.{ts,js,mjs}`.
 *   2. Moon-format directories in `&lt;workspace>/.vis/templates/&lt;name>/`
 *      (any directory with a `template.yml`).
 *   3. Moon-format directories in `&lt;workspace>/.moon/templates/&lt;name>/`
 *      (zero-config import for users mid-migration from moon).
 *   4. Extra directories listed in `vis.config.ts` `generator.templates`.
 *   5. Builtin templates shipped with vis (lowest priority — any user
 *      template with the same name overrides). The directory is
 *      `&lt;package-root>/templates/&lt;name>/` and ships via the package's
 *      `files` array.
 *
 * Native templates win over moon templates with the same name; a
 * warning is printed at discovery time so the conflict is visible.
 */

import { fileURLToPath } from "node:url";

import { isAccessibleSync, walkSync } from "@visulima/fs";
import { dirname, join } from "@visulima/path";

import type { DiscoveredTemplate } from "./types";

const NATIVE_EXTENSIONS = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];
const TEMPLATE_YML = "template.yml";

/**
 * Suffix blocklist applied after the language extension is stripped.
 * Folks drop shared types, sourcemaps, and colocated tests into
 * `.vis/templates/`; those must NOT be mis-identified as templates
 * (importing a `.d.ts` or `.test.ts` via jiti would throw with a
 * confusing message).
 *
 * Each entry is the suffix BEFORE the language extension, e.g.
 * `package.d.ts` → base `package.d` → match `.d`. We also reject
 * sourcemaps and type-declaration files outright.
 */
const BLOCKED_BASE_SUFFIXES = [".d", ".test", ".spec", ".config", ".bench", ".stories"];
const BLOCKED_FULL_EXTENSIONS = [".d.ts", ".d.mts", ".d.cts", ".js.map", ".mjs.map", ".cjs.map", ".ts.map"];

const stripExtension = (filename: string): string => {
    for (const ext of NATIVE_EXTENSIONS) {
        if (filename.endsWith(ext)) {
            return filename.slice(0, -ext.length);
        }
    }

    return filename;
};

const isNativeFile = (filename: string): boolean => {
    if (BLOCKED_FULL_EXTENSIONS.some((ext) => filename.endsWith(ext))) {
        return false;
    }

    if (!NATIVE_EXTENSIONS.some((ext) => filename.endsWith(ext))) {
        return false;
    }

    const base = stripExtension(filename);

    return !BLOCKED_BASE_SUFFIXES.some((suffix) => base.endsWith(suffix));
};

interface DiscoverOptions {
    /** Extra template directories from `vis.config.ts` `generator.templates`. */
    extraDirectories?: string[];
    /** Logger callback for conflict warnings. */
    onWarning?: (message: string) => void;
    /** Workspace root — `.vis/templates/` and `.moon/templates/` are resolved against this. */
    workspaceRoot: string;
}

const scanNativeDirectory = (directory: string, source: DiscoveredTemplate["source"]): DiscoveredTemplate[] => {
    const results: DiscoveredTemplate[] = [];

    if (!isAccessibleSync(directory)) {
        return results;
    }

    for (const entry of walkSync(directory, { includeDirs: false, includeSymlinks: false, maxDepth: 1 })) {
        if (!isNativeFile(entry.name)) {
            continue;
        }

        const name = stripExtension(entry.name);

        results.push({
            // Lazy loader — module is loaded only when the user picks the template.

            load: () => loadNativeFromPath(entry.path),
            name,
            path: entry.path,
            source,
        });
    }

    return results;
};

const scanMoonDirectory = (directory: string, source: DiscoveredTemplate["source"]): DiscoveredTemplate[] => {
    const results: DiscoveredTemplate[] = [];

    if (!isAccessibleSync(directory)) {
        return results;
    }

    for (const entry of walkSync(directory, { includeFiles: false, includeSymlinks: false, maxDepth: 1 })) {
        if (entry.path === directory) {
            continue;
        }

        const yamlPath = join(entry.path, TEMPLATE_YML);

        if (!isAccessibleSync(yamlPath)) {
            continue;
        }

        results.push({
            load: () => loadMoonFromPath(entry.path, entry.name),
            name: entry.name,
            path: entry.path,
            source,
        });
    }

    return results;
};

/**
 * Resolve the builtin templates directory shipped with the vis package.
 *
 * In dev (running from `src/`) `import.meta.url` points at
 * `<root>/src/generate/discover.ts`; in prod (bundled into `dist/`) it
 * points at `<root>/dist/generate/index.js`. Going up two levels lands
 * on the package root in both layouts, so the same `templates/` path
 * resolves correctly without a build-time substitution.
 *
 * Returns `undefined` when the directory isn't shipped (e.g. a stripped
 * install, or a future build that drops it) — callers fall back to
 * user-defined templates only.
 */
const resolveBuiltinTemplatesDirectory = (): string | undefined => {
    try {
        const here = fileURLToPath(import.meta.url);
        const candidate = join(dirname(here), "..", "..", "templates");

        return isAccessibleSync(candidate) ? candidate : undefined;
    } catch {
        return undefined;
    }
};

/**
 * Discover templates across the workspace. Returns a deduplicated list
 * with native sources winning over moon when names collide.
 */
export const discoverTemplates = (options: DiscoverOptions): DiscoveredTemplate[] => {
    const { extraDirectories = [], onWarning, workspaceRoot } = options;
    const results: DiscoveredTemplate[] = [];

    results.push(...scanNativeDirectory(join(workspaceRoot, ".vis", "templates"), "native"));
    results.push(...scanMoonDirectory(join(workspaceRoot, ".vis", "templates"), "moon"));
    results.push(...scanMoonDirectory(join(workspaceRoot, ".moon", "templates"), "moon"));

    for (const directory of extraDirectories) {
        results.push(...scanMoonDirectory(directory, "config"));
        results.push(...scanNativeDirectory(directory, "config"));
    }

    // Builtin templates come last so any user template wins when names
    // collide — important for users vendoring a customised copy of a
    // shipped preset.
    const builtinDirectory = resolveBuiltinTemplatesDirectory();

    if (builtinDirectory) {
        results.push(...scanMoonDirectory(builtinDirectory, "builtin"));
    }

    // Dedupe by name — first occurrence wins (native > moon > config > builtin),
    // matching the priority order described above.
    const seen = new Map<string, DiscoveredTemplate>();

    for (const template of results) {
        const existing = seen.get(template.name);

        if (!existing) {
            seen.set(template.name, template);
            continue;
        }

        if (onWarning) {
            onWarning(
                `Template "${template.name}" exists in multiple sources — using ${existing.source} (${existing.path}), ignoring ${template.source} (${template.path}).`,
            );
        }
    }

    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
};

// Lazy module loaders — pulled in only when the user actually runs a template.
const loadNativeFromPath = async (path: string) => {
    const { loadNativeTemplate } = await import("./loader");

    return loadNativeTemplate(path);
};

const loadMoonFromPath = async (path: string, name: string) => {
    const { loadMoonTemplate } = await import("./moon-adapter");

    return loadMoonTemplate(path, name);
};
