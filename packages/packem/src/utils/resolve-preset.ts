import { autoPreset } from "../preset/auto";
import type { BuildConfig, BuildPreset } from "../types";
import { tryRequire } from "./try-require";

const resolvePreset = (preset: BuildPreset | string, rootDirectory: string): BuildConfig => {
    if (preset === "auto") {
        // eslint-disable-next-line no-param-reassign
        preset = autoPreset;
    } else if (typeof preset === "string") {
        // eslint-disable-next-line no-param-reassign
        preset = tryRequire(preset, rootDirectory) || {};
    }

    if (typeof preset === "function") {
        // eslint-disable-next-line no-param-reassign
        preset = preset();
    }

    return preset as BuildConfig;
}

export default resolvePreset;
