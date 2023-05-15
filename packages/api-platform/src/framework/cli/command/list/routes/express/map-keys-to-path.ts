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
    if (keys.length === 0) {
        throw new Error("must include atleast one key to map");
    }

    let convertedSubPath = layerRegexPath.toString();

    keys.forEach((key) => {
        convertedSubPath = key.optional
            ? convertedSubPath.replace("(?:\\/([^\\/]+?))?\\", `/:${key.name}?`)
            : convertedSubPath.replace("(?:([^\\/]+?))", `:${key.name}`);
    });

    return convertedSubPath
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace("/?(?=\\/|$)/i", "")
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace("/^", "")
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\\/gi, "")
        // eslint-disable-next-line unicorn/prefer-string-replace-all
        .replace(/\/{2,}/gi, "/");
};

export default mapKeysToPath;
