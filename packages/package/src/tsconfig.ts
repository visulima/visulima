import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import type { TsConfigJson, TsConfigResult } from "get-tsconfig";
import { getTsconfig } from "get-tsconfig";

import toPath from "./utils/to-path";
import type { WriteOptions } from "./utils/write-json";
import { writeJsonFile } from "./utils/write-json";

/**
 * An asynchronous function that retrieves the TSConfig by searching for the "tsconfig.json" file from a given
 * current working directory.
 *
 * @param cwd - Optional. The current working directory from which to search for the "tsconfig.json" file.
 *              The type of `cwd` is `string`.
 * @returns A `Promise` that resolves to the TSConfig result object.
 *          The return type of the function is `Promise<TsConfigResult>`.
 * @throws An `Error` when the "tsconfig.json" file is not found.
 */
export const findTSConfig = async (cwd?: URL | string): Promise<TsConfigResult> => {
    // wrong typing in get-tsconfig
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const config = await getTsconfig(cwd === undefined ? undefined : toPath(cwd), "tsconfig.json");

    if (config === null) {
        throw new Error("Could not find tsconfig.json");
    }

    return config;
};

/**
 * An asynchronous function that writes the provided TypeScript configuration object to a tsconfig.json file.
 *
 * @param tsConfig - The TypeScript configuration object to write. The type of `tsConfig` is `TsConfigJson`.
 * @param options - Optional. The write options and the current working directory. The type of `options` is an
 * intersection type of `WriteOptions` and a Record type with an optional `cwd` key of type `string`.
 * @returns A `Promise` that resolves when the tsconfig.json file has been written.
 * The return type of function is `Promise<void>`.
 */
export const writeTSConfig = async (tsConfig: TsConfigJson, options: WriteOptions & { cwd?: URL | string } = {}): Promise<void> => {
    const directory = toPath(options.cwd ?? process.cwd());
    const path = join(directory, "tsconfig.json");

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await mkdir(directory, { recursive: true });

    await writeJsonFile(path, tsConfig, options);
};

export type { TsConfigJson, TsConfigJsonResolved } from "get-tsconfig";
