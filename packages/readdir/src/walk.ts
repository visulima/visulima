import type { Options as MicromatchOptions } from "micromatch";
import micromatch from "micromatch";
import type { Dirent, Stats } from "node:fs";
import { promises } from "node:fs";
import { basename, join, normalize } from "node:path";

const include = (
    path: string,
    extensions?: string[],
    match?: ReadonlyArray<string> | string,
    skip?: ReadonlyArray<string> | string,
    minimatchOptions: {
        match?: MicromatchOptions;
        skip?: MicromatchOptions;
    } = {},
): boolean => {
    if (extensions && !extensions.some((extension): boolean => path.endsWith(extension))) {
        return false;
    }

    if (match && !micromatch.isMatch(path, match, { noglobstar: true, ...minimatchOptions.match })) {
        return false;
    }

    return !(skip && micromatch.isMatch(path, skip, minimatchOptions.skip));
};

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle,no-use-before-define
const _createWalkEntry = async (path: string): Promise<WalkEntry> => {
    // eslint-disable-next-line no-param-reassign
    path = normalize(path);

    const name = basename(path);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const info: Stats = await promises.stat(path);

    return {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        isDirectory: info.isDirectory,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        isFile: info.isFile,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        isSymbolicLink: info.isSymbolicLink,
        name,
        path,
    };
};

export interface Options {
    extensions?: string[];
    followSymlinks?: boolean;
    includeDirs?: boolean;
    includeFiles?: boolean;
    match?: ReadonlyArray<string> | string;
    maxDepth?: number;
    minimatchOptions?: {
        match?: MicromatchOptions;
        skip?: MicromatchOptions;
    };
    skip?: ReadonlyArray<string> | string;
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
 * - followSymlinks?: boolean = false;
 * - extensions?: string[];
 * - match?: string | ReadonlyArray<string>;
 * - skip?: string | ReadonlyArray<string>;
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export default async function* walk(
    directory: string,
    {
        extensions,
        followSymlinks = false,
        includeDirs: includeDirectories = true,
        includeFiles = true,
        match,
        maxDepth = Number.POSITIVE_INFINITY,
        minimatchOptions,
        skip,
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

    // eslint-disable-next-line no-restricted-syntax,security/detect-non-literal-fs-filename
    for await (const entry of await promises.readdir(directory, {
        withFileTypes: true,
    })) {
        if (!entry.name) {
            throw new Error("Null Entry");
        }

        let p = join(directory, entry.name);
        if (entry.isSymbolicLink()) {
            if (followSymlinks) {
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                p = await promises.realpath(p);
            } else {
                // eslint-disable-next-line no-continue
                continue;
            }
        }

        if (entry.isFile()) {
            if (includeFiles && include(p, extensions, match, skip, minimatchOptions)) {
                yield {
                    // eslint-disable-next-line @typescript-eslint/unbound-method
                    isDirectory: entry.isDirectory,
                    // eslint-disable-next-line @typescript-eslint/unbound-method
                    isFile: entry.isFile,
                    // eslint-disable-next-line @typescript-eslint/unbound-method
                    isSymbolicLink: entry.isSymbolicLink,
                    name: entry.name,
                    path: p,
                };
            }
        } else {
            yield* walk(p, {
                extensions,
                followSymlinks,
                includeDirs: includeDirectories,
                includeFiles,
                match,
                maxDepth: maxDepth - 1,
                skip,
            });
        }
    }
}
