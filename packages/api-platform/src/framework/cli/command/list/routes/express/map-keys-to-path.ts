import type { ExpressRegex, Key } from "./types";

/**
 * Map's the keys/path variables to the regex inside a given path
 * @param layerRegexPath The regex for a router with path parameters
 * @param keys The keys that represent the path parameters
 * @returns The regex for a path variable converted to original string on the express route
 */
const mapKeysToPath = (layerRegexPath: ExpressRegex, keys: Key[]): string => {
    if (keys.length === 0) {
        throw new Error("must include at least one key to map");
    }

    let convertedSubPath = layerRegexPath.toString();

    keys.forEach((key) => {
        convertedSubPath = key.optional
            ? convertedSubPath.replace("(?:\\/([^\\/]+?))?\\", `/:${key.name}?`)
            : convertedSubPath.replace(String.raw`(?:([^\/]+?))`, `:${key.name}`);
    });

    return convertedSubPath
        .replace(String.raw`/?(?=\/|$)/i`, "")
        .replace("/^", "")
        .replaceAll("\\", "")
        .replaceAll(/\/{2,}/gu, "/");
};

export default mapKeysToPath;
