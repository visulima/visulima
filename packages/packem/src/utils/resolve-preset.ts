import type { BuildConfig, BuildPreset } from "../types";
import { tryRequire } from "./try-require";
import { autoPreset } from "../preset/auto";

export function resolvePreset(preset: string | BuildPreset, rootDir: string): BuildConfig {
    if (preset === "auto") {
        preset = autoPreset;
    } else if (typeof preset === "string") {
        preset = tryRequire(preset, rootDir) || {};
    }

    if (typeof preset === "function") {
        preset = preset();
    }

    return preset as BuildConfig;
}
