import mapKeysToPath from "./map-keys-to-path";
import type { ExpressRegex, Key } from "./types";

/**
 * Parses an express layer's regex and converts it to the original format seen in code.
 * @param layerRegexPath The layer's regex pattern
 * @param keys The keys that represent the layer's path parameters
 * @returns The path string for that layer
 * Code inspired and modify from:
 * https://github.com/expressjs/express/issues/3308#issuecomment-300957572
 */
const pathRegexParser = (layerRegexPath: ExpressRegex | string, keys: Key[]): string => {
    if (typeof layerRegexPath === "string") {
        return layerRegexPath;
    }

    if (layerRegexPath.fast_slash) {
        return "";
    }

    if (layerRegexPath.fast_star) {
        return "*";
    }

    let mappedPath = "";

    if (keys.length > 0) {
        mappedPath = mapKeysToPath(layerRegexPath, keys);
    }

    const match = /^\/\^((?:\\[$()*+./?[\\\]^{|}]|[^$()*+./?[\\\]^{|}])*)\$\//u.exec(
        layerRegexPath.toString().replace(String.raw`\/?`, "").replace(String.raw`(?=\/|$)`, "$"),
    ) as string[];

    if (Array.isArray(match) && match.length > 1) {
        return (match[1] as string).replaceAll(/\\(.)/gu, "$1").slice(1);
    }

    if (mappedPath) {
        return mappedPath.slice(1);
    }

    return layerRegexPath.toString();
};

export default pathRegexParser;
