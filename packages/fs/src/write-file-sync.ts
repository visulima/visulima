import type { Stats } from "node:fs";
import { chmodSync, mkdirSync, renameSync, statSync, writeFileSync as nodeWriteFileSync } from "node:fs";
import { dirname } from "node:path";

import { F_OK } from "./constants";
import isAccessibleSync from "./is-accessible-sync";
import type { WriteFileOptions } from "./types";
import assertValidFileContents from "./utils/assert-valid-file-contents";
import assertValidFileOrDirectoryPath from "./utils/assert-valid-file-or-directory-path";
import toPath from "./utils/to-path";
import toUint8Array from "./utils/to-uint-8-array";

const writeFileSync = (path: URL | string, content: ArrayBuffer | ArrayBufferView | string, options: WriteFileOptions): void => {
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
        nodeWriteFileSync(`${path}.tmp`, toUint8Array(content), { encoding: options.encoding, flag: options.flag });

        if (pathExists && !options.overwrite) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            stat = statSync(path);

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            renameSync(path, `${path}.bak`);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        renameSync(`${path}.tmp`, path);

        if (stat) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            chmodSync(path, stat.mode);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(`Failed to write file at: ${path} - ${error.message}`, { cause: error });
    }
};

export default writeFileSync;
