import type { Stats } from "node:fs";
import { chmodSync, chownSync, mkdirSync, renameSync, statSync, unlinkSync, writeFileSync as nodeWriteFileSync } from "node:fs";

import { dirname } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import { F_OK } from "../constants";
import isAccessibleSync from "../is-accessible-sync";
import type { WriteFileOptions } from "../types";
import assertValidFileContents from "../utils/assert-valid-file-contents";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
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
        encoding: "utf8",
        flag: "w",
        overwrite: true,
        recursive: true,
        ...options,
    };

    assertValidFileOrDirectoryPath(path);
    assertValidFileContents(content);

    // eslint-disable-next-line no-param-reassign
    path = toPath(path) as string;

    const temporaryPath = `${path}.tmp`;

    try {
        const pathExists = isAccessibleSync(path, F_OK);

        if (!pathExists && options.recursive) {
            const directory = dirname(path);

            if (!isAccessibleSync(directory, F_OK)) {
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                mkdirSync(directory, { recursive: true });
            }
        }

        let stat: Stats | undefined;

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        nodeWriteFileSync(temporaryPath, toUint8Array(content), { encoding: options.encoding, flag: options.flag });

        if (pathExists && !options.overwrite) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            stat = statSync(path);

            if (options.chown === undefined) {
                // eslint-disable-next-line no-param-reassign
                options.chown = { gid: stat.gid, uid: stat.uid };
            }

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            renameSync(path, `${path}.bak`);
        }

        if (options.chown) {
            try {
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                chownSync(temporaryPath, options.chown.uid, options.chown.gid);
            } catch {
                // On linux permissionless filesystems like exfat and fat32 the entire filesystem is normally owned by root,
                // and trying to chown it causes as permissions error.
            }
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        chmodSync(temporaryPath, stat && !options.mode ? stat.mode : options.mode ?? 0o666);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        renameSync(temporaryPath, path);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        throw new Error(`Failed to write file at: ${path} - ${error.message}`, { cause: error });
    } finally {
        if (isAccessibleSync(temporaryPath)) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            unlinkSync(`${path}.tmp`);
        }
    }
};

export default writeFileSync;
