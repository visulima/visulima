import { promises as fsp } from "node:fs";
import { dirname } from "node:path";

/**
 * Ensures that the file exists and returns it size
 * @param path - filename or path to a local file
 * @param overwrite - force creating new empty file
 * @returns file size
 */
export async function ensureFile(path: string, overwrite = false): Promise<number> {
    await fsp.mkdir(dirname(path), { recursive: true });

    const open = await fsp.open(path, overwrite ? "w" : "a");
    await open.close();

    const stat = await fsp.stat(path);

    return stat.size;
}

/**
 * Removes the specified file from the local file system
 */
export async function removeFile(path: string): Promise<void> {
    if (fsp.rm) {
        return fsp.rm(path, { force: true });
    }

    return fsp.unlink(path).catch((error: NodeJS.ErrnoException): void => {
        if (error.code !== "ENOENT")
throw error;
    });
}

/**
 * @internal
 */
export { promises as fsp } from "node:fs";
