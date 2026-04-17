import { existsSync } from "node:fs";
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

    return {
        allowlist: overlay.allowlist ?? base.allowlist,
        allowlists: overlay.allowlists ?? base.allowlists,
        description: overlay.description ?? base.description,
        extend: overlay.extend ?? base.extend,
        rules: [...baseRules, ...(overlay.rules ?? [])],
    };
};

const resolveCache = new Map<string, GitleaksConfig>();

const resolveConfig = (options: ConfigLoadOptions = {}): GitleaksConfig => {
    if (options.config) {
        return options.extendBundled === false ? options.config : mergeConfigs(getBundledConfig(), options.config);
    }

    if (!options.configPath) {
        return getBundledConfig();
    }

    const absolute = resolve(options.configPath);
    let userConfig = resolveCache.get(absolute);

    if (userConfig === undefined) {
        userConfig = readJsonSync(absolute) as GitleaksConfig;
        resolveCache.set(absolute, userConfig);
    }

    if (options.extendBundled === false) {
        return userConfig;
    }

    if (!userConfig.rules || userConfig.rules.length === 0) {
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
