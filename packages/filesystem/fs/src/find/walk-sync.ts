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
import globToRegExp from "./utils/glob-to-regexp";
import createWalkEntry from "./utils/walk-entry";
import walkInclude from "./utils/walk-include";

/** Create WalkEntry for the `path` synchronously. */
// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const _createWalkEntry = (path: string): WalkEntry => {
    const normalizePath: string = normalize(path);

    const info: Stats = statSync(normalizePath);

    return createWalkEntry(info, basename(normalizePath), normalizePath);
};

/**
 * Synchronously walks the file tree rooted at `directory`, yielding each file or directory that matches the criteria specified in `options`.
 * This is the synchronous version of the async walk function.
 * @param directory The root directory to start walking from.
 * @param options Optional configuration to control the walking process. See {@link WalkOptions}.
 * @param options.extensions List of file extensions used to filter entries.
 * @param options.followSymlinks Indicates whether symlinks should be resolved or not.
 * @param options.includeDirs Indicates whether directory entries should be included or not.
 * @param options.includeFiles Indicates whether file entries should be included or not.
 * @param options.includeSymlinks Indicates whether symlink entries should be included or not.
 * @param options.match List of regular expression or glob patterns used to filter entries.
 * @param options.maxDepth Maximum depth to walk. Defaults to infinity.
 * @param options.skip List of regular expression or glob patterns used to skip entries.
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
export default function* walkSync(directory: URL | string, options: WalkOptions = {}): IterableIterator<WalkEntry> {
    const {
        extensions,
        followSymlinks = false,
        includeDirs: includeDirectories = true,
        includeFiles = true,
        includeSymlinks = true,
        match,
        maxDepth = Number.POSITIVE_INFINITY,
        skip,
    } = options;

    assertValidFileOrDirectoryPath(directory);

    if (maxDepth < 0) {
        return;
    }

    // Internal: tracks resolved real paths already visited to avoid infinite
    // recursion on self-referencing symlinks when `followSymlinks` is enabled.
    const visited = (options as { visited?: Set<string> }).visited ?? new Set<string>();

    const mappedMatch = match
        ? match.map(
              // eslint-disable-next-line no-confusing-arrow
              (pattern): RegExp => (typeof pattern === "string" ? globToRegExp(pattern) : pattern),
          )
        : undefined;
    const mappedSkip = skip
        ? skip.map(
              // eslint-disable-next-line no-confusing-arrow
              (pattern): RegExp => (typeof pattern === "string" ? globToRegExp(pattern) : pattern),
          )
        : undefined;

    const resolvedDirectory: string = resolve(toPath(directory));

    // eslint-disable-next-line no-param-reassign
    directory = resolvedDirectory;

    if (includeDirectories && walkInclude(directory, extensions, mappedMatch, mappedSkip)) {
        yield _createWalkEntry(directory);
    }

    if (maxDepth < 1 || !walkInclude(directory, undefined, undefined, mappedSkip)) {
        return;
    }

    try {
        const entries = readdirSync(directory, {
            withFileTypes: true,
        });

        for (const entry of entries) {
            let path = join(directory, entry.name);

            // Track whether the entry needs to be re-stat'd because it is a
            // symlink we are resolving. The original dirent reports the link
            // itself (isDirectory()/isFile() are both false), so after resolving
            // we must inspect the real target to decide how to handle it.
            let isDirectory = entry.isDirectory();
            let isFile = entry.isFile();

            if (entry.isSymbolicLink()) {
                if (followSymlinks) {
                    const realPath = realpathSync(path);

                    // Cycle detection: skip targets already visited so a symlink
                    // pointing at an ancestor directory cannot loop forever.
                    if (visited.has(realPath)) {
                        continue;
                    }

                    path = realPath;

                    const info = statSync(realPath);

                    isDirectory = info.isDirectory();
                    isFile = info.isFile();
                } else if (includeSymlinks && walkInclude(path, extensions, mappedMatch, mappedSkip)) {
                    yield createWalkEntry(entry, entry.name, normalize(path));

                    continue;
                } else {
                    continue;
                }
            }

            if (isDirectory) {
                if (followSymlinks) {
                    visited.add(path);
                }

                yield* walkSync(path, {
                    extensions,
                    followSymlinks,
                    includeDirs: includeDirectories,
                    includeFiles,
                    includeSymlinks,
                    match: mappedMatch,
                    maxDepth: maxDepth - 1,
                    skip: mappedSkip,
                    visited,
                } as WalkOptions);
            } else if (isFile && includeFiles && walkInclude(path, extensions, mappedMatch, mappedSkip)) {
                yield createWalkEntry(entry, entry.name, normalize(path));
            }
        }
    } catch (error) {
        if (error instanceof WalkError) {
            throw error;
        }

        throw new WalkError(error, directory);
    }
}
