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
 *
 * Native templates win over moon templates with the same name; a
 * warning is printed at discovery time so the conflict is visible.
 */

import { isAccessibleSync, walkSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { DiscoveredTemplate } from "./types";

const NATIVE_EXTENSIONS = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];
const TEMPLATE_YML = "template.yml";

const stripExtension = (filename: string): string => {
    for (const ext of NATIVE_EXTENSIONS) {
        if (filename.endsWith(ext)) {
            return filename.slice(0, -ext.length);
        }
    }

    return filename;
};

const isNativeFile = (filename: string): boolean => NATIVE_EXTENSIONS.some((ext) => filename.endsWith(ext));

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

    // Dedupe by name — first occurrence wins (native > moon > config),
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
