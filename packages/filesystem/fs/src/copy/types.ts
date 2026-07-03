/**
 * Options for `copy` and `copySync`.
 */
export type CopyOptions = {
    /**
     * Dereference symlinks, copying the files they point to instead of the
     * links themselves.
     * @default false
     */
    dereference?: boolean;

    /**
     * When `true`, throw an error if the destination already exists and
     * {@link CopyOptions.overwrite} is `false`. When `false`, existing files
     * are silently skipped.
     * @default true
     */
    errorOnExist?: boolean;

    /**
     * Function to filter which files/directories are copied. Return `true` to
     * copy the item, `false` to skip it (and, for directories, their contents).
     * @param source The source path being considered.
     * @param destination The destination path it would be copied to.
     * @returns Whether to copy the item.
     */
    filter?: (source: string, destination: string) => boolean | Promise<boolean>;

    /**
     * Overwrite existing files/directories at the destination.
     * @default true
     */
    overwrite?: boolean;

    /**
     * Preserve timestamps (`atime`/`mtime`) from the source.
     * @default false
     */
    preserveTimestamps?: boolean;

    /**
     * When `true`, copy directories recursively.
     * @default true
     */
    recursive?: boolean;

    /**
     * When `overwrite` is `false`, this controls whether copying over an
     * existing file throws. Mirrors `node:fs.cp`'s `verbatimSymlinks`.
     * @default false
     */
    verbatimSymlinks?: boolean;
};

/**
 * Synchronous variant of {@link CopyOptions.filter}.
 */
export type CopyFilterSync = (source: string, destination: string) => boolean;
