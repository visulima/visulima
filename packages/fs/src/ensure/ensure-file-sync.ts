import { lstatSync, writeFileSync } from "node:fs";

import { dirname } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
// eslint-disable-next-line unicorn/prevent-abbreviations
import ensureDirSync from "./ensure-dir-sync";
import { getFileInfoType } from "./utils/get-file-info-type";

/**
 * Ensures that the file exists.
 * If the file that is requested to be created is in directories that do not exist,
 * these directories are created. If the file already exists, it is NOT MODIFIED.
 * @param filePath The path to the file to ensure exists.
 * @example
 * ```javascript
 * import { ensureFileSync } from "@visulima/fs";
 *
 * ensureFileSync("/tmp/foo/bar/baz.txt");
 * // Creates the file /tmp/foo/bar/baz.txt and any missing parent directories if they don't exist
 * ```
 */
const ensureFileSync = (filePath: URL | string): void => {
    assertValidFileOrDirectoryPath(filePath);

    try {
        // if file exists
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const stat = lstatSync(filePath);

        if (!stat.isFile()) {
            throw new Error(`Ensure path exists, expected 'file', got '${getFileInfoType(stat)}'`);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // if file not exists

        if (error.code === "ENOENT") {
            // ensure dir exists
            ensureDirSync(dirname(toPath(filePath)));
            // create file
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            writeFileSync(filePath, new Uint8Array());

            return;
        }

        throw error;
    }
};

export default ensureFileSync;
