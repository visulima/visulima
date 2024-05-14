import type { BuildConfig, BuildPreset } from "./types";

export const defineConfig = (config: BuildConfig | BuildConfig[]): BuildConfig[] => (Array.isArray(config) ? config : [config]).filter(Boolean);

export const definePreset = (preset: BuildPreset): BuildPreset => preset;
