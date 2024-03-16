import { mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
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
export async function emptyDir(dir: string | URL, options?: EmptyDirOptions): Promise<void> {
    assertValidFileOrDirectoryPath(dir);

    if (!existsSync(dir)) {
        // if not exist. then create it
        await mkdir(dir, { recursive: true });

        return;
    }

    for await (const item of await readdir(dir)) {
        await rm(join(toPath(dir), item), { ...options, recursive: true });
    }
}
