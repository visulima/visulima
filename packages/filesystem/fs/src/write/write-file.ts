import type { Stats } from "node:fs";
import { chmod, chown, mkdir, readFile, rename, stat as nodeStat, unlink, writeFile as nodeWriteFile } from "node:fs/promises";

import { dirname } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import { F_OK } from "../constants";
import AlreadyExistsError from "../error/already-exists-error";
import isAccessible from "../is-accessible";
import type { WriteFileOptions } from "../types";
import assertValidFileContents from "../utils/assert-valid-file-contents";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
import temporaryPath from "./utils/temporary-path";
import toUint8Array from "./utils/to-uint-8-array";

/**
 * Asynchronously writes data to a file, replacing the file if it already exists.
 * This function includes safeguards like writing to a temporary file first and then renaming, and handling permissions.
 * @param path The path to the file to write. Can be a file URL or a string path.
 * @param content The data to write. Can be a string, Buffer, ArrayBuffer, or ArrayBufferView.
 * @param options Optional configuration for writing the file. See {@link WriteFileOptions}.
 * @returns A promise that resolves when the file has been written.
 * @example
 * ```javascript
 * import { writeFile } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const writeMyFile = async () => {
 *   try {
 *     await writeFile(join("/tmp", "my-new-file.txt"), "Hello World!");
 *     console.log("File written successfully.");
 *
 *     await writeFile(join("/tmp", "another-file.txt"), "Some other content", { encoding: 'utf16le', mode: 0o600 });
 *     console.log("Another file written with specific options.");
 *   } catch (error) {
 *     console.error("Failed to write file:", error);
 *   }
 * };
 *
 * writeMyFile();
 * ```
 */

// eslint-disable-next-line sonarjs/cognitive-complexity
const writeFile = async (path: URL | string, content: ArrayBuffer | ArrayBufferView | string, options?: WriteFileOptions): Promise<void> => {
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

    const pathExists = await isAccessible(path, F_OK);

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
            await mkdir(dirname(path), { recursive: true });
        }

        let stat: Stats | undefined;

        let data: Buffer | Uint8Array = typeof content === "string" ? Buffer.from(content, options.encoding ?? "utf8") : toUint8Array(content);

        // Honour append flags by prepending the existing bytes so the temp-file
        // rename still yields the concatenated result atomically.
        if (append && pathExists) {
            data = Buffer.concat([await readFile(path), data]);
        }

        // `wx` (O_CREAT | O_EXCL) refuses to follow or open an existing path,
        // so the temp file is always freshly created by this process.
        await nodeWriteFile(temporary, data, { flag: "wx" });

        if (pathExists && options.backup) {
            stat = await nodeStat(path);

            // eslint-disable-next-line no-param-reassign
            options.chown ??= { gid: stat.gid, uid: stat.uid };

            await rename(path, `${path}.bak`);
        }

        if (options.chown) {
            try {
                await chown(temporary, options.chown.uid, options.chown.gid);
            } catch {
                // On linux permissionless filesystems like exfat and fat32 the entire filesystem is normally owned by root,
                // and trying to chown it causes as permissions error.
            }
        }

        // Only adjust permissions when an explicit mode was requested or a backup
        // preserved the original file's mode. Otherwise the temp file keeps the
        // umask-filtered default from its `wx` creation, matching `fs.writeFile`
        // instead of chmod-ing to a world-writable `0o666`.
        const mode = stat && options.mode === undefined ? stat.mode : options.mode;

        if (mode !== undefined) {
            await chmod(temporary, mode);
        }

        await rename(temporary, path);
    } catch (error: unknown) {
        throw new Error(`Failed to write file at: ${path} - ${(error as Error).message}`, { cause: error });
    } finally {
        if (await isAccessible(temporary)) {
            await unlink(temporary);
        }
    }
};

export default writeFile;
