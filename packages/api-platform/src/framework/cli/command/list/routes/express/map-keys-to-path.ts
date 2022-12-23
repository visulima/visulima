import type { ExpressRegex, Key } from "./types.d";

/**
 * Map's the keys/path variables to the regex inside a given path
 *
 * @param layerRegexPath The regex for a router with path parameters
 * @param keys The keys that represent the path parameters
 *
 * @returns The regex for a path variable converted to original string on the express route
 */
const mapKeysToPath = (layerRegexPath: ExpressRegex, keys: Key[]): string => {
    if (!keys || keys.length === 0) {
        throw new Error("must include atleast one key to map");
    }

    let convertedSubPath = layerRegexPath.toString();

    keys.forEach((key) => {
        convertedSubPath = key.optional
            ? convertedSubPath.replace("(?:\\/([^\\/]+?))?\\", `/:${key.name}?`)
            : convertedSubPath.replace("(?:([^\\/]+?))", `:${key.name}`);
    });

    return convertedSubPath
        .replace("/?(?=\\/|$)/i", "")
        .replace("/^", "")
        .replace(/\\/gi, "")
        .replace(/\/{2,}/gi, "/");
};

export default mapKeysToPath;
