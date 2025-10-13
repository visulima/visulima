import { copyFileSync, mkdirSync, renameSync, unlinkSync } from "node:fs";

import { dirname, resolve } from "@visulima/path";

import isAccessibleSync from "../../is-accessible-sync";
import type { InternalOptions } from "../types";
import validateSameDirectory from "./validate-same-directory";

const internalMoveFileSync = (sourcePath: string, destinationPath: string, { cwd, directoryMode, overwrite, validateDirectory }: InternalOptions): void => {
    if (cwd) {
        // eslint-disable-next-line no-param-reassign
        sourcePath = resolve(cwd, sourcePath);
        // eslint-disable-next-line no-param-reassign
        destinationPath = resolve(cwd, destinationPath);
    }

    if (validateDirectory) {
        validateSameDirectory(sourcePath, destinationPath);
    }

    if (!overwrite && isAccessibleSync(destinationPath)) {
        throw new Error(`The destination file exists: ${destinationPath}`);
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    mkdirSync(dirname(destinationPath), {
        mode: directoryMode,
        recursive: true,
    });

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        renameSync(sourcePath, destinationPath);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.code === "EXDEV") {
            copyFileSync(sourcePath, destinationPath);
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            unlinkSync(sourcePath);
        } else {
            throw error;
        }
    }
};

export default internalMoveFileSync;
