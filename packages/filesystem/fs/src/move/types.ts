export type Options = {
    /**
     * The working directory to find source files.
     * The source and destination path are relative to this.
     * @default process.cwd()
     */
    cwd?: URL | string;

    /**
     * [Permissions](https://en.wikipedia.org/wiki/File-system_permissions#Numeric_notation) for created directories.
     *
     * It has no effect on Windows.
     * @default 0o777
     */
    readonly directoryMode?: number;

    /**
     * Overwrite existing destination file.
     * @default true
     */
    readonly overwrite?: boolean;
};

/**
 * Internal options used by the move/rename implementation.
 * Extends the public Options type with additional internal properties.
 */
export type InternalOptions = Options & {
    /**
     * Resolved working directory path.
     * URLs from the Options type are converted to string paths.
     */
    cwd: string;

    /**
     * Whether to validate the directory structure before operation.
     * @internal
     */
    validateDirectory?: boolean;
};
