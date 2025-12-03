/**
 * Modified functions from https://github.com/sindresorhus/move-file
 *
 * The original functions are licensed under the MIT License:
 *
 * MIT License
 *
 * Copyright (c) Sindre Sorhus &lt;sindresorhus@gmail.com> (https://sindresorhus.com)
 */

import { cwd as baseCwd } from "node:process";

import { toPath } from "@visulima/path/utils";

import type { InternalOptions, Options } from "./types";
import internalMoveFile from "./utils/internal-move-file";
import internalMoveFileSync from "./utils/internal-move-file-sync";

/**
 * Move a file asynchronously.
 * @param sourcePath The file you want to move.
 * @param destinationPath Where you want the file moved.
 * @param options Configuration options.
 * @returns A `Promise` that resolves when the file has been moved.
 * @example
 * ```
 * import { move } from '@visulima/fs';
 *
 * await move('source/test.png', 'destination/test.png');
 * console.log('The file has been moved');
 * ```
 */
export const move = async (sourcePath: string, destinationPath: string, options: Options = {}): Promise<void> => {
    const internalOptions: InternalOptions = {
        overwrite: true,
        validateDirectory: false,
        ...options,
        cwd: options.cwd ? toPath(options.cwd) : baseCwd(),
    };

    await internalMoveFile(sourcePath, destinationPath, internalOptions);
};

/**
 * Move a file synchronously.
 * @param sourcePath The file you want to move.
 * @param destinationPath Where you want the file moved.
 * @param options Configuration options.
 * @example
 * ```
 * import { moveSync } from '@visulima/fs';
 *
 * moveSync('source/test.png', 'destination/test.png');
 * console.log('The file has been moved');
 * ```
 */
export const moveSync = (sourcePath: string, destinationPath: string, options?: Options): void => {
    const internalOptions = { overwrite: true, validateDirectory: false, ...options };

    internalOptions.cwd = internalOptions.cwd ? toPath(internalOptions.cwd) : baseCwd();

    internalMoveFileSync(sourcePath, destinationPath, internalOptions as InternalOptions);
};

/**
 * Rename a file asynchronously.
 * @param source The file you want to rename.
 * @param destination The name of the renamed file.
 * @param options Configuration options.
 * @returns A `Promise` that resolves when the file has been renamed.
 * @example
 * ```
 * import { rename } from '@visulima/fs';
 *
 * await rename('test.png', 'tests.png', {cwd: 'source'});
 * console.log('The file has been renamed');
 * ```
 */
export const rename = async (source: string, destination: string, options?: Options): Promise<void> => {
    const internalOptions = { overwrite: true, ...options, validateDirectory: true };

    internalOptions.cwd = internalOptions.cwd ? toPath(internalOptions.cwd) : baseCwd();

    await internalMoveFile(source, destination, internalOptions as InternalOptions);
};

/**
 * Rename a file synchronously.
 * @param source The file you want to rename.
 * @param destination The name of the renamed file.
 * @param options Configuration options.
 * @example
 * ```
 * import { renameSync } from '@visulima/fs';
 *
 * renameSync('test.png', 'tests.png', {cwd: 'source'});
 * console.log('The file has been renamed');
 * ```
 */
export const renameSync = (source: string, destination: string, options?: Options): void => {
    const internalOptions = { overwrite: true, ...options, validateDirectory: true };

    internalOptions.cwd = internalOptions.cwd ? toPath(internalOptions.cwd) : baseCwd();

    internalMoveFileSync(source, destination, internalOptions as InternalOptions);
};
