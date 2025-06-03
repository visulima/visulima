// eslint-disable-next-line unicorn/prevent-abbreviations
import { lstat, mkdir } from "node:fs/promises";

import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
import { getFileInfoType } from "./utils/get-file-info-type";

/**
 * Ensures that the directory exists.
 * If the directory structure does not exist, it is created. Like mkdir -p.
 * @param directory The path to the directory to ensure exists.
 * @example
 * ```javascript
 * import ensureDir from "@visulima/fs/ensure/ensure-dir";
 *
 * await ensureDir("/tmp/foo/bar/baz");
 * // Creates the directory structure /tmp/foo/bar/baz if it doesn't exist
 * ```
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
const ensureDir = async (directory: URL | string): Promise<void> => {
    assertValidFileOrDirectoryPath(directory);

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const fileInfo = await lstat(directory);

        if (!fileInfo.isDirectory()) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`Ensure path exists, expected 'dir', got '${getFileInfoType(fileInfo)}'`);
        }

        return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    // The dir doesn't exist. Create it.
    // This can be racy. So we catch AlreadyExists and check lstat again.
    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await mkdir(directory, { recursive: true });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (error.code !== "EEXIST") {
            throw error;
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const fileInfo = await lstat(directory);

        if (!fileInfo.isDirectory()) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`Ensure path exists, expected 'dir', got '${getFileInfoType(fileInfo)}'`);
        }
    }
};

export default ensureDir;
