import type { Stats } from "node:fs";
import { chmod, chown, mkdir, rename, stat as nodeStat, unlink, writeFile as nodeWriteFile } from "node:fs/promises";

import { dirname } from "@visulima/path";
import { toPath } from "@visulima/path/utils";

import { F_OK } from "../constants";
import isAccessible from "../is-accessible";
import type { WriteFileOptions } from "../types";
import assertValidFileContents from "../utils/assert-valid-file-contents";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
import toUint8Array from "../utils/to-uint-8-array";

// eslint-disable-next-line sonarjs/cognitive-complexity
const writeFile = async (path: URL | string, content: ArrayBuffer | ArrayBufferView | string, options?: WriteFileOptions): Promise<void> => {
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

    try {
        const pathExists = await isAccessible(path, F_OK);

        if (!pathExists && options.recursive) {
            const directory = dirname(path);

            if (!(await isAccessible(directory, F_OK))) {
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                await mkdir(directory, { recursive: true });
            }
        }

        let stat: Stats | undefined;

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await nodeWriteFile(`${path}.tmp`, toUint8Array(content), { encoding: options.encoding, flag: options.flag });

        if (pathExists && !options.overwrite) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            stat = await nodeStat(path);

            if (options.chown === undefined) {
                // eslint-disable-next-line no-param-reassign
                options.chown = { gid: stat.gid, uid: stat.uid };
            }

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            await rename(path, `${path}.bak`);
        }

        const temporaryPath = `${path}.tmp`;

        if (options.chown) {
            try {
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                await chown(temporaryPath, options.chown.uid, options.chown.gid);
            } catch {
                // On linux permissionless filesystems like exfat and fat32 the entire filesystem is normally owned by root,
                // and trying to chown it causes as permissions error.
            }
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await chmod(temporaryPath, stat && !options.mode ? stat.mode : options.mode ?? 0o666);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await rename(temporaryPath, path);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(`Failed to write file at: ${path} - ${error.message}`, { cause: error });
    } finally {
        if (await isAccessible(`${path}.tmp`)) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            await unlink(`${path}.tmp`);
        }
    }
};

export default writeFile;
