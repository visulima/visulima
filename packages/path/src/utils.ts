/**
 * A modified version from `https://github.com/unjs/pathe/blob/main/src/utils.ts`
 *
 * MIT License
 * Copyright (c) Pooya Parsa <pooya@pi0.io> - Daniel Roe <daniel@roe.dev>
 */
import { fileURLToPath } from "node:url";

// eslint-disable-next-line import/no-extraneous-dependencies
import binaryExtensions from "binary-extensions";

import normalizeWindowsPath from "./normalize-windows-path";
import { extname, join } from "./path";

const extensions = new Set(binaryExtensions);

const pathSeparators = new Set(["/", "\\", undefined]);

const normalizedAliasSymbol = Symbol.for("pathe:normalizedAlias");

// eslint-disable-next-line security/detect-unsafe-regex,regexp/no-unused-capturing-group
const FILENAME_RE = /(^|[/\\])([^/\\]+?)(?=(?:\.[^.]+)?$)/;

const compareAliases = (a: string, b: string) => b.split("/").length - a.split("/").length;

// Returns true if path ends with a slash or **is empty**
const hasTrailingSlash = (path = "/"): boolean => {
    const lastChar = path.at(-1);

    return lastChar === "/" || lastChar === "\\";
};

/**
 * Normalises alias mappings, ensuring that more specific aliases are resolved before less specific ones.
 * This function also ensures that aliases do not resolve to themselves cyclically.
 *
 * @param _aliases - A set of alias mappings where each key is an alias and its value is the actual path it points to.
 * @returns a set of normalised alias mappings.
 */
export const normalizeAliases = (_aliases: Record<string, string>): Record<string, string> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,security/detect-object-injection
    if ((_aliases as any)[normalizedAliasSymbol]) {
        return _aliases;
    }

    // Sort aliases from specific to general (ie. fs/promises before fs)
    const aliases = Object.fromEntries(Object.entries(_aliases).sort(([a], [b]) => compareAliases(a, b)));

    // Resolve alias values in relation to each other
    // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
    for (const key in aliases) {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const alias in aliases) {
            // don't resolve a more specific alias with regard to a less specific one
            if (alias === key || key.startsWith(alias)) {
                // eslint-disable-next-line no-continue
                continue;
            }

            // eslint-disable-next-line security/detect-object-injection
            if ((aliases[key] as string).startsWith(alias) && pathSeparators.has((aliases[key] as string)[alias.length])) {
                // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/restrict-plus-operands
                aliases[key] = aliases[alias] + (aliases[key] as string).slice(alias.length);
            }
        }
    }

    Object.defineProperty(aliases, normalizedAliasSymbol, {
        enumerable: false,
        value: true,
    });

    return aliases;
};

/**
 * Resolves a path string to its alias if applicable, otherwise returns the original path.
 * This function normalises the path, resolves the alias and then joins it to the alias target if necessary.
 *
 * @param path - The path string to resolve.
 * @param aliases - A set of alias mappings to use for resolution.
 * @returns the resolved path as a string.
 */
export const resolveAlias = (path: string, aliases: Record<string, string>): string => {
    // eslint-disable-next-line no-param-reassign
    path = normalizeWindowsPath(path);
    // eslint-disable-next-line no-param-reassign
    aliases = normalizeAliases(aliases);

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const [alias, to] of Object.entries(aliases)) {
        if (!path.startsWith(alias)) {
            // eslint-disable-next-line no-continue
            continue;
        }

        // Strip trailing slash from alias for check
        const stripedAlias = hasTrailingSlash(alias) ? alias.slice(0, -1) : alias;

        if (hasTrailingSlash(path[stripedAlias.length])) {
            return join(to, path.slice(alias.length));
        }
    }

    return path;
};

/**
 * Extracts the filename from a given path, excluding any directory paths and the file extension.
 *
 * @param {string} path - The full path of the file from which to extract the filename.
 * @returns {string} the filename without the extension, or `undefined` if the filename cannot be extracted.
 */
export const filename = (path: string): string => <string>FILENAME_RE.exec(path)?.[2];

/**
 * Reverting the resolveAlias method.
 *
 * @param {string} path
 * @param {Record<string, string>} aliases
 * @returns {string}
 */
export const reverseResolveAlias = (path: string, aliases: Record<string, string>): string => {
    // eslint-disable-next-line no-param-reassign
    path = normalizeWindowsPath(path);
    // eslint-disable-next-line no-param-reassign
    aliases = normalizeAliases(aliases);

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const [to, alias] of Object.entries(aliases).reverse()) {
        if (!path.startsWith(alias)) {
            // eslint-disable-next-line no-continue
            continue;
        }

        // Strip trailing slash from alias for check
        const stripedAlias = hasTrailingSlash(alias) ? alias.slice(0, -1) : alias;

        if (hasTrailingSlash(path[stripedAlias.length])) {
            return join(to, path.slice(alias.length));
        }
    }

    return path;
};

/**
 * Determines whether a given path is relative.
 *
 * @param {string} path - The path to check.
 * @returns {boolean} `true` if the path is relative, otherwise `false`.
 */
export const isRelative = (path: string): boolean => /^(?:\.?\.[/\\]|\.\.\B)/.test(path) || path === "..";

/**
 * Determines whether a given path is a binary file.
 * This function checks the file extension against a list of known binary file extensions.
 *
 * @param {string} path
 * @returns {boolean} `true` if the path is a binary file, otherwise `false`.
 */
export const isBinaryPath = (path: string): boolean => extensions.has(extname(path).slice(1).toLowerCase());

export const toPath = (urlOrPath: URL | string): string => normalizeWindowsPath(urlOrPath instanceof URL ? fileURLToPath(urlOrPath) : urlOrPath);
