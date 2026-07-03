import { access } from "node:fs/promises";

import { toPath } from "@visulima/path/utils";

import { F_OK } from "./constants";
import assertValidFileOrDirectoryPath from "./utils/assert-valid-file-or-directory-path";

/**
 * Asynchronously tests a user's permissions for the file or directory specified by path.
 * Returns a Promise that resolves to `true` if the accessibility check is successful, `false` otherwise.
 * @param path The path to the file or directory. Can be a string or a URL object.
 * @param mode The accessibility checks to perform. Defaults to `F_OK` (check for existence).
 * Other possible values include `R_OK` (check for read access), `W_OK` (check for write access),
 * and `X_OK` (check for execute/search access). Multiple modes can be combined using bitwise OR.
 * @returns A Promise that resolves to a boolean indicating if the path is accessible with the specified mode.
 * @example
 * ```typescript
 * import { isAccessible, F_OK, R_OK } from "@visulima/fs";
 *
 * (async () => {
 *   if (await isAccessible("myFile.txt")) {
 *     console.log("myFile.txt exists");
 *   }
 *
 *   if (await isAccessible("myFile.txt", R_OK)) {
 *     console.log("myFile.txt is readable");
 *   }
 *
 *   if (await isAccessible("myDirectory", F_OK | R_OK | W_OK)) {
 *     console.log("myDirectory exists, is readable and writable");
 *   }
 * })();
 * ```
 */
async function isAccessible(path: URL | string, mode?: number): Promise<boolean>;

async function isAccessible(path: URL | string, mode: number = F_OK): Promise<boolean> {
    assertValidFileOrDirectoryPath(path);

    // eslint-disable-next-line no-param-reassign
    path = toPath(path);

    try {
        await access(path, mode);

        return true;
    } catch {
        return false;
    }
}

export default isAccessible;
