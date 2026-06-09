/**
 * Resolve a `release.changelog` config value to a `ChangelogFormatter`.
 *
 * Accepts:
 *   - `false`      → no-op formatter (returns empty string)
 *   - `"default"`  → built-in default
 *   - `"github"`   → built-in github (with default options)
 *   - `string`     → path to a custom module
 *   - `[string, options]` → path + options for the custom module
 */

import { pathToFileURL } from "node:url";

import type { VisReleaseConfig } from "../../types";
import type { ChangelogFormatter, ChangelogFormatterModule } from "./api";
import { createDefaultFormatter, defaultFormatter } from "./default";
import { createGithubFormatter } from "./github";
import { createKeepAChangelogFormatter } from "./keep-a-changelog";

export const resolveFormatter = async (
    setting: VisReleaseConfig["changelog"],
    cwd: string,
): Promise<ChangelogFormatter> => {
    if (setting === false) {
        return () => "";
    }

    if (setting === undefined || setting === "default") {
        return defaultFormatter;
    }

    if (setting === "github") {
        return createGithubFormatter();
    }

    if (setting === "keep-a-changelog" || setting === "keepachangelog") {
        return createKeepAChangelogFormatter();
    }

    let path: string;
    let options: Record<string, unknown> = {};

    if (Array.isArray(setting)) {
        [path, options = {}] = setting;
    } else {
        path = setting;
    }

    if (path === "default") {
        return createDefaultFormatter(options);
    }

    if (path === "github") {
        return createGithubFormatter(options);
    }

    if (path === "keep-a-changelog" || path === "keepachangelog") {
        return createKeepAChangelogFormatter(options);
    }

    // Path to user module. The import is deferred through a helper file that
    // packem doesn't statically analyse — the path comes from runtime config
    // and isn't statically resolvable.
    const resolvedPath = path.startsWith(".") ? `${cwd}/${path}` : path;
    const moduleUrl = pathToFileURL(resolvedPath).href;
    const { dynamicEsmImport } = await import("./dynamic-import");
    const loaded = (await dynamicEsmImport(moduleUrl)) as ChangelogFormatterModule;
    const exported = typeof loaded === "function" ? loaded : loaded.default;

    if (typeof exported !== "function") {
        throw new TypeError(`Custom changelog formatter at ${path} did not export a default function or a callable module.`);
    }

    // Tuple form [path, options]: support both shapes — exporter is either a
    // factory `(options) => formatter` or already the formatter itself. We
    // can't tell which without calling, so guard the probe call: if it throws
    // (because we passed `options` to a formatter that expects a ChangelogContext)
    // or doesn't return a function, fall back to the original export.
    if (Array.isArray(setting)) {
        try {
            const created = (exported as unknown as (opts: Record<string, unknown>) => unknown)(options);

            if (typeof created === "function") {
                return created as ChangelogFormatter;
            }
        } catch {
            // Not a factory — fall through and use the export as-is.
        }
    }

    return exported;
};
