import type { Dirent, PathLike } from "node:fs";

import type { GlobOptions as TinyGlobOptions } from "tinyglobby";
import type { CreateNodeOptions, DocumentOptions, ParseOptions, SchemaOptions, ToJSOptions, ToStringOptions } from "yaml";

import type { FIND_UP_STOP } from "./constants";

type ColorizeMethod = (value: string) => string;

/**
 * Options accepted by `jsonc-parser`'s `parse` function.
 */
export type JsoncParseOptions = {
    /**
     * Allow empty content as a valid input. Defaults to `false`.
     */
    allowEmptyContent?: boolean;

    /**
     * Allow trailing commas in arrays and objects. Defaults to `false`.
     */
    allowTrailingComma?: boolean;

    /**
     * Disallow JavaScript-style comments in the input. Defaults to `false` (comments allowed).
     */
    disallowComments?: boolean;
};

/**
 * Formatting options for `jsonc-parser` edits.
 */
export type JsoncFormattingOptions = {
    /**
     * The line ending to use in the output.
     */
    eol?: string;

    /**
     * When `true`, insert a final newline when the output does not end with one.
     */
    insertFinalNewline?: boolean;

    /**
     * Indent with spaces (`true`) or tabs (`false`). Defaults to `true`.
     */
    insertSpaces?: boolean;

    /**
     * When `true`, attempt to keep the original line structure when applying edits.
     */
    keepLines?: boolean;

    /**
     * Indent size when {@link JsoncFormattingOptions.insertSpaces | insertSpaces} is `true`.
     */
    tabSize?: number;
};

/**
 * Options accepted by the `ini` library's `stringify` / `encode` functions.
 * Kept as a local definition so the types compile without the optional peer installed.
 */
export type IniEncodeOptions = {
    /**
     * Align `=` signs across the output.
     */
    align?: boolean;

    /**
     * Serialize array values using the `key[]` convention. Defaults to `true`.
     */
    bracketedArray?: boolean;

    /**
     * Append a trailing newline to every section.
     */
    newline?: boolean;

    /**
     * Target platform for section/key escaping. Defaults to the current platform.
     */
    platform?: string;

    /**
     * Name of the top-level section.
     */
    section?: string;

    /**
     * Sort keys alphabetically within sections.
     */
    sort?: boolean;

    /**
     * Write `key = value` with spaces around `=`. Defaults to `false`.
     */
    whitespace?: boolean;
};

/**
 * Replacer accepted by `JSON5.stringify()`.
 */
export type Json5Replacer = (number | string)[] | ((this: unknown, key: string, value: unknown) => unknown) | null;

/**
 * Options for the `glob` and `globSync` functions.
 *
 * Re-exported from [`tinyglobby`](https://github.com/SuperchupuDev/tinyglobby) (which is bundled into the built
 * output, with a local patch adding negated-ignore support). The `ignore` option accepts leading-`!` patterns to
 * _un-ignore_ entries — for example `ignore: ["dist/**", "!dist/index.d.ts"]` drops the `dist/` tree except for
 * its type entry point.
 */
export type GlobOptions = Omit<TinyGlobOptions, "patterns">;

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
 * Supported compression types for file operations.
 */
export type CompressionType = "brotli" | "gzip" | "none";

/**
 * Supported file encodings for reading files.
 */
// eslint-disable-next-line unicorn/text-encoding-identifier-case
export type ReadFileEncoding = "ascii" | "base64" | "base64url" | "hex" | "latin1" | "ucs-2" | "ucs2" | "utf-8" | "utf-16le" | "utf8" | "utf16le";

/**
 * Options for reading files.
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
    encoding?: ReadFileEncoding;

    /**
     * The flag used to open the file. Default: `r`
     */
    flag?: number | string;
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
     * @param source The raw string content of the file.
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
    encoding?: BufferEncoding | null;

    /**
     * The flag used to write the file. Default: `w`
     */
    flag?: string;

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
 * @deprecated Use {@link JsonReplacer} directly instead.
 */
// eslint-disable-next-line sonarjs/redundant-type-aliases
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
    indent?: number | string;

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
    maxRetries?: number;

    /**
     * The amount of time in milliseconds to wait between retries.
     * This option is ignored if the `recursive` option is not `true` for operations that support it.
     * @default 100
     */
    retryDelay?: number;
};

/**
 * Options for reading YAML files.
 * Combines options from `yaml` library (DocumentOptions, ParseOptions, SchemaOptions, ToJSOptions)
 * and custom {@link ReadFileOptions}.
 */

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
export type WriteYamlExtras = {
    /**
     * Passed into `yaml.stringify` as the replacer argument.
     */
    replacer?: JsonReplacer;

    /**
     * Passed into `yaml.stringify` as the space argument for indentation.
     * Can be a number of spaces or a string (e.g., a tab character).
     */
    space?: number | string;
};

export type WriteYamlOptions = CreateNodeOptions & DocumentOptions & ParseOptions & SchemaOptions & ToStringOptions & WriteFileOptions & WriteYamlExtras;

/**
 * Options for reading TOML files.
 * Uses `smol-toml`, which does not expose additional parse options.
 */
export type ReadTomlOptions<C> = ReadFileOptions<C>;

/**
 * Options for writing TOML files.
 * Extends {@link WriteFileOptions}. `smol-toml` does not expose additional stringify options.
 */
// eslint-disable-next-line sonarjs/redundant-type-aliases
export type WriteTomlOptions = WriteFileOptions;

/**
 * Extra options for JSONC parsing on top of file-reading and code-frame options.
 */
export type ReadJsoncExtras = {
    /**
     * A function to transform the string content before parsing.
     * @param source The raw string content of the file.
     * @returns The transformed string content.
     */
    beforeParse?: (source: string) => string;
};

/**
 * Options for reading JSONC (JSON with comments) files.
 * Combines options from `jsonc-parser` and custom {@link ReadFileOptions} and {@link CodeFrameOptions}.
 */
export type ReadJsoncOptions<C> = CodeFrameOptions & JsoncParseOptions & ReadFileOptions<C> & ReadJsoncExtras;

/**
 * Options for writing JSONC files with optional comment preservation.
 * Extends {@link WriteFileOptions}.
 */
export type WriteJsoncOptions = WriteFileOptions & {
    /**
     * Detect indentation automatically if the file exists. Default: `false`.
     */
    detectIndent?: boolean;

    /**
     * Formatting options forwarded to `jsonc-parser` when modifying existing files.
     */
    formattingOptions?: JsoncFormattingOptions;

    /**
     * Indentation used when writing a fresh file (no existing file to preserve).
     * Default: `"\t"`.
     */
    indent?: number | string;

    /**
     * When `true` and the file already exists, preserve existing comments and formatting
     * by computing a minimal diff against the new data via `jsonc-parser`'s `modify` API. Default: `true`.
     */
    preserveComments?: boolean;

    /**
     * Passed into `JSON.stringify` when writing a fresh file.
     */
    replacer?: JsonReplacer;
};

/**
 * Type for the `reviver` parameter of `JSON5.parse()`.
 */
export type Json5Reviver = (this: unknown, key: string, value: unknown) => unknown;

/**
 * Extra options for JSON5 parsing on top of file-reading and code-frame options.
 */
export type ReadJson5Extras = {
    /**
     * A function to transform the string content before parsing.
     */
    beforeParse?: (source: string) => string;
};

/**
 * Options for reading JSON5 files.
 */
export type ReadJson5Options<C> = CodeFrameOptions & ReadFileOptions<C> & ReadJson5Extras;

/**
 * Options for writing JSON5 files.
 * Extends {@link WriteFileOptions}.
 */
export type WriteJson5Options = WriteFileOptions & {
    /**
     * Detect indentation automatically if the file exists. Default: `false`.
     */
    detectIndent?: boolean;

    /**
     * Indentation for pretty-printing.
     */
    indent?: number | string;

    /**
     * Override the quote character used for strings. See `JSON5.stringify`.
     */
    quote?: string;

    /**
     * Passed into `JSON5.stringify`.
     */
    replacer?: Json5Replacer;
};

/**
 * Options for reading INI files.
 */
export type ReadIniOptions<C> = ReadFileOptions<C> & {
    /**
     * Parse array values (keys ending with `[]`) into native arrays. Default: `true`.
     */
    bracketedArray?: boolean;
};

/**
 * Supported INI line-ending values.
 */
export type IniLineEnding = "\n" | "\r\n";

/**
 * Extra options for INI writing on top of the `ini` encoder options and file-writing options.
 */
export type WriteIniExtras = {
    /**
     * Line ending to write. When omitted and {@link WriteIniOptions.preserveStyle | preserveStyle} is `true`,
     * the line ending is auto-detected from the existing file. Falls back to `"\n"` otherwise.
     */
    eol?: IniLineEnding;

    /**
     * When `true` and the file already exists, auto-detect and preserve styling described on this type.
     * Defaults to `true`. Explicit `whitespace` / `eol` values always win over detection.
     */
    preserveStyle?: boolean;
};

/**
 * Options for writing INI files.
 *
 * Extends {@link WriteFileOptions} and `ini`'s {@link IniEncodeOptions}. When an existing file is present and
 * {@link WriteIniOptions.preserveStyle | preserveStyle} is `true` (the default), the following styling is
 * detected from that file and applied unless overridden: space around `=` (via {@link IniEncodeOptions.whitespace | whitespace}),
 * line ending (via {@link WriteIniOptions.eol | eol}), and per-key original lines (including trailing
 * whitespace and inline `;` / `#` comments) for unchanged values.
 */
export type WriteIniOptions = IniEncodeOptions & WriteFileOptions & WriteIniExtras;
