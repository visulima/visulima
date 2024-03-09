import type { Dirent } from "node:fs";

export interface WalkOptions {
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

export type ReadFileOptions<C> = {
    /**
     * Return content as a Buffer. Default: `false`
     */
    buffer?: boolean;

    /**
     * Compression method to decompress the file against. Default: `none`
     */
    compression?: C;

    /**
     * The encoding to use. Default: `utf8`
     * @see https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings
     */
    // eslint-disable-next-line unicorn/text-encoding-identifier-case
    encoding?: "ascii" | "base64" | "base64url" | "hex" | "latin1" | "ucs-2" | "ucs2" | "utf-8" | "utf-16le" | "utf8" | "utf16le" | undefined;

    flag?: number | string | undefined;
};

export type ContentType<O = undefined> = O extends { buffer: true } ? Buffer : string;

// Get `reviver`` parameter from `JSON.parse()`.
export type Reviver = Parameters<(typeof JSON)["parse"]>["1"];

export type CodeFrameLocation = {
    column?: number;
    line: number;
};
