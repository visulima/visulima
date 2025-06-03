import type { Dirent, PathLike } from "node:fs";

import type { CreateNodeOptions, DocumentOptions, ParseOptions, SchemaOptions, ToJSOptions, ToStringOptions } from "yaml";

import type { FIND_UP_STOP } from "./constants";

type ColorizeMethod = (value: string) => string;

/**
 * Options for the `walk` and `walkSync` functions.
 */
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

/**
 * Represents an entry found by `walk` or `walkSync`.
 */
export interface WalkEntry extends Pick<Dirent, "isDirectory" | "isFile" | "isSymbolicLink" | "name"> {
    /** The full path to the entry. */
    path: string;
}

/**
 * Supported file encodings for reading files.
 */
// eslint-disable-next-line unicorn/text-encoding-identifier-case
export type ReadFileEncoding = "ascii" | "base64" | "base64url" | "hex" | "latin1" | "ucs-2" | "ucs2" | "utf-8" | "utf-16le" | "utf8" | "utf16le";

/**
 * Options for reading files.
 * @template C - The type of compression used.
 */
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

/**
 * Represents the content type of a read file, which can be a Buffer or a string based on options.
 * @template O - The ReadFileOptions type.
 */
export type ContentType<O = undefined> = O extends { buffer: true } ? Buffer : string;

/**
 * Type for the `reviver` parameter of `JSON.parse()`.
 * A function that transforms the results. This function is called for each member of the object.
 * If a member contains nested objects, the nested objects are transformed before the parent object is.
 */
// Get `reviver`` parameter from `JSON.parse()`.
export type JsonReviver = Parameters<(typeof JSON)["parse"]>["1"];

/**
 * Specifies a location (line and column) in a file for code frame generation.
 */
export type CodeFrameLocation = {
    /** The column number. */
    column?: number;
    /** The line number. */
    line: number;
};

/**
 * Options for customizing the appearance of code frames.
 */
export type CodeFrameOptions = {
    /** Colorization methods for different parts of the code frame. */
    color?: {
        /** Color for the gutter (line numbers). */
        gutter?: ColorizeMethod;
        /** Color for the marker (pointing to the error). */
        marker?: ColorizeMethod;
        /** Color for the message. */
        message?: ColorizeMethod;
    };
};

/**
 * Options for reading and parsing JSON files.
 * Extends {@link CodeFrameOptions}.
 */
export type ReadJsonOptions = CodeFrameOptions & {
    /**
     * A function to transform the string content before parsing.
     * @param source - The raw string content of the file.
     * @returns The transformed string content.
     */
    beforeParse?: (source: string) => string;
};

/**
 * Options for writing files.
 */
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

/**
 * Type for the `replacer` parameter of `JSON.stringify()`.
 * Can be a function that alters the behavior of the stringification process,
 * or an array of strings and numbers that acts as a whitelist for selecting
 * the properties of the value object to be included in the JSON string.
 * If this value is null or not provided, all properties of the object are included in the resulting JSON string.
 */
export type JsonReplacer = (number | string)[] | ((this: unknown, key: string, value: unknown) => unknown) | null;

/**
 * Type for the `replacer` parameter used in YAML serialization, similar to `JSON.stringify`'s replacer.
 */
export type YamlReplacer = JsonReplacer;

/**
 * Options for writing JSON files.
 * Extends {@link WriteFileOptions}.
 */
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

/**
 * Options for the `findUp` and `findUpSync` functions.
 */
export type FindUpOptions = {
    /**
     * Whether to follow symbolic links.
     * @default undefined (behaves like `true` for `findUp`, `false` for `findUpSync` due to `fs.stat` vs `fs.lstat`)
     */
    allowSymlinks?: boolean;
    /**
     * The current working directory.
     * @default process.cwd()
     */
    cwd?: URL | string;
    /**
     * The directory to stop searching at.
     * @default path.parse(cwd).root
     */
    stopAt?: URL | string;
    /**
     * The type of path to find.
     * @default "file"
     */
    type?: "directory" | "file";
};

/**
 * The result type for the name matcher function used in `findUp`.
 * It can be a `PathLike` (string, Buffer, or URL), a Promise resolving to `PathLike` or `FIND_UP_STOP`,
 * `FIND_UP_STOP` to stop the search, or `undefined` to continue.
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
export type FindUpNameFnResult = PathLike | Promise<PathLike | typeof FIND_UP_STOP> | typeof FIND_UP_STOP | undefined;

/**
 * Specifies the name(s) of the file or directory to search for in `findUp`.
 * Can be a single name, an array of names, or a function that returns a name or `FIND_UP_STOP`.
 */
export type FindUpName = string[] | string | ((directory: string) => FindUpNameFnResult);

/**
 * The result type for the name matcher function used in `findUpSync`.
 * It can be a `PathLike` (string, Buffer, or URL), `FIND_UP_STOP` to stop the search,
 * or `undefined` to continue.
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
export type FindUpNameSyncFnResult = PathLike | typeof FIND_UP_STOP | undefined;

/**
 * Specifies the name(s) of the file or directory to search for in `findUpSync`.
 * Can be a single name, an array of names, or a function that returns a name or `FIND_UP_STOP`.
 */
export type FindUpNameSync = string[] | string | ((directory: string) => FindUpNameSyncFnResult);

/**
 * Options for operations that might require retries, like `emptyDir` or `remove`.
 */
export type RetryOptions = {
    /**
     * If an `EBUSY`, `EMFILE`, `ENFILE`, `ENOTEMPTY`, or
     * `EPERM` error is encountered, Node.js will retry the operation with a linear
     * backoff wait of `retryDelay` ms longer on each try. This option represents the
     * number of retries. This option is ignored if the `recursive` option is not
     * `true` for operations that support it (like `rm`).
     * @default 0
     */
    maxRetries?: number | undefined;
    /**
     * The amount of time in milliseconds to wait between retries.
     * This option is ignored if the `recursive` option is not `true` for operations that support it.
     * @default 100
     */
    retryDelay?: number | undefined;
};

/**
 * Options for reading YAML files.
 * Combines options from `yaml` library (DocumentOptions, ParseOptions, SchemaOptions, ToJSOptions)
 * and custom {@link ReadFileOptions}.
 * @template C - The type of compression used.
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type ReadYamlOptions<C> = DocumentOptions & ParseOptions & ReadFileOptions<C> & SchemaOptions & ToJSOptions;

/**
 * Type for the `reviver` parameter used in YAML deserialization, similar to `JSON.parse`'s reviver.
 * A function that transforms the results. This function is called for each member of the object.
 * If a member contains nested objects, the nested objects are transformed before the parent object is.
 */
export type YamlReviver = (key: unknown, value: unknown) => unknown;

/**
 * Options for writing YAML files.
 * Extends {@link WriteFileOptions} and includes options from the `yaml` library for stringification.
 */
export type WriteYamlOptions = WriteFileOptions &
    CreateNodeOptions &
    DocumentOptions &
    ParseOptions &
    SchemaOptions &
    ToStringOptions & {
        /**
         * Passed into `yaml.stringify` as the replacer argument.
         */
        replacer?: YamlReplacer;
        /**
         * Passed into `yaml.stringify` as the space argument for indentation.
         * Can be a number of spaces or a string (e.g., a tab character).
         */
        space?: number | string;
    };
