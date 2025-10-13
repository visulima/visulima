// eslint-disable-next-line unicorn/prevent-abbreviations
import { lstatSync, mkdirSync } from "node:fs";

import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
import { getFileInfoType } from "./utils/get-file-info-type";

/**
 * Ensures that the directory exists.
 * If the directory structure does not exist, it is created. Like mkdir -p.
 * @param directory The path to the directory to ensure exists.
 * @example
 * ```javascript
 * import ensureDirSync from "@visulima/fs/ensure/ensure-dir-sync";
 *
 * ensureDirSync("/tmp/foo/bar/baz");
 * // Creates the directory structure /tmp/foo/bar/baz if it doesn't exist
 * ```
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
const ensureDirSync = (directory: URL | string): void => {
    assertValidFileOrDirectoryPath(directory);

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const fileInfo = lstatSync(directory);

        if (!fileInfo.isDirectory()) {
            throw new Error(`Ensure path exists, expected 'dir', got '${getFileInfoType(fileInfo)}'`);
        }

        return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    // The dir doesn't exist. Create it.
    // This can be racy. So we catch AlreadyExists and check lstat again.
    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        mkdirSync(directory, { recursive: true });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.code !== "EEXIST") {
            throw error;
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const fileInfo = lstatSync(directory);

        if (!fileInfo.isDirectory()) {
            throw new Error(`Ensure path exists, expected 'dir', got '${getFileInfoType(fileInfo)}'`);
        }
    }
};

export default ensureDirSync;
