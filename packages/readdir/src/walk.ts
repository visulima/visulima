import type { Options as MicromatchOptions } from "micromatch";
import micromatch from "micromatch";
import type { Dirent } from "node:fs";
import { promises } from "node:fs";
import { basename, join, normalize } from "node:path";

function include(
    path: string,
    extensions?: string[],
    match?: ReadonlyArray<string> | string,
    skip?: ReadonlyArray<string> | string,
    minimatchOptions: {
        match?: MicromatchOptions;
        skip?: MicromatchOptions;
    } = {},
): boolean {
    if (extensions && !extensions.some((extension): boolean => path.endsWith(extension))) {
        return false;
    }

    if (match && !micromatch.isMatch(path, match, { noglobstar: true, ...minimatchOptions.match })) {
        return false;
    }

    return !(skip && micromatch.isMatch(path, skip, minimatchOptions.skip));
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
    match?: ReadonlyArray<string> | string;
    skip?: ReadonlyArray<string> | string;
    minimatchOptions?: {
        match?: MicromatchOptions;
        skip?: MicromatchOptions;
    };
};

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
 * - followSymlinks?: boolean = false;
 * - extensions?: string[];
 * - match?: string | ReadonlyArray<string>;
 * - skip?: string | ReadonlyArray<string>;
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
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
        minimatchOptions,
    }: Options = {},
): AsyncIterableIterator<WalkEntry> {
    if (maxDepth < 0) {
        return;
    }

    if (includeDirectories && include(directory, extensions, match, skip, minimatchOptions)) {
        yield await _createWalkEntry(directory);
    }

    if (maxDepth < 1 || !include(directory, undefined, undefined, skip, minimatchOptions)) {
        return;
    }

    // eslint-disable-next-line no-restricted-syntax
    for await (const entry of await promises.readdir(directory, {
        withFileTypes: true,
    })) {
        if (!entry.name) {
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
            if (includeFiles && include(p, extensions, match, skip, minimatchOptions)) {
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
