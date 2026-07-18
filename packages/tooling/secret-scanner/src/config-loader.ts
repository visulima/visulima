import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line import/no-extraneous-dependencies
import { readJsonSync } from "@visulima/fs";
// eslint-disable-next-line import/no-extraneous-dependencies
import { dirname, resolve } from "@visulima/path";

interface GitleaksRule {
    [key: string]: unknown;
    defaultEnabled?: boolean;
    id?: string;
    tags?: string[];
}

interface GitleaksConfig {
    allowlist?: unknown;
    allowlists?: unknown[];
    description?: string;
    extend?: { disabledRules?: string[]; path?: string; useDefault?: boolean };
    rules?: GitleaksRule[];
}

interface ConfigLoadOptions {
    config?: GitleaksConfig;
    configPath?: string;
    extendBundled?: boolean;
}

const here: string = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));

// Two supported layouts:
//   - `src/config-loader.ts`         → walk up 1 to package root, then `data/`.
//   - `dist/<bundle>/index.js`       → walk up 2 to package root, then `data/`.
// The 4-level cap is defensive headroom for nested build outputs (vitest, tsx
// wrappers, etc.); we never expect to need more than 2 in practice.
const resolveDataDir = (): string => {
    let dir = here;

    for (let i = 0; i < 4; i += 1) {
        if (existsSync(resolve(dir, "data", "ruleset.json"))) {
            return resolve(dir, "data");
        }

        dir = resolve(dir, "..");
    }

    return resolve(here, "..", "data");
};

const dataDir = resolveDataDir();
const bundledConfigPath: string = resolve(dataDir, "ruleset.json");

let bundledCache: GitleaksConfig | undefined;

/**
 * Load the bundled ruleset — union of gitleaks + Kingfisher rules plus the
 * opt-in preset bundles. Cached on first read.
 */
const getBundledConfig = (): GitleaksConfig => {
    bundledCache ??= readJsonSync(bundledConfigPath) as GitleaksConfig;

    return bundledCache;
};

const mergeConfigs = (base: GitleaksConfig, overlay: GitleaksConfig): GitleaksConfig => {
    const overlayRuleIds = new Set((overlay.rules ?? []).filter((r): r is GitleaksRule & { id: string } => typeof r?.id === "string").map((r) => r.id));
    const baseRules = (base.rules ?? []).filter((r) => typeof r?.id !== "string" || !overlayRuleIds.has(r.id));

    // Allowlists *extend* rather than replace — gitleaks `extend` semantics. The
    // bundled ruleset ships several top-level global allowlists; replacing them
    // wholesale with the user's single entry would silently re-enable
    // false-positive matches across every bundled rule. A user's top-level
    // singular `allowlist` is folded into the same concatenated list so it
    // survives alongside the bundled ones.
    const mergedAllowlists = [
        ...(Array.isArray(base.allowlists) ? base.allowlists : []),
        ...(base.allowlist === undefined ? [] : [base.allowlist]),
        ...(Array.isArray(overlay.allowlists) ? overlay.allowlists : []),
        ...(overlay.allowlist === undefined ? [] : [overlay.allowlist]),
    ];

    return {
        allowlists: mergedAllowlists.length > 0 ? mergedAllowlists : undefined,
        description: overlay.description ?? base.description,
        extend: overlay.extend ?? base.extend,
        rules: [...baseRules, ...(overlay.rules ?? [])],
    };
};

// Path → { mtimeMs, size, config } cache. Keyed on mtime+size (not the path
// alone) so a long-lived host — an editor integration calling `scanString` per
// keystroke — picks up edits to the config file without a restart. Mirrors the
// invalidation the sibling baseline cache does for the same use case.
const resolveCache = new Map<string, { config: GitleaksConfig; mtimeMs: number; size: number }>();

// Read a user config from disk, reusing the cached parse when the file's
// mtime+size are unchanged since the last load. A failed stat (race /
// permissions) falls through to an uncached read that surfaces the real error.
const readUserConfig = (absolute: string): GitleaksConfig => {
    let statKey: { mtimeMs: number; size: number } | undefined;

    try {
        const stats = statSync(absolute);

        statKey = { mtimeMs: stats.mtimeMs, size: stats.size };
    } catch {
        statKey = undefined;
    }

    if (statKey) {
        const cached = resolveCache.get(absolute);

        if (cached?.mtimeMs === statKey.mtimeMs && cached.size === statKey.size) {
            return cached.config;
        }
    }

    const userConfig = readJsonSync(absolute) as GitleaksConfig;

    if (statKey) {
        resolveCache.set(absolute, { config: userConfig, mtimeMs: statKey.mtimeMs, size: statKey.size });
    }

    return userConfig;
};

const resolveConfig = (options: ConfigLoadOptions = {}): GitleaksConfig => {
    if (options.config) {
        return options.extendBundled === false ? options.config : mergeConfigs(getBundledConfig(), options.config);
    }

    if (!options.configPath) {
        return getBundledConfig();
    }

    const userConfig = readUserConfig(resolve(options.configPath));

    if (options.extendBundled === false) {
        return userConfig;
    }

    // Only fall back to the bundled config when the user config contributes
    // nothing to merge. A path config carrying *only* allowlists (the common
    // gitleaks "extend default + suppress" pattern) must still layer onto the
    // bundled ruleset — otherwise its suppressions are silently dropped, exactly
    // like the inline-config branch above already merges unconditionally.
    const hasRules = Array.isArray(userConfig.rules) && userConfig.rules.length > 0;
    const hasAllowlist = userConfig.allowlist !== undefined || (Array.isArray(userConfig.allowlists) && userConfig.allowlists.length > 0);

    if (!hasRules && !hasAllowlist) {
        return getBundledConfig();
    }

    return mergeConfigs(getBundledConfig(), userConfig);
};

const collectKnownTags = (rules: ReadonlyArray<GitleaksRule>): Set<string> => {
    const knownTags = new Set<string>();

    for (const rule of rules) {
        if (Array.isArray(rule.tags)) {
            for (const tag of rule.tags) {
                if (typeof tag === "string") {
                    knownTags.add(tag);
                }
            }
        }
    }

    return knownTags;
};

const expandOneTag = (tag: string, entry: string, fieldName: string, rules: ReadonlyArray<GitleaksRule>): string[] => {
    const hits: string[] = [];

    for (const rule of rules) {
        if (typeof rule.id === "string" && Array.isArray(rule.tags) && rule.tags.includes(tag)) {
            hits.push(rule.id);
        }
    }

    if (hits.length > 0) {
        return hits;
    }

    const knownTags = collectKnownTags(rules);
    const hint = knownTags.size === 0 ? "" : ` Known tags: ${[...knownTags].toSorted((a, b) => a.localeCompare(b)).join(", ")}.`;

    throw new Error(`${fieldName}: tag selector "${entry}" matched zero rules.${hint}`);
};

/**
 * Expand `tag:` entries against the loaded ruleset into concrete rule ids.
 * Throws when a `tag:` entry matches zero rules — catches typos at the boundary.
 * Literal ids pass through even if they reference a rule that isn't loaded (the
 * downstream filter handles that case harmlessly).
 */
const expandTagFilters = (filters: ReadonlyArray<string> | undefined, rules: ReadonlyArray<GitleaksRule>, fieldName: string): string[] | undefined => {
    if (!filters || filters.length === 0) {
        return undefined;
    }

    const expanded: string[] = [];

    for (const entry of filters) {
        if (!entry.startsWith("tag:")) {
            expanded.push(entry);

            continue;
        }

        expanded.push(...expandOneTag(entry.slice(4), entry, fieldName, rules));
    }

    return expanded;
};

/**
 * Drop rules marked `defaultEnabled: false` unless their id is in `enabledIds`.
 * `enabledIds` is the union of whatever expanded from `rules.enable` and
 * `rules.include` — both imply enablement (you can't filter to a rule that's
 * off). `exclude` entries never enable anything.
 */
const gateOptInRules = (config: GitleaksConfig, enabledIds: Set<string>): GitleaksConfig => {
    if (!Array.isArray(config.rules)) {
        return config;
    }

    let hasOptIn = false;

    for (const rule of config.rules) {
        if (rule?.defaultEnabled === false) {
            hasOptIn = true;

            break;
        }
    }

    if (!hasOptIn) {
        return config;
    }

    return {
        ...config,
        rules: config.rules.filter((rule) => rule?.defaultEnabled !== false || (typeof rule.id === "string" && enabledIds.has(rule.id))),
    };
};

/** Test-only: drop the bundled + per-path config caches so fixture mutations don't leak across test files. */
const resetConfigCacheForTests = (): void => {
    bundledCache = undefined;
    resolveCache.clear();
};

export type { ConfigLoadOptions, GitleaksConfig, GitleaksRule };
export { bundledConfigPath, expandTagFilters, gateOptInRules, getBundledConfig, resetConfigCacheForTests, resolveConfig };
