type FilePermissions = number;

export type Options = {
    /**
     * The working directory to find source files.
     * The source and destination path are relative to this.
     *
     * @default process.cwd()
     * */
    cwd?: URL | string;

    /**
     * [Permissions](https://en.wikipedia.org/wiki/File-system_permissions#Numeric_notation) for created directories.
     *
     * It has no effect on Windows.
     *
     * @default 0o777
     * */
    readonly directoryMode?: FilePermissions;

    /**
     * Overwrite existing destination file.
     *
     * @default true
     * */
    readonly overwrite?: boolean;
};

export type InternalOptions = Options & {
    cwd: string;

    validateDirectory?: boolean;
};
