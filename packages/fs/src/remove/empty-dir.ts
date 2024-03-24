// eslint-disable-next-line unicorn/prevent-abbreviations
import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";

import { join } from "pathe";

// eslint-disable-next-line unicorn/prevent-abbreviations
import type { EmptyDirOptions } from "../types";
import assertValidFileOrDirectoryPath from "../utils/assert-valid-file-or-directory-path";
import toPath from "../utils/to-path";

/**
 * Ensures that a directory is empty.
 * Deletes directory contents if the directory is not empty.
 * If the directory does not exist, it is created.
 * The directory itself is not deleted.
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
const emptyDir = async (dir: URL | string, options?: EmptyDirOptions): Promise<void> => {
    assertValidFileOrDirectoryPath(dir);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(dir)) {
        // if not exist. then create it
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await mkdir(dir, { recursive: true });

        return;
    }

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,security/detect-non-literal-fs-filename
    for await (const item of await readdir(dir)) {
        await rm(join(toPath(dir), item), { ...options, force: true, recursive: true });
    }
};

export default emptyDir;
