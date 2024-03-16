import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import toPath from "./utils/to-path";
import assertValidFileOrDirectoryPath from "./utils/assert-valid-file-or-directory-path";
import type { EmptyDirOptions } from "./types";

/**
 * Ensures that a directory is empty.
 * Deletes directory contents if the directory is not empty.
 * If the directory does not exist, it is created.
 * The directory itself is not deleted.
 */
export function emptyDir(dir: string | URL, options?: EmptyDirOptions): void {
    assertValidFileOrDirectoryPath(dir);

    if (!existsSync(dir)) {
        // if not exist. then create it
        mkdirSync(dir, { recursive: true });

        return;
    }

    for (const item of readdirSync(dir)) {
        rmSync(join(toPath(dir), item), { ...options, recursive: true });
    }
}
