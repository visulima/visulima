// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// Documentation and interface for walk were adapted from Go
// https://golang.org/pkg/path/filepath/#Walk
// Copyright 2009 The Go Authors. All rights reserved. BSD license.

import type { Stats } from "node:fs";
import { readdirSync, realpathSync, statSync } from "node:fs";

import { basename, join, normalize, resolve } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import WalkError from "../error/walk-error";
import type { WalkEntry, WalkOptions } from "../types";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
import globToRegExp from "./utils/glob-to-regex";
import walkInclude from "./utils/walk-include";

/** Create {@linkcode WalkEntry} for the `path` synchronously. */
// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const _createWalkEntry = (path: string): WalkEntry => {
    const normalizePath: string = normalize(path as string);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const info: Stats = statSync(normalizePath);

    return {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        isDirectory: info.isDirectory,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        isFile: info.isFile,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        isSymbolicLink: info.isSymbolicLink,
        name: basename(normalizePath),
        path: normalizePath,
    };
};

/**
 * Synchronously walks the file tree rooted at `directory`, yielding each file or directory that matches the criteria specified in `options`.
 * This is the synchronous version of the {@link walk} function.
 *
 * @param directory The root directory to start walking from.
 * @param options Optional configuration to control the walking process. See {@link WalkOptions}.
 * @returns An iterable iterator yielding {@link WalkEntry} objects for each matching file or directory.
 * @example
 * ```javascript
 * import { walkSync } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * // Walk through /tmp/my-project, looking for .ts files, max depth 2
 * for (const entry of walkSync(join("/tmp", "my-project"), { extensions: ["ts"], maxDepth: 2 })) {
 *   console.log(`Found: ${entry.path} (Type: ${entry.isFile() ? 'file' : 'directory'})`);
 * }
 *
 * // Walk, including only directories, and skip any node_modules folders
 * for (const entry of walkSync(join("/tmp", "another-project"), { includeFiles: false, skip: [/node_modules/] })) {
 *   if (entry.isDirectory()) {
 *      console.log(`Directory: ${entry.path}`);
 *   }
 * }
 * ```
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export default function* walkSync(
    directory: URL | string,
    {
        extensions,
        followSymlinks = false,
        includeDirs: includeDirectories = true,
        includeFiles = true,
        includeSymlinks = true,
        match,
        maxDepth = Number.POSITIVE_INFINITY,
        skip,
    }: WalkOptions = {},
): IterableIterator<WalkEntry> {
    assertValidFileOrDirectoryPath(directory);

    if (maxDepth < 0) {
        return;
    }

    const mappedMatch = match ? match.map((pattern): RegExp => (typeof pattern === "string" ? globToRegExp(pattern) : pattern)) : undefined;
    const mappedSkip = skip ? skip.map((pattern): RegExp => (typeof pattern === "string" ? globToRegExp(pattern) : pattern)) : undefined;

    // eslint-disable-next-line no-param-reassign
    directory = resolve(toPath(directory));

    if (includeDirectories && walkInclude(directory, extensions, mappedMatch, mappedSkip)) {
        yield _createWalkEntry(directory);
    }

    if (maxDepth < 1 || !walkInclude(directory, undefined, undefined, mappedSkip)) {
        return;
    }

    try {
        // eslint-disable-next-line no-restricted-syntax,no-loops/no-loops,security/detect-non-literal-fs-filename
        for (const entry of readdirSync(directory, {
            withFileTypes: true,
        })) {
            let path = join(directory, entry.name);

            if (entry.isSymbolicLink()) {
                if (followSymlinks) {
                    // eslint-disable-next-line security/detect-non-literal-fs-filename
                    path = realpathSync(path);
                } else if (includeSymlinks && walkInclude(path, extensions, mappedMatch, mappedSkip)) {
                    yield {
                        // eslint-disable-next-line @typescript-eslint/unbound-method
                        isDirectory: entry.isDirectory,
                        // eslint-disable-next-line @typescript-eslint/unbound-method
                        isFile: entry.isFile,
                        // eslint-disable-next-line @typescript-eslint/unbound-method
                        isSymbolicLink: entry.isSymbolicLink,
                        name: entry.name,
                        path: normalize(path),
                    };
                } else {
                    // eslint-disable-next-line no-continue
                    continue;
                }
            }

            if (entry.isSymbolicLink() || entry.isDirectory()) {
                yield* walkSync(path, {
                    extensions,
                    followSymlinks,
                    includeDirs: includeDirectories,
                    includeFiles,
                    includeSymlinks,
                    match: mappedMatch,
                    maxDepth: maxDepth - 1,
                    skip: mappedSkip,
                } as WalkOptions);
            } else if (entry.isFile() && includeFiles && walkInclude(path, extensions, mappedMatch, mappedSkip)) {
                yield {
                    // eslint-disable-next-line @typescript-eslint/unbound-method
                    isDirectory: entry.isDirectory,
                    // eslint-disable-next-line @typescript-eslint/unbound-method
                    isFile: entry.isFile,
                    // eslint-disable-next-line @typescript-eslint/unbound-method
                    isSymbolicLink: entry.isSymbolicLink,
                    name: entry.name,
                    path: normalize(path),
                };
            }
        }
    } catch (error) {
        if (error instanceof WalkError) {
            throw error;
        }

        throw new WalkError(error, directory);
    }
}
