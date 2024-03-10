import type { Stats } from "node:fs";
import { chmod, mkdir, rename, stat as nodeStat, writeFile as nodeWriteFile } from "node:fs/promises";
import { dirname } from "node:path";

import { F_OK } from "./constants";
import isAccessible from "./is-accessible";
import assertValidFileContents from "./utils/assert-valid-file-contents";
import assertValidFileOrDirectoryPath from "./utils/assert-valid-file-or-directory-path";
import toPath from "./utils/to-path";
import toUint8Array from "./utils/to-uint-8-array";
import type { WriteFileOptions } from "./types";

const writeFile = async (path: URL | string, content: ArrayBuffer | ArrayBufferView | string, options: WriteFileOptions): Promise<void> => {
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
    path = toPath(path);

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

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            await rename(path, `${path}.bak`);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await rename(`${path}.tmp`, path);

        if (stat) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            await chmod(path, stat.mode);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(`Failed to write file at: ${path} - ${error.message}`, { cause: error });
    }
};

export default writeFile;
