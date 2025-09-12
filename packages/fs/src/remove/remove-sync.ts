import { rmSync, unlinkSync } from "node:fs";

import type { RetryOptions } from "../types";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";

/**
 * Synchronously removes a file or directory (recursively).
 * If the path does not exist, it does nothing.
 *
 * @param path The path to the file or directory to remove.
 * @param options Optional configuration for the operation. See {@link RetryOptions}.
 * @returns void
 * @example
 * ```javascript
 * import { removeSync } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * try {
 *   removeSync(join("/tmp", "my-file.txt"));
 *   console.log("File /tmp/my-file.txt removed.");
 *
 *   removeSync(join("/tmp", "my-empty-dir"));
 *   console.log("Directory /tmp/my-empty-dir removed.");
 *
 *   removeSync(join("/tmp", "my-dir-with-contents"));
 *   console.log("Directory /tmp/my-dir-with-contents and its contents removed.");
 * } catch (error) {
 *   console.error("Failed to remove path:", error);
 * }
 * ```
 */
const removeSync = (path: URL | string, options: RetryOptions = {}): void => {
    assertValidFileOrDirectoryPath(path);

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        unlinkSync(path);
    } catch {
        /* empty */
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        rmSync(path, { force: true, maxRetries: options?.maxRetries, recursive: true, retryDelay: options?.retryDelay });
    } catch {
        /* empty */
    }
};

export default removeSync;
