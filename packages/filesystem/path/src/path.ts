/**
 * A modified version from `https://github.com/unjs/pathe/blob/main/src/path.ts`
 *
 * MIT License
 * Copyright (c) Pooya Parsa &lt;pooya@pi0.io> - Daniel Roe &lt;daniel@roe.dev>
 */

/* eslint-disable no-secrets/no-secrets */

/**
 * Based on Node.js implementation:
 * - Forked from: https://github.com/nodejs/node/blob/4b030d057375e58d2e99182f6ef7aa70f6ebcf99/lib/path.js
 * - Latest: https://github.com/nodejs/node/blob/main/lib/path.js
 * Check LICENSE file
 */

/* eslint-enable no-secrets/no-secrets */

import type path from "node:path";

// eslint-disable-next-line import/no-extraneous-dependencies
import zeptomatch from "zeptomatch";

import normalizeWindowsPath from "./normalize-windows-path";

const UNC_REGEX = /^[/\\]{2}/;
const IS_ABSOLUTE_RE = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Z]:[/\\]/i;
const DRIVE_LETTER_RE = /^[A-Z]:$/i;
const ROOT_FOLDER_RE = /^\/([A-Z]:)?$/i;
const EXTNAME_RE = /.(\.[^./]+)$/;
const PATH_ROOT_RE = /^[/\\]|^[a-z]:[/\\]/i;

const cwd = () => {
    if (typeof process !== "undefined" && typeof process.cwd === "function") {
        return process.cwd().replaceAll("\\", "/");
    }

    return "/";
};

/**
 * File system path separator constant, forced to POSIX style for consistency.
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
export const sep = "/";

/**
 * Path delimiter constant, used to separate paths in environment variables.
 */

export const delimiter: string = /^win/i.test(globalThis.process?.platform) ? ";" : ":";

/**
 * Resolves a string path, resolving '.' and '.' segments and allowing paths above the root.
 * @param path The path to normalise.
 * @param allowAboveRoot Whether to allow the resulting path to be above the root directory.
 * @returns the normalised path string.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const normalizeString = (path: string, allowAboveRoot: boolean): string => {
    let result = "";
    let lastSegmentLength = 0;
    let lastSlash = -1;
    let dots = 0;
    let char: string | null | undefined;

    // eslint-disable-next-line no-plusplus
    for (let index = 0; index <= path.length; ++index) {
        if (index < path.length) {
            char = path[index];
        } else if (char === "/") {
            break;
        } else {
            char = "/";
        }

        if (char === "/") {
            if (lastSlash === index - 1 || dots === 1) {
                // NOOP
            } else if (dots === 2) {
                if (result.length < 2 || lastSegmentLength !== 2 || !result.endsWith(".") || result.at(-2) !== ".") {
                    if (result.length > 2) {
                        const lastSlashIndex = result.lastIndexOf("/");

                        if (lastSlashIndex === -1) {
                            result = "";
                            lastSegmentLength = 0;
                        } else {
                            result = result.slice(0, lastSlashIndex);
                            lastSegmentLength = result.length - 1 - result.lastIndexOf("/");
                        }

                        lastSlash = index;
                        dots = 0;

                        continue;
                    } else if (result.length > 0) {
                        result = "";
                        lastSegmentLength = 0;
                        lastSlash = index;
                        dots = 0;

                        continue;
                    }
                }

                if (allowAboveRoot) {
                    result += result.length > 0 ? "/.." : "..";
                    lastSegmentLength = 2;
                }
            } else {
                if (result.length > 0) {
                    result += `/${path.slice(lastSlash + 1, index)}`;
                } else {
                    result = path.slice(lastSlash + 1, index);
                }

                lastSegmentLength = index - lastSlash - 1;
            }

            lastSlash = index;
            dots = 0;
        } else if (char === "." && dots !== -1) {
            // eslint-disable-next-line no-plusplus
            ++dots;
        } else {
            dots = -1;
        }
    }

    return result;
};

/**
 * Determines if a path is an absolute path.
 * @param path The path to check.
 * @returns `true` if the path is absolute, otherwise `false`.
 */
export const isAbsolute: typeof path.isAbsolute = (path: string): boolean => IS_ABSOLUTE_RE.test(path);

/**
 * Normalises the given path, resolving '.' and '.' segments.
 * @param path The path to normalise.
 * @returns the normalised path.
 */
export const normalize: typeof path.normalize = function (path: string) {
    if (path.length === 0) {
        return ".";
    }

    // Normalize windows argument
    // eslint-disable-next-line no-param-reassign
    path = normalizeWindowsPath(path);

    const isUNCPath = UNC_REGEX.exec(path);
    const isPathAbsolute = isAbsolute(path);
    const trailingSeparator = path.at(-1) === "/";

    // Normalize the path
    // eslint-disable-next-line no-param-reassign
    path = normalizeString(path, !isPathAbsolute);

    if (path.length === 0) {
        if (isPathAbsolute) {
            return "/";
        }

        return trailingSeparator ? "./" : ".";
    }

    if (trailingSeparator) {
        // eslint-disable-next-line no-param-reassign
        path += "/";
    }

    if (DRIVE_LETTER_RE.test(path)) {
        // eslint-disable-next-line no-param-reassign
        path += "/";
    }

    if (isUNCPath) {
        if (!isPathAbsolute) {
            return `//./${path}`;
        }

        return `//${path}`;
    }

    return isPathAbsolute && !isAbsolute(path) ? `/${path}` : path;
};

/**
 * Joins all given path segments using the POSIX separator, then normalises the resulting path.
 * @param arguments_ The path segments to join.
 * @returns the joined and normalised path.
 */

export const join: typeof path.join = (...segments): string => {
    let path = "";

    for (const seg of segments) {
        if (!seg) {
            continue;
        }

        if (path.length > 0) {
            const pathTrailing = path[path.length - 1] === "/";

            const segLeading = seg[0] === "/";
            const both = pathTrailing && segLeading;

            if (both) {
                path += seg.slice(1);
            } else {
                path += pathTrailing || segLeading ? seg : `/${seg}`;
            }
        } else {
            path += seg;
        }
    }

    return normalize(path);
};

/**
 * Resolves a sequence of paths to an absolute path.
 * The resulting path is normalised and trailing slashes are removed unless the path is a root directory.
 * @param arguments_ The sequence of paths to resolve.
 * @returns the resolved absolute path.
 */
export const resolve: typeof path.resolve = function (...arguments_) {
    // Normalize windows arguments
    // eslint-disable-next-line no-param-reassign
    arguments_ = arguments_.map((argument) => normalizeWindowsPath(argument));

    let resolvedPath = "";
    let resolvedAbsolute = false;

    // eslint-disable-next-line no-plusplus
    for (let index = arguments_.length - 1; index >= -1 && !resolvedAbsolute; index--) {
        const path = index >= 0 ? arguments_[index] : cwd();

        // Skip empty entries
        if (!path || path.length === 0) {
            continue;
        }

        resolvedPath = `${path}/${resolvedPath}`;
        resolvedAbsolute = isAbsolute(path);
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute);

    if (resolvedAbsolute && !isAbsolute(resolvedPath)) {
        return `/${resolvedPath}`;
    }

    return resolvedPath.length > 0 ? resolvedPath : ".";
};

/**
 * Converts a non-namespaced path into a namespaced path. On POSIX systems this is a noop.
 * @param p The path to convert.
 */
export const toNamespacedPath: typeof path.toNamespacedPath = function (p) {
    return normalizeWindowsPath(p);
};

/**
 * Returns the extension of the path, from the last occurrence of the '.' (period) character to the end of the string in the last part of the path.
 * If there is no '.' in the last part of the path, or if there are no '.' characters other than the first character of the basename of the path, an empty string is returned.
 * @param p The path to evaluate.
 * @returns the extension of the path.
 */
export const extname: typeof path.extname = function (p) {
    const match = EXTNAME_RE.exec(normalizeWindowsPath(p));

    return match?.[1] ?? "";
};

/**
 * Specifies the relative path from one path to another.
 * @param from The source path.
 * @param to The destination path.
 * @returns the relative path from the source to the target.
 */
export const relative: typeof path.relative = function (from: string, to: string): string {
    const splitFrom = resolve(from).replace(ROOT_FOLDER_RE, "$1").split("/");
    const splitTo = resolve(to).replace(ROOT_FOLDER_RE, "$1").split("/");

    // Different windows drive letters
    if ((splitTo[0] as string)[1] === ":" && (splitFrom[0] as string)[1] === ":" && splitFrom[0] !== splitTo[0]) {
        return splitTo.join("/");
    }

    const fromCopy = [...splitFrom];

    for (const segment of fromCopy) {
        if (splitTo[0] !== segment) {
            break;
        }

        splitFrom.shift();
        splitTo.shift();
    }

    return [...splitFrom.map(() => ".."), ...splitTo].join("/");
};

/**
 * Returns the directory name of a path, similar to the Unix dirname command.
 * Trailing directory separators are ignored.
 * @param path The path to evaluate.
 * @returns the directory portion of the path.
 */
export const dirname: typeof path.dirname = (path: string) => {
    const segments = normalizeWindowsPath(path).replace(/\/$/, "").split("/").slice(0, -1);

    if (segments.length === 1 && DRIVE_LETTER_RE.test(segments[0] as string)) {
        segments[0] += "/";
    }

    return segments.join("/") || (isAbsolute(path) ? "/" : ".");
};

/**
 * Returns a path string from an object.
 */
export const format: typeof path.format = function (pathObject: path.FormatInputPathObject) {
    const segments = [pathObject.root, pathObject.dir, pathObject.base ?? (pathObject.name as string) + (pathObject.ext as string)].filter(Boolean);

    return normalizeWindowsPath(pathObject.root ? resolve(...(segments as string[])) : segments.join("/"));
};

/**
 * Returns the last part of a path, similar to the Unix basename command.
 * Trailing directory separators are considered part of the path.
 * @param path The path to evaluate.
 * @param extension An optional file extension to remove from the result.
 * @returns the last part of the path.
 */
export const basename: typeof path.basename = (path: string, extension?: string): string => {
    const lastSegment = normalizeWindowsPath(path).split("/").pop();

    if (extension && (lastSegment as string).endsWith(extension)) {
        return (lastSegment as string).slice(0, -extension.length);
    }

    return lastSegment as string;
};

/**
 * Returns an object from a path string - the opposite of format().
 * @param p The path string to parse.
 * @returns an object representing the path.
 */
export const parse: typeof path.parse = function (p: string): path.ParsedPath {
    // The root of the path such as '/' or 'c:\'
    const root = PATH_ROOT_RE.exec(p)?.[0]?.replaceAll("\\", "/") ?? "";
    const base = basename(p);
    const extension = extname(base);

    return {
        base,
        dir: dirname(p),
        ext: extension,
        name: base.slice(0, base.length - extension.length),
        root,
    };
};

/**
 * The `path.matchesGlob()` method determines if `path` matches the `pattern`.
 * @param path The path to glob-match against.
 * @param pattern The glob to check the path against.
 * @returns `true` if the path matches the pattern, otherwise `false`.
 */
export const matchesGlob: typeof path.matchesGlob = (path: string, pattern: string[] | string): boolean =>
    // https://github.com/nodejs/node/blob/main/lib/internal/fs/glob.js#L660
    zeptomatch(pattern, normalize(path));
