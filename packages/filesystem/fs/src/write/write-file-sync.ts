import type { Stats } from "node:fs";
import { chmodSync, chownSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync as nodeWriteFileSync } from "node:fs";

import { dirname } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import { F_OK } from "../constants";
import AlreadyExistsError from "../error/already-exists-error";
import isAccessibleSync from "../is-accessible-sync";
import type { WriteFileOptions } from "../types";
import assertValidFileContents from "../utils/assert-valid-file-contents";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
import temporaryPath from "./utils/temporary-path";
import toUint8Array from "./utils/to-uint-8-array";

/**
 * Synchronously writes data to a file, replacing the file if it already exists.
 * This function includes safeguards like writing to a temporary file first and then renaming, and handling permissions.
 * @param path The path to the file to write. Can be a file URL or a string path.
 * @param content The data to write. Can be a string, Buffer, ArrayBuffer, or ArrayBufferView.
 * @param options Optional configuration for writing the file. See {@link WriteFileOptions}.
 * @returns void
 * @example
 * ```javascript
 * import { writeFileSync } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const writeMyFileSync = () => {
 *   try {
 *     writeFileSync(join("/tmp", "my-new-file-sync.txt"), "Hello World Synchronously!");
 *     console.log("File written successfully (sync).");
 *
 *     writeFileSync(join("/tmp", "another-file-sync.txt"), "Some other sync content", { encoding: 'utf16le', mode: 0o600 });
 *     console.log("Another file written with specific options (sync).");
 *   } catch (error) {
 *     console.error("Failed to write file (sync):", error);
 *   }
 * };
 *
 * writeMyFileSync();
 * ```
 */

const writeFileSync = (path: URL | string, content: ArrayBuffer | ArrayBufferView | string, options?: WriteFileOptions): void => {
    // eslint-disable-next-line no-param-reassign
    options = {
        backup: false,
        encoding: "utf8",
        flag: "w",
        overwrite: true,
        recursive: true,
        ...options,
    };

    assertValidFileOrDirectoryPath(path);
    assertValidFileContents(content);

    // eslint-disable-next-line no-param-reassign
    path = toPath(path);

    const pathExists = isAccessibleSync(path, F_OK);

    const flag = options.flag ?? "w";
    const append = flag.includes("a");
    const exclusive = flag.includes("x");

    if (pathExists && (!options.overwrite || exclusive)) {
        throw new AlreadyExistsError(`file already exists, open '${path}'`);
    }

    // Use an unpredictable temp path so concurrent writers don't collide and a
    // pre-created symlink at a predictable path can't be written through.
    const temporary = temporaryPath(path);

    try {
        if (!pathExists && options.recursive) {
            // `mkdir` with `recursive: true` is idempotent — no error if the
            // directory already exists — so a pre-flight access check is redundant.
            mkdirSync(dirname(path), { recursive: true });
        }

        let stat: Stats | undefined;

        let data: Buffer | Uint8Array = typeof content === "string" ? Buffer.from(content, options.encoding ?? "utf8") : toUint8Array(content);

        // Honour append flags by prepending the existing bytes so the temp-file
        // rename still yields the concatenated result atomically.
        if (append && pathExists) {
            data = Buffer.concat([readFileSync(path), data]);
        }

        // `wx` (O_CREAT | O_EXCL) refuses to follow or open an existing path,
        // so the temp file is always freshly created by this process.
        nodeWriteFileSync(temporary, data, { flag: "wx" });

        if (pathExists && options.backup) {
            stat = statSync(path);

            // eslint-disable-next-line no-param-reassign
            options.chown ??= { gid: stat.gid, uid: stat.uid };

            renameSync(path, `${path}.bak`);
        }

        if (options.chown) {
            try {
                chownSync(temporary, options.chown.uid, options.chown.gid);
            } catch {
                // On linux permissionless filesystems like exfat and fat32 the entire filesystem is normally owned by root,
                // and trying to chown it causes as permissions error.
            }
        }

        // Only adjust permissions when an explicit mode was requested or a backup
        // preserved the original file's mode. Otherwise the temp file keeps the
        // umask-filtered default from its `wx` creation, matching `fs.writeFileSync`
        // instead of chmod-ing to a world-writable `0o666`.
        const mode = stat && options.mode === undefined ? stat.mode : options.mode;

        if (mode !== undefined) {
            chmodSync(temporary, mode);
        }

        renameSync(temporary, path);
    } catch (error: unknown) {
        throw new Error(`Failed to write file at: ${path} - ${(error as Error).message}`, { cause: error });
    } finally {
        if (isAccessibleSync(temporary)) {
            unlinkSync(temporary);
        }
    }
};

export default writeFileSync;
