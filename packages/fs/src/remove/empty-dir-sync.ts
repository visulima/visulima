// eslint-disable-next-line unicorn/prevent-abbreviations
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

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
const emptyDir = (dir: URL | string, options?: EmptyDirOptions): void => {
    assertValidFileOrDirectoryPath(dir);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(dir)) {
        // if not exist. then create it
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        mkdirSync(dir, { recursive: true });

        return;
    }

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,security/detect-non-literal-fs-filename
    for (const item of readdirSync(dir)) {
        rmSync(join(toPath(dir), item), { ...options, force: true, recursive: true });
    }
}

export default emptyDir;
