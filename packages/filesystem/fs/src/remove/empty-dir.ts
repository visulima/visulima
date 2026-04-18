// eslint-disable-next-line unicorn/prevent-abbreviations
import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";

import { join } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import type { RetryOptions } from "../types";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
import buildRmOptions from "./utils/build-rm-options";

/**
 * Ensures that a directory is empty.
 * Deletes directory contents if the directory is not empty.
 * If the directory does not exist, it is created.
 * The directory itself is not deleted.
 * @param dir The path to the directory to empty.
 * @param options Optional configuration for the operation. See {@link RetryOptions}.
 * @returns A promise that resolves when the directory is empty.
 * @example
 * ```javascript
 * import { emptyDir } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const clearTempDir = async () => {
 *   try {
 *     await emptyDir(join("/tmp", "my-app-temp"));
 *     console.log("Temporary directory emptied or created.");
 *   } catch (error) {
 *     console.error("Failed to empty directory:", error);
 *   }
 * };
 *
 * clearTempDir();
 * ```
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
const emptyDir = async (dir: URL | string, options?: RetryOptions): Promise<void> => {
    assertValidFileOrDirectoryPath(dir);

    if (!existsSync(dir)) {
        // if not exist. then create it

        await mkdir(dir, { recursive: true });

        return;
    }

    const items = await readdir(dir);
    const rmOptions = buildRmOptions(options);

    for (const item of items) {
        // eslint-disable-next-line no-await-in-loop
        await rm(join(toPath(dir), item), rmOptions);
    }
};

export default emptyDir;
