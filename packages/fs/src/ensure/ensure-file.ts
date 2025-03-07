import { lstat, writeFile } from "node:fs/promises";

import { dirname } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
// eslint-disable-next-line unicorn/prevent-abbreviations
import ensureDir from "./ensure-dir";
import { getFileInfoType } from "./utils/get-file-info-type";

/**
 * Ensures that the file exists.
 * If the file that is requested to be created is in directories that do not exist,
 * these directories are created. If the file already exists, it is NOTMODIFIED.
 */
const ensureFile = async (filePath: URL | string): Promise<void> => {
    assertValidFileOrDirectoryPath(filePath);

    try {
        // if file exists
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const stat = await lstat(filePath);

        if (!stat.isFile()) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`Ensure path exists, expected 'file', got '${getFileInfoType(stat)}'`);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // if file not exists
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (error.code === "ENOENT") {
            // ensure dir exists
            await ensureDir(dirname(toPath(filePath)));
            // create file
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            await writeFile(filePath, new Uint8Array());

            return;
        }

        throw error;
    }
};

export default ensureFile;
