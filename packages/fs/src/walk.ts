import type { Dirent, Stats } from "node:fs";
import { readdir, realpath, stat } from "node:fs/promises";
import { basename, join, normalize, resolve } from "node:path";

import globToRegExp from "./utils/glob-to-regex";
import toPath from "./utils/to-path";

const include = (path: string, extensions?: string[], match?: RegExp[], skip?: RegExp[]): boolean => {
    if (extensions && !extensions.some((extension): boolean => path.endsWith(extension))) {
        return false;
    }

    if (match && !match.some((pattern): boolean => pattern.test(path))) {
        return false;
    }

    return !(skip && skip.some((pattern): boolean => pattern.test(path)));
};

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const _createWalkEntry = async (path: string): Promise<WalkEntry> => {
    const normalizePath: string = normalize(path as string);

    const name = basename(normalizePath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const info: Stats = await stat(normalizePath);

    return {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        isDirectory: info.isDirectory,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        isFile: info.isFile,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        isSymbolicLink: info.isSymbolicLink,
        name,
        path: normalizePath,
    };
};

export interface Options {
    /**
     * List of file extensions used to filter entries.
     * If specified, entries without the file extension specified by this option are excluded.
     * @default {undefined}
     */
    extensions?: string[];
    /**
     * Indicates whether symlinks should be resolved or not.
     * @default {false}
     */
    followSymlinks?: boolean;
    /**
     * Indicates whether directory entries should be included or not.
     * @default {true}
     */
    includeDirs?: boolean;
    /**
     * Indicates whether file entries should be included or not.
     * @default {true}
     */
    includeFiles?: boolean;
    /**
     * Indicates whether symlink entries should be included or not.
     * This option is meaningful only if `followSymlinks` is set to `false`.
     * @default {true}
     */
    includeSymlinks?: boolean;
    /**
     * List of regular expression or glob patterns used to filter entries.
     * If specified, entries that do not match the patterns specified by this option are excluded.
     * @default {undefined}
     */
    match?: (RegExp | string)[];
    /**
     * The maximum depth of the file tree to be walked recursively.
     * @default {Infinity}
     */
    maxDepth?: number;
    /**
     * List of regular expression or glob patterns used to filter entries.
     * If specified, entries matching the patterns specified by this option are excluded.
     * @default {undefined}
     */
    skip?: (RegExp | string)[];
}

export interface WalkEntry extends Pick<Dirent, "isDirectory" | "isFile" | "isSymbolicLink" | "name"> {
    path: string;
}

/**
 * Walks the file tree rooted at root, yielding each file or directory in the
 * tree filtered according to the given options.
 * Options:
 * - maxDepth?: number = Infinity;
 * - includeFiles?: boolean = true;
 * - includeDirs?: boolean = true;
 * - includeSymlinks?: boolean = true;
 * - followSymlinks?: boolean = false;
 * - extensions?: string[];
 * - match?: string | ReadonlyArray<string>;
 * - skip?: string | ReadonlyArray<string>;
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export default async function* walk(
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
    }: Options = {},
): AsyncIterableIterator<WalkEntry> {
    if (maxDepth < 0) {
        return;
    }

    const mappedMatch = match ? match.map((pattern): RegExp => (typeof pattern === "string" ? globToRegExp(pattern) : pattern)) : undefined;
    const mappedSkip = skip ? skip.map((pattern): RegExp => (typeof pattern === "string" ? globToRegExp(pattern) : pattern)) : undefined;

    // eslint-disable-next-line no-param-reassign
    directory = resolve(toPath(directory));

    if (includeDirectories && include(directory, extensions, mappedMatch, mappedSkip)) {
        yield await _createWalkEntry(directory);
    }

    if (maxDepth < 1 || !include(directory, undefined, undefined, mappedSkip)) {
        return;
    }

    // eslint-disable-next-line no-restricted-syntax,security/detect-non-literal-fs-filename,no-loops/no-loops
    for await (const entry of await readdir(directory, {
        withFileTypes: true,
    })) {
        if (!entry.name) {
            throw new Error("Null Entry");
        }

        let path = join(directory, entry.name);

        if (entry.isSymbolicLink()) {
            if (followSymlinks) {
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                path = await realpath(path);
            } else if (includeSymlinks && include(path, extensions, mappedMatch, mappedSkip)) {
                yield {
                    // eslint-disable-next-line @typescript-eslint/unbound-method
                    isDirectory: entry.isDirectory,
                    // eslint-disable-next-line @typescript-eslint/unbound-method
                    isFile: entry.isFile,
                    // eslint-disable-next-line @typescript-eslint/unbound-method
                    isSymbolicLink: entry.isSymbolicLink,
                    name: entry.name,
                    path,
                };
            } else {
                // eslint-disable-next-line no-continue
                continue;
            }
        }

        if (entry.isSymbolicLink() || entry.isDirectory()) {
            yield* walk(path, {
                extensions,
                followSymlinks,
                includeDirs: includeDirectories,
                includeFiles,
                includeSymlinks,
                match: mappedMatch,
                maxDepth: maxDepth - 1,
                skip: mappedSkip,
            } as Options);
        } else if (entry.isFile() && includeFiles && include(path, extensions, mappedMatch, mappedSkip)) {
            yield {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                isDirectory: entry.isDirectory,
                // eslint-disable-next-line @typescript-eslint/unbound-method
                isFile: entry.isFile,
                // eslint-disable-next-line @typescript-eslint/unbound-method
                isSymbolicLink: entry.isSymbolicLink,
                name: entry.name,
                path,
            };
        }
    }
}
