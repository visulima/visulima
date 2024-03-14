import { join } from "node:path";

import type { WriteJsonOptions } from "@visulima/fs";
import { writeJson } from "@visulima/fs";
import type { TsConfigJson, TsConfigResult } from "get-tsconfig";
import { getTsconfig } from "get-tsconfig";

import toPath from "./utils/to-path";

/**
 * An asynchronous function that retrieves the TSConfig by searching for the "tsconfig.json" first,
 * second attempt is to look for the "jsconfig.json" file from a given current working directory.
 *
 * @param cwd - Optional. The current working directory from which to search for the "tsconfig.json" file.
 *              The type of `cwd` is `string`.
 * @returns A `Promise` that resolves to the TSConfig result object.
 *          The return type of the function is `Promise<TsConfigResult>`.
 * @throws An `Error` when the "tsconfig.json" file is not found.
 */
export const findTSConfig = async (cwd?: URL | string): Promise<TsConfigResult> => {
    const searchPath = cwd === undefined ? undefined : toPath(cwd);

    // wrong typing in get-tsconfig
    // eslint-disable-next-line @typescript-eslint/await-thenable
    let config = await getTsconfig(searchPath, "tsconfig.json");

    if (config === null) {
        // eslint-disable-next-line @typescript-eslint/await-thenable
        config = await getTsconfig(searchPath, "jsconfig.json");
    }

    if (config === null) {
        throw new Error("Could not find a tsconfig.json or jsconfig.json file.");
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
export const writeTSConfig = async (data: TsConfigJson, options: WriteJsonOptions & { cwd?: URL | string } = {}): Promise<void> => {
    const { cwd, ...writeOptions } = options;
    const directory = toPath(options.cwd ?? process.cwd());

    await writeJson(join(directory, "tsconfig.json"), data, writeOptions);
};

export type { TsConfigJson, TsConfigJsonResolved, TsConfigResult } from "get-tsconfig";
