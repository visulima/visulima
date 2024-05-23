import { lstatSync, writeFileSync } from "node:fs";

import { dirname } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
import { getFileInfoType } from "../utils/get-file-info-type";
// eslint-disable-next-line unicorn/prevent-abbreviations
import ensureDirSync from "./ensure-dir-sync";

/**
 * Ensures that the file exists.
 * If the file that is requested to be created is in directories that do not exist,
 * these directories are created. If the file already exists, it is NOTMODIFIED.
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
