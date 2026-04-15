import { fileURLToPath } from "node:url";

// eslint-disable-next-line import/no-extraneous-dependencies
import { readJsonSync } from "@visulima/fs";
// eslint-disable-next-line import/no-extraneous-dependencies
import { dirname, resolve } from "@visulima/path";

interface GitleaksConfig {
    allowlist?: unknown;
    allowlists?: unknown[];
    description?: string;
    extend?: { disabledRules?: string[]; path?: string; useDefault?: boolean };
    rules?: unknown[];
    title?: string;
}

/** Named rulesets bundled alongside the default gitleaks config. */
type PresetName = "weak-passwords";

const KNOWN_PRESETS: ReadonlySet<PresetName> = new Set(["weak-passwords"]);

interface ConfigLoadOptions {
    config?: GitleaksConfig;
    configPath?: string;
    extendBundled?: boolean;
    presets?: PresetName[];
}

const here: string = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));
const bundledConfigPath: string = resolve(here, "..", "assets", "gitleaks.json");
const presetsDir = resolve(here, "..", "assets", "presets");

let cachedBundledConfig: GitleaksConfig | undefined;
const presetCache = new Map<PresetName, GitleaksConfig>();

const getBundledConfig = (): GitleaksConfig => {
    if (cachedBundledConfig !== undefined) {
        return cachedBundledConfig;
    }

    cachedBundledConfig = readJsonSync(bundledConfigPath) as GitleaksConfig;

    return cachedBundledConfig;
};

const loadPreset = (name: PresetName): GitleaksConfig => {
    const cached = presetCache.get(name);

    if (cached !== undefined) {
        return cached;
    }

    const config = readJsonSync(resolve(presetsDir, `${name}.json`)) as GitleaksConfig;

    presetCache.set(name, config);

    return config;
};

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

const resolveConfig = (options: ConfigLoadOptions = {}): GitleaksConfig => {
    const invalidPresets = (options.presets ?? []).filter((p) => !KNOWN_PRESETS.has(p));

    if (invalidPresets.length > 0) {
        throw new Error(`Unknown preset(s): ${invalidPresets.join(", ")}. Known: ${[...KNOWN_PRESETS].join(", ")}`);
    }

    const applyPresets = (base: GitleaksConfig): GitleaksConfig => {
        let out = base;

        for (const name of options.presets ?? []) {
            out = mergeConfigs(out, loadPreset(name));
        }

        return out;
    };

    if (options.config) {
        const baseForUser = options.extendBundled === false ? options.config : mergeConfigs(getBundledConfig(), options.config);

        return applyPresets(baseForUser);
    }

    if (!options.configPath) {
        return applyPresets(getBundledConfig());
    }

    const absolute = resolve(options.configPath);
    let userConfig = resolveCache.get(absolute);

    if (userConfig === undefined) {
        userConfig = readJsonSync(absolute) as GitleaksConfig;
        resolveCache.set(absolute, userConfig);
    }

    if (options.extendBundled === false) {
        return applyPresets(userConfig);
    }

    if (!userConfig.rules || userConfig.rules.length === 0) {
        return applyPresets(getBundledConfig());
    }

    return applyPresets(mergeConfigs(getBundledConfig(), userConfig));
};

export type { ConfigLoadOptions, GitleaksConfig, PresetName };
export { bundledConfigPath, getBundledConfig, resolveConfig };
