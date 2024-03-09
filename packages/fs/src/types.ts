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
