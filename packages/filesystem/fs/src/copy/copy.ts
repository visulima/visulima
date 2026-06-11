import { cp } from "node:fs/promises";

import { toPath } from "@visulima/path/utils";

import AlreadyExistsError from "../error/already-exists-error";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
import type { CopyOptions } from "./types";

/**
 * Asynchronously copies a file or directory (recursively) from `source` to `destination`.
 *
 * Built on `node:fs.cp`, this completes the fs-extra parity story alongside
 * `move`, `remove` and `emptyDir`.
 * @param source The file or directory to copy. Can be a file URL or a string path.
 * @param destination The target path. Can be a file URL or a string path.
 * @param options Optional configuration. See {@link CopyOptions}.
 * @returns A promise that resolves when the copy completes.
 * @throws {AlreadyExistsError} When `overwrite` is `false`, `errorOnExist` is `true`, and the destination exists.
 * @example
 * ```javascript
 * import { copy } from "@visulima/fs";
 *
 * // Copy a template directory, skipping node_modules and overwriting existing files
 * await copy("templates/app", "out/app", {
 *   filter: (src) => !src.includes("node_modules"),
 * });
 * ```
 */
const copy = async (source: URL | string, destination: URL | string, options: CopyOptions = {}): Promise<void> => {
    assertValidFileOrDirectoryPath(source);
    assertValidFileOrDirectoryPath(destination);

    const {
        dereference = false,
        errorOnExist = true,
        filter,
        overwrite = true,
        preserveTimestamps = false,
        recursive = true,
        verbatimSymlinks = false,
    } = options;

    const sourcePath = toPath(source);
    const destinationPath = toPath(destination);

    try {
        await cp(sourcePath, destinationPath, {
            dereference,
            errorOnExist,
            filter,
            force: overwrite,
            preserveTimestamps,
            recursive,
            verbatimSymlinks,
        });
    } catch (error) {
        if ((error as NodeJS.ErrnoException | undefined)?.code === "ERR_FS_CP_EEXIST") {
            throw new AlreadyExistsError(`destination already exists, copy '${destinationPath}'`);
        }

        throw error;
    }
};

export default copy;
