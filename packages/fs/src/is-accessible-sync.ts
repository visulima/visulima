import { accessSync } from "node:fs";

import { toPath } from "@visulima/path/utils";

import { F_OK } from "./constants";
import assertValidFileOrDirectoryPath from "./utils/assert-valid-file-or-directory-path";

/** Returns a boolean indicating if the path is accessible or not. */
function isAccessibleSync(path: URL | string, mode?: number): boolean;

/**
 * Synchronously tests a user's permissions for the file or directory specified by `path`.
 * If the accessibility check is successful, `true` is returned. Otherwise, `false` is returned.
 * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
 * @param [mode=F_OK] The accessibility checks to perform. Default: `F_OK` (tests for existence of the file).
 * Other possible values are `R_OK` (tests for read permission), `W_OK` (tests for write permission),
 * and `X_OK` (tests for execute permissions). Multiple modes can be combined using bitwise OR.
 * @returns `true` if the accessibility check is successful, `false` otherwise.
 * @example
 * ```javascript
 * import { isAccessibleSync, F_OK, R_OK, W_OK } from "@visulima/fs";
 * import { writeFileSync, unlinkSync, chmodSync } from "node:fs";
 * import { join } from "node:path";
 *
 * const filePath = join("temp-access-test.txt");
 *
 * // Test for existence (default mode)
 * writeFileSync(filePath, "content");
 * console.log(`File exists: ${isAccessibleSync(filePath)}`); // true
 * unlinkSync(filePath);
 * console.log(`File exists after delete: ${isAccessibleSync(filePath)}`); // false
 *
 * // Test for read and write permissions
 * writeFileSync(filePath, "content");
 * chmodSync(filePath, 0o600); // Read/Write for owner
 * console.log(`Readable: ${isAccessibleSync(filePath, R_OK)}`); // true
 * console.log(`Writable: ${isAccessibleSync(filePath, W_OK)}`); // true
 * console.log(`Readable & Writable: ${isAccessibleSync(filePath, R_OK | W_OK)}`); // true
 *
 * chmodSync(filePath, 0o400); // Read-only for owner
 * console.log(`Readable (after chmod): ${isAccessibleSync(filePath, R_OK)}`); // true
 * console.log(`Writable (after chmod): ${isAccessibleSync(filePath, W_OK)}`); // false
 *
 * unlinkSync(filePath); // Clean up
 *
 * // Example with URL
 * writeFileSync(filePath, "content for URL test");
 * const fileUrl = new URL(`file://${join(process.cwd(), filePath)}`);
 * console.log(`URL exists: ${isAccessibleSync(fileUrl)}`); // true
 * unlinkSync(filePath);
 * ```
 */

function isAccessibleSync(path: URL | string, mode: number = F_OK): boolean {
    assertValidFileOrDirectoryPath(path);

    // eslint-disable-next-line no-param-reassign
    path = toPath(path);

    try {
        accessSync(path, mode);

        return true;
    } catch {
        return false;
    }
}

export default isAccessibleSync;
