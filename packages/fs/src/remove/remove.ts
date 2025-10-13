import { rm, unlink } from "node:fs/promises";

import type { RetryOptions } from "../types";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";

/**
 * Asynchronously removes a file or directory (recursively).
 * If the path does not exist, it does nothing.
 * @param path The path to the file or directory to remove.
 * @param options Optional configuration for the operation. See {@link RetryOptions}.
 * @returns A promise that resolves when the path has been removed.
 * @example
 * ```javascript
 * import { remove } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const deleteFileOrDir = async () => {
 *   try {
 *     await remove(join("/tmp", "my-file.txt"));
 *     console.log("File /tmp/my-file.txt removed.");
 *
 *     await remove(join("/tmp", "my-empty-dir"));
 *     console.log("Directory /tmp/my-empty-dir removed.");
 *
 *     await remove(join("/tmp", "my-dir-with-contents"));
 *     console.log("Directory /tmp/my-dir-with-contents and its contents removed.");
 *   } catch (error) {
 *     console.error("Failed to remove path:", error);
 *   }
 * };
 *
 * deleteFileOrDir();
 * ```
 */
const remove = async (path: URL | string, options: RetryOptions = {}): Promise<void> => {
    assertValidFileOrDirectoryPath(path);

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await unlink(path);
    } catch {
        /* empty */
    }

    try {
        await rm(path, { force: true, maxRetries: options?.maxRetries, recursive: true, retryDelay: options?.retryDelay });
    } catch {
        /* empty */
    }
};

export default remove;
