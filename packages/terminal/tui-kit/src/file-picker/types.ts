/**
 * A single entry (file or directory) returned by the file system hook.
 */
export type FileEntry = {
    readonly isDirectory: boolean;
    readonly isHidden: boolean;
    readonly name: string;
    readonly path: string;
    readonly permissions: string;
    readonly size: number;
};

/**
 * Filter options for the file picker.
 */
export type FilePickerFilter = {
    /**
     * Allowed file extensions (e.g. `[".ts", ".tsx"]`). Empty or omitted means all.
     */
    readonly extensions?: ReadonlyArray<string>;

    /**
     * Whether to include directories in the list.
     * @default true
     */
    readonly showDirectories?: boolean;

    /**
     * Whether to include regular files in the list.
     * @default true
     */
    readonly showFiles?: boolean;

    /**
     * Whether to include hidden files (names starting with `.`).
     * @default false
     */
    readonly showHidden?: boolean;
};
