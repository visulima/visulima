import type { BuildConfig } from "./types";

export const defineConfig = (config: BuildConfig | BuildConfig[]): BuildConfig[] => {
    return (Array.isArray(config) ? config : [config]).filter(Boolean);
}
