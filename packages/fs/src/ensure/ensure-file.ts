import { lstat, writeFile } from "node:fs/promises";

import { dirname } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
// eslint-disable-next-line unicorn/prevent-abbreviations
import ensureDir from "./ensure-dir";
import { getFileInfoType } from "./utils/get-file-info-type";

/**
 * Asynchronously ensures that a file exists.
 * If the directory structure for the file does not exist, it is created.
 * If the file already exists, it is not modified.
 * @param filePath The path to the file. Can be a string or a URL object.
 * @returns A Promise that resolves when the file has been created or confirmed to exist.
 * @throws Will throw an error if the path exists and is not a file.
 * @throws Will throw an error if directory or file creation fails for reasons other than the path not existing initially.
 * @example
 * ```typescript
 * import { ensureFile } from "@visulima/fs";
 *
 * (async () => {
 *   try {
 *     await ensureFile("path/to/my/file.txt");
 *     console.log("File ensured!");
 *
 *     await ensureFile(new URL("file:///path/to/another/file.log"));
 *     console.log("Another file ensured!");
 *   } catch (error) {
 *     console.error("Failed to ensure file:", error);
 *   }
 * })();
 * ```
 */
const ensureFile = async (filePath: URL | string): Promise<void> => {
    assertValidFileOrDirectoryPath(filePath);

    try {
        // if file exists
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const stat = await lstat(filePath);

        if (!stat.isFile()) {
            throw new Error(`Ensure path exists, expected 'file', got '${getFileInfoType(stat)}'`);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // if file not exists

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
