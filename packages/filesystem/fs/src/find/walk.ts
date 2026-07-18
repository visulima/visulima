// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// Documentation and interface for walk were adapted from Go
// https://golang.org/pkg/path/filepath/#Walk
// Copyright 2009 The Go Authors. All rights reserved. BSD license.

import type { Dirent, Stats } from "node:fs";
import { readdir, realpath, stat } from "node:fs/promises";

import { basename, join, normalize, resolve } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import WalkError from "../error/walk-error";
import type { WalkEntry, WalkOptions } from "../types";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
import globToRegExp from "./utils/glob-to-regexp";
import createWalkEntry from "./utils/walk-entry";
import walkInclude from "./utils/walk-include";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const _createWalkEntry = async (path: string): Promise<WalkEntry> => {
    const normalizePath: string = normalize(path);

    const name = basename(normalizePath);

    const info: Stats = await stat(normalizePath);

    return createWalkEntry(info, name, normalizePath);
};

/**
 * Asynchronously walks the file tree rooted at `directory`, yielding each file or directory that matches the criteria specified in `options`.
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
 * @returns An async iterable iterator yielding {@link WalkEntry} objects for each matching file or directory.
 * @example
 * ```javascript
 * import { walk } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const printEntries = async () => {
 *   // Walk through /tmp/my-project, looking for .ts files, max depth 2
 *   for await (const entry of walk(join("/tmp", "my-project"), { extensions: ["ts"], maxDepth: 2 })) {
 *     console.log(`Found: ${entry.path} (Type: ${entry.isFile() ? 'file' : 'directory'})`);
 *   }
 *
 *   // Walk, including only directories, and skip any node_modules folders
 *   for await (const entry of walk(join("/tmp", "another-project"), { includeFiles: false, skip: [/node_modules/] })) {
 *     if (entry.isDirectory()) {
 *        console.log(`Directory: ${entry.path}`);
 *     }
 *   }
 * };
 *
 * printEntries();
 * ```
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export default async function* walk(directory: URL | string, options: WalkOptions = {}): AsyncIterableIterator<WalkEntry> {
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
            (pattern): RegExp => typeof pattern === "string" ? globToRegExp(pattern) : pattern,
        )
        : undefined;
    const mappedSkip = skip
        ? skip.map(
            // eslint-disable-next-line no-confusing-arrow
            (pattern): RegExp => typeof pattern === "string" ? globToRegExp(pattern) : pattern,
        )
        : undefined;

    const resolvedDirectory: string = resolve(toPath(directory));

    // eslint-disable-next-line no-param-reassign
    directory = resolvedDirectory;

    if (includeDirectories && walkInclude(directory, extensions, mappedMatch, mappedSkip)) {
        yield await _createWalkEntry(directory);
    }

    if (maxDepth < 1 || !walkInclude(directory, undefined, undefined, mappedSkip)) {
        return;
    }

    try {
        const entries = await readdir(directory, {
            withFileTypes: true,
        });

        for (const entry of entries) {
            let path = join(directory, entry.name);

            // The type-test backing object and name yielded for this entry. For a
            // followed symlink these are replaced by the resolved target's `Stats`
            // and real basename so the yielded entry reports the target, not the link.
            let source: Dirent | Stats = entry;
            let { name } = entry;

            // Track whether the entry needs to be re-stat'd because it is a
            // symlink we are resolving. The original dirent reports the link
            // itself (isDirectory()/isFile() are both false), so after resolving
            // we must inspect the real target to decide how to handle it.
            let isDirectory = entry.isDirectory();
            let isFile = entry.isFile();

            if (entry.isSymbolicLink()) {
                if (followSymlinks) {
                    // eslint-disable-next-line no-await-in-loop
                    const realPath = await realpath(path);

                    // Cycle detection: skip targets already visited so a symlink
                    // pointing at an ancestor directory cannot loop forever.
                    if (visited.has(realPath)) {
                        continue;
                    }

                    path = realPath;

                    // eslint-disable-next-line no-await-in-loop
                    const info = await stat(realPath);

                    isDirectory = info.isDirectory();
                    isFile = info.isFile();
                    source = info;
                    name = basename(realPath);
                } else if (includeSymlinks && walkInclude(path, extensions, mappedMatch, mappedSkip)) {
                    yield createWalkEntry(entry, entry.name, path);

                    continue;
                } else {
                    continue;
                }
            }

            if (isDirectory) {
                if (followSymlinks) {
                    visited.add(path);
                }

                yield* walk(path, {
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
                yield createWalkEntry(source, name, path);
            }
        }
    } catch (error) {
        if (error instanceof WalkError) {
            throw error;
        }

        throw new WalkError(error, directory);
    }
}
