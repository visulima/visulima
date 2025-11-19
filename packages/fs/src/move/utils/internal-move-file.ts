import { copyFile, mkdir, rename, unlink } from "node:fs/promises";

import { dirname, resolve } from "@visulima/path";

import isAccessible from "../../is-accessible";
import type { InternalOptions } from "../types";
import validateSameDirectory from "./validate-same-directory";

const internalMoveFile = async (
    sourcePath: string,
    destinationPath: string,
    { cwd, directoryMode, overwrite, validateDirectory }: InternalOptions,
): Promise<void> => {
    if (cwd) {
        // eslint-disable-next-line no-param-reassign
        sourcePath = resolve(cwd, sourcePath);
        // eslint-disable-next-line no-param-reassign
        destinationPath = resolve(cwd, destinationPath);
    }

    if (validateDirectory) {
        validateSameDirectory(sourcePath, destinationPath);
    }

    if (!overwrite && await isAccessible(destinationPath)) {
        throw new Error(`The destination file exists: ${destinationPath}`);
    }

    await mkdir(dirname(destinationPath), {
        mode: directoryMode,
        recursive: true,
    });

    try {
        await rename(sourcePath, destinationPath);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.code === "EXDEV") {
            await copyFile(sourcePath, destinationPath);

            await unlink(sourcePath);
        } else {
            throw error;
        }
    }
};

export default internalMoveFile;
