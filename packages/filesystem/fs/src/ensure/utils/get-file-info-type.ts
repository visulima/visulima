import type { Stats } from "node:fs";

export type PathType = "dir" | "file" | "symlink";

/**
 * Get a human-readable file type string.
 * @param fileInfo A FileInfo describes a file and is returned by `stat`, `lstat`
 */
export const getFileInfoType = (fileInfo: Stats): PathType | undefined => {
    if (fileInfo.isFile()) {
        return "file";
    }

    if (fileInfo.isDirectory()) {
        return "dir";
    }

    if (fileInfo.isSymbolicLink()) {
        return "symlink";
    }

    return undefined;
};
