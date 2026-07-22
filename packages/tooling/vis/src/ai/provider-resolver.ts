import type { AiProviderInfo, AiProviderName } from "@visulima/find-ai-runner";
import { detectAvailableProviders, detectProvider, PROVIDER_NAMES } from "@visulima/find-ai-runner";

/**
 * Minimal provider-selection config — the subset of the full `AiConfig` that
 * provider resolution actually needs. Kept here (rather than in `ai-analysis`)
 * so callers can resolve a provider without pulling in the analysis module's
 * heavy React/TUI rendering dependencies.
 */
interface ProviderResolveConfig {
    /** Override default provider priority. Higher = preferred. */
    priority?: Record<string, number>;
    /** Use a specific provider, skip auto-detection. */
    provider?: string;
}

/** Default provider priority (higher wins) when none is configured. */
export const DEFAULT_PRIORITY: Record<string, number> = {
    amp: 30,
    claude: 80,
    codex: 60,
    copilot: 50,
    crush: 35,
    cursor: 40,
    droid: 20,
    gemini: 100,
    kimi: 25,
    opencode: 35,
    qwen: 30,
};

/**
 * Resolve which installed AI CLI to use, honouring an explicit `provider`
 * override or falling back to the highest-priority available provider.
 * @param config Optional provider/priority overrides.
 * @returns The selected available provider, or `undefined` when none is usable.
 */
export const resolveProvider = (config?: ProviderResolveConfig): AiProviderInfo | undefined => {
    if (config?.provider) {
        if (!PROVIDER_NAMES.includes(config.provider as AiProviderName)) {
            return undefined;
        }

        const provider = detectProvider(config.provider as AiProviderName);

        return provider.available ? provider : undefined;
    }

    const available = detectAvailableProviders();

    if (available.length === 0) {
        return undefined;
    }

    const priority = { ...DEFAULT_PRIORITY, ...config?.priority };

    return available.toSorted((a, b) => (priority[b.name] ?? 0) - (priority[a.name] ?? 0))[0];
};

export type { ProviderResolveConfig };
