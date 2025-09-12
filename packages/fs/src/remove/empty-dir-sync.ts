// eslint-disable-next-line unicorn/prevent-abbreviations
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";

import { join } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import type { RetryOptions } from "../types";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";

/**
 * Ensures that a directory is empty.
 * Deletes directory contents if the directory is not empty.
 * If the directory does not exist, it is created.
 * The directory itself is not deleted.
 * @param dir The path to the directory to empty.
 * @param options Optional configuration for the operation. See {@link RetryOptions}.
 * @returns void
 * @example
 * ```javascript
 * import { emptyDirSync } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * try {
 *   emptyDirSync(join("/tmp", "my-app-temp"));
 *   console.log("Temporary directory emptied or created.");
 * } catch (error) {
 *   console.error("Failed to empty directory:", error);
 * }
 * ```
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
const emptyDirSync = (dir: URL | string, options?: RetryOptions): void => {
    assertValidFileOrDirectoryPath(dir);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(dir)) {
        // if not exist. then create it
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        mkdirSync(dir, { recursive: true });

        return;
    }

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,security/detect-non-literal-fs-filename
    for (const item of readdirSync(dir)) {
        rmSync(join(toPath(dir), item), { ...options, force: true, recursive: true });
    }
};

export default emptyDirSync;
