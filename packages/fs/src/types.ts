import type { Dirent } from "node:fs";

import type { DocumentOptions, ParseOptions, SchemaOptions, ToJSOptions } from "yaml";

import type { FIND_UP_STOP } from "./constants";

type ColorizeMethod = (value: string) => string;

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

// eslint-disable-next-line unicorn/text-encoding-identifier-case
export type ReadFileEncoding = "ascii" | "base64" | "base64url" | "hex" | "latin1" | "ucs-2" | "ucs2" | "utf-8" | "utf-16le" | "utf8" | "utf16le";

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
    encoding?: ReadFileEncoding | undefined;

    /**
     * The flag used to open the file. Default: `r`
     */
    flag?: number | string | undefined;
};

export type ContentType<O = undefined> = O extends { buffer: true } ? Buffer : string;

// Get `reviver`` parameter from `JSON.parse()`.
export type JsonReviver = Parameters<(typeof JSON)["parse"]>["1"];

export type CodeFrameLocation = {
    column?: number;
    line: number;
};

export type CodeFrameOptions = {
    color?: {
        gutter?: ColorizeMethod;
        marker?: ColorizeMethod;
        message?: ColorizeMethod;
    };
};

export type ReadJsonOptions = CodeFrameOptions & {
    beforeParse?: (source: string) => string;
};

export type WriteFileOptions = {
    /**
     * The group and user ID used to set the file ownership. Default: `undefined`
     */
    chown?: {
        gid: number;
        uid: number;
    };

    /**
     * The encoding to use. Default: `utf8`
     */
    encoding?: BufferEncoding | null | undefined;

    /**
     * The flag used to write the file. Default: `w`
     */
    flag?: string | undefined;

    /**
     * The file mode (permission and sticky bits). Default: `0o666`
     */
    mode?: number;

    /**
     * Indicates whether the file should be overwritten if it already exists. Default: `false`
     */
    overwrite?: boolean;

    /**
     * Recursively create parent directories if needed. Default: `true`
     */
    recursive?: boolean;
};

export type JsonReplacer = (number | string)[] | ((this: unknown, key: string, value: unknown) => unknown) | null;
export type YamlReplacer = JsonReplacer;

export type WriteJsonOptions = WriteFileOptions & {
    /**
     * Detect indentation automatically if the file exists. Default: `false`
     */
    detectIndent?: boolean;

    /**
     * The space used for pretty-printing.
     *
     * Pass in `undefined` for no formatting.
     */
    indent?: number | string | undefined;

    /**
     * Passed into `JSON.stringify`.
     */
    replacer?: JsonReplacer;

    /**
     * Override the default `JSON.stringify` method.
     */
    stringify?: (data: unknown, replacer: JsonReplacer, space: number | string | undefined) => string;
};

export type FindUpOptions = {
    cwd?: URL | string;
    stopAt?: URL | string;
    type?: "directory" | "file";
};

export type Match = string | typeof FIND_UP_STOP | undefined;

// eslint-disable-next-line unicorn/prevent-abbreviations
export type EmptyDirOptions = {
    /**
     * If an `EBUSY`, `EMFILE`, `ENFILE`, `ENOTEMPTY`, or
     * `EPERM` error is encountered, Node.js will retry the operation with a linear
     * backoff wait of `retryDelay` ms longer on each try. This option represents the
     * number of retries. This option is ignored if the `recursive` option is not
     * `true`.
     * @default 0
     */
    maxRetries?: number | undefined;
    /**
     * The amount of time in milliseconds to wait between retries.
     * This option is ignored if the `recursive` option is not `true`.
     * @default 100
     */
    retryDelay?: number | undefined;
};

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type ReadYamlOptions<C> = DocumentOptions & ParseOptions & ReadFileOptions<C> & SchemaOptions & ToJSOptions;
export type YamlReviver = (key: unknown, value: unknown) => unknown;
