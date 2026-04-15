import { fileURLToPath } from "node:url";

// eslint-disable-next-line import/no-extraneous-dependencies
import { readJsonSync } from "@visulima/fs";
// eslint-disable-next-line import/no-extraneous-dependencies
import { dirname, resolve } from "@visulima/path";

/**
 * Minimal mirror of the gitleaks config shape. The Rust side is the structural
 * source of truth; the JS layer only validates presence of `rules` and performs
 * a lightweight merge with the bundled ruleset.
 */
interface GitleaksConfig {
    allowlist?: unknown;
    allowlists?: unknown[];
    description?: string;
    extend?: { disabledRules?: string[]; path?: string; useDefault?: boolean };
    rules?: unknown[];
    title?: string;
}

interface ConfigLoadOptions {
    /** Pre-parsed config object. Fastest path — skips all file IO. */
    config?: GitleaksConfig;
    /** Path to a JSON config file. Must be valid JSON (no auto-format detection). */
    configPath?: string;
    /** Set `false` to skip merging the bundled gitleaks ruleset (default: merge). */
    includeBundled?: boolean;
}

const here: string = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));
const bundledConfigPath: string = resolve(here, "..", "assets", "gitleaks.json");

let cachedBundledConfig: GitleaksConfig | undefined;

/**
 * Read and cache the bundled gitleaks ruleset. The TOML source is converted
 * to JSON at build time by `scripts/build-rules.mjs`, so the runtime never
 * parses TOML — zero `confbox`/`toml` cost.
 */
const getBundledConfig = (): GitleaksConfig => {
    if (cachedBundledConfig !== undefined) {
        return cachedBundledConfig;
    }

    cachedBundledConfig = readJsonSync(bundledConfigPath) as GitleaksConfig;

    return cachedBundledConfig;
};

/**
 * Deep merge where user rules append and override bundled rules with the same `id`.
 */
const mergeConfigs = (base: GitleaksConfig, overlay: GitleaksConfig): GitleaksConfig => {
    const overlayRuleIds = new Set(
        (overlay.rules ?? [])
            .filter((r): r is { id: string } => typeof r === "object" && r !== null && typeof (r as { id?: unknown }).id === "string")
            .map((r) => r.id),
    );

    const baseRules = (base.rules ?? []).filter((r) => {
        if (typeof r !== "object" || r === null) {
            return true;
        }

        const { id } = r as { id?: unknown };

        return typeof id !== "string" || !overlayRuleIds.has(id);
    });

    return {
        allowlist: overlay.allowlist ?? base.allowlist,
        allowlists: overlay.allowlists ?? base.allowlists,
        description: overlay.description ?? base.description,
        extend: overlay.extend ?? base.extend,
        rules: [...baseRules, ...(overlay.rules ?? [])],
        title: overlay.title ?? base.title,
    };
};

const resolveCache = new Map<string, GitleaksConfig>();

/**
 * Resolve the effective config. Strategy:
 *
 * 1. `options.config` wins (pre-parsed, no file IO).
 * 2. `options.configPath` → parse as JSON once, cache by absolute path.
 * 3. Neither set → bundled gitleaks ruleset.
 *
 * When a user config is present and `includeBundled` is not `false`, rules are
 * merged onto the bundled set (user rule ids override).
 */
const resolveConfig = (options: ConfigLoadOptions = {}): GitleaksConfig => {
    if (options.config) {
        return options.includeBundled === false ? options.config : mergeConfigs(getBundledConfig(), options.config);
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

    if (options.includeBundled === false) {
        return userConfig;
    }

    if (!userConfig.rules || userConfig.rules.length === 0) {
        return getBundledConfig();
    }

    return mergeConfigs(getBundledConfig(), userConfig);
};

export type { ConfigLoadOptions, GitleaksConfig };
export { bundledConfigPath, getBundledConfig, resolveConfig };
