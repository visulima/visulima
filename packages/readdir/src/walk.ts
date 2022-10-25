import { Dirent, promises } from "node:fs";
import { basename, join, normalize } from "node:path";

function include(path: string, extensions?: string[], match?: RegExp[], skip?: RegExp[]): boolean {
    if (extensions && !extensions.some((extension): boolean => path.endsWith(extension))) {
        return false;
    }

    if (match && !match.some((pattern): boolean => pattern.test(path))) {
        return false;
    }

    return !(skip && skip.some((pattern): boolean => pattern.test(path)));
}

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
async function _createWalkEntry(path: string): Promise<WalkEntry> {
    // eslint-disable-next-line no-param-reassign
    path = normalize(path);

    const name = basename(path);
    const info = await promises.stat(path);

    return {
        name,
        path,
        isFile: info.isFile,
        isDirectory: info.isDirectory,
        isSymbolicLink: info.isSymbolicLink,
    };
}

export type Options = {
    maxDepth?: number;
    includeFiles?: boolean;
    includeDirs?: boolean;
    followSymlinks?: boolean;
    extensions?: string[];
    match?: RegExp[];
    skip?: RegExp[];
};

export interface WalkEntry extends Pick<Dirent, "name" | "isFile" | "isDirectory" | "isSymbolicLink"> {
    path: string;
}

/**
 * Walks the file tree rooted at root, yielding each file or directory in the
 * tree filtered according to the given options.
 * Options:
 * - maxDepth?: number = Infinity;
 * - includeFiles?: boolean = true;
 * - includeDirs?: boolean = true;
 * - followSymlinks?: boolean = false;
 * - extensions?: string[];
 * - match?: RegExp[];
 * - skip?: RegExp[];
 */
// eslint-disable-next-line radar/cognitive-complexity
export default async function* walk(
    directory: string,
    {
        maxDepth = Number.POSITIVE_INFINITY,
        includeFiles = true,
        includeDirs: includeDirectories = true,
        followSymlinks = false,
        extensions,
        match,
        skip,
    }: Options = {},
): AsyncIterableIterator<WalkEntry> {
    if (maxDepth < 0) {
        return;
    }

    if (includeDirectories && include(directory, extensions, match, skip)) {
        yield await _createWalkEntry(directory);
    }

    if (maxDepth < 1 || !include(directory, undefined, undefined, skip)) {
        return;
    }

    // eslint-disable-next-line no-restricted-syntax
    for await (const entry of await promises.readdir(directory, {
        withFileTypes: true,
    })) {
        if (entry.name === null) {
            throw new Error("Null Entry");
        }

        let p = join(directory, entry.name);
        if (entry.isSymbolicLink()) {
            if (followSymlinks) {
                p = await promises.realpath(p);
            } else {
                // eslint-disable-next-line no-continue
                continue;
            }
        }

        if (entry.isFile()) {
            if (includeFiles && include(p, extensions, match, skip)) {
                yield {
                    path: p,
                    name: entry.name,
                    isDirectory: entry.isDirectory,
                    isFile: entry.isFile,
                    isSymbolicLink: entry.isSymbolicLink,
                };
            }
        } else {
            yield* walk(p, {
                maxDepth: maxDepth - 1,
                includeFiles,
                includeDirs: includeDirectories,
                followSymlinks,
                extensions,
                match,
                skip,
            });
        }
    }
}
