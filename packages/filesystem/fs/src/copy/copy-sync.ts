import { cpSync } from "node:fs";

import { toPath } from "@visulima/path/utils";

import AlreadyExistsError from "../error/already-exists-error";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
import type { CopyFilterSync, CopyOptions } from "./types";

/**
 * Synchronously copies a file or directory (recursively) from `source` to `destination`.
 *
 * The synchronous counterpart of `copy`. Note that `cpSync` only accepts a
 * synchronous `filter`.
 * @param source The file or directory to copy. Can be a file URL or a string path.
 * @param destination The target path. Can be a file URL or a string path.
 * @param options Optional configuration. See {@link CopyOptions} (the `filter` must be synchronous).
 * @throws {AlreadyExistsError} When `overwrite` is `false`, `errorOnExist` is `true`, and the destination exists.
 * @example
 * ```javascript
 * import { copySync } from "@visulima/fs";
 *
 * copySync("templates/app", "out/app", { overwrite: false, errorOnExist: false });
 * ```
 */
const copySync = (source: URL | string, destination: URL | string, options: Omit<CopyOptions, "filter"> & { filter?: CopyFilterSync } = {}): void => {
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
        cpSync(sourcePath, destinationPath, {
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

export default copySync;
