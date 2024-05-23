import type { WriteJsonOptions } from "@visulima/fs";
import { findUp, findUpSync, writeJson } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { toPath } from "@visulima/fs/utils";
import { join } from "@visulima/path";
import type { TsConfigJson } from "type-fest";

import { readTsConfig } from "./read-tsconfig";
import type { TsConfigJsonResolved } from "./types";

type Options = {
    cache?: Map<string, TsConfigJsonResolved> | boolean;
    configFileName?: string;
};

const TsConfigFileCache = new Map<string, TsConfigResult>();

export type TsConfigResult = {
    config: TsConfigJsonResolved;
    path: string;
};

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
export const findTsConfig = async (cwd?: URL | string, options: Options = {}): Promise<TsConfigResult> => {
    const configFileName = options.configFileName ?? "tsconfig.json";

    let filePath = await findUp(configFileName, {
        ...(cwd && { cwd }),
        type: "file",
    });

    if (!filePath) {
        filePath = await findUp("jsconfig.json", {
            ...(cwd && { cwd }),
            type: "file",
        });
    }

    if (!filePath) {
        throw new NotFoundError(`No such file or directory, for ${configFileName} or jsconfig.json found.`);
    }

    const cache = options.cache && typeof options.cache !== "boolean" ? options.cache : TsConfigFileCache;

    if (options.cache && cache.has(filePath)) {
        return cache.get(filePath) as TsConfigResult;
    }

    const output = {
        config: readTsConfig(filePath),
        path: filePath,
    };

    if (options.cache) {
        cache.set(filePath, output);
    }

    return output;
};

// @deprecate Please use `findTsConfig` instead.
export const findTSConfig = findTsConfig;

export const findTsConfigSync = (cwd?: URL | string, options: Options = {}): TsConfigResult => {
    const configFileName = options.configFileName ?? "tsconfig.json";

    let filePath = findUpSync(configFileName, {
        ...(cwd && { cwd }),
        type: "file",
    });

    if (!filePath) {
        filePath = findUpSync("jsconfig.json", {
            ...(cwd && { cwd }),
            type: "file",
        });
    }

    if (!filePath) {
        throw new NotFoundError(`No such file or directory, for ${configFileName} or jsconfig.json found.`);
    }

    const cache = options.cache && typeof options.cache !== "boolean" ? options.cache : TsConfigFileCache;

    if (options.cache && cache.has(filePath)) {
        return cache.get(filePath) as TsConfigResult;
    }

    const output = {
        config: readTsConfig(filePath),
        path: filePath,
    };

    if (options.cache) {
        cache.set(filePath, output);
    }

    return output;
};

// @deprecate Please use `findTsConfigSync` instead.
export const findTSConfigSync = findTsConfigSync;

/**
 * An asynchronous function that writes the provided TypeScript configuration object to a tsconfig.json file.
 *
 * @param tsConfig - The TypeScript configuration object to write. The type of `tsConfig` is `TsConfigJson`.
 * @param options - Optional. The write options and the current working directory. The type of `options` is an
 * intersection type of `WriteOptions` and a Record type with an optional `cwd` key of type `string`.
 * @returns A `Promise` that resolves when the tsconfig.json file has been written.
 * The return type of function is `Promise<void>`.
 */
export const writeTsConfig = async (data: TsConfigJson, options: WriteJsonOptions & { cwd?: URL | string } = {}): Promise<void> => {
    const { cwd, ...writeOptions } = options;

    const directory = toPath(options.cwd ?? process.cwd());

    await writeJson(join(directory, "tsconfig.json"), data, writeOptions);
};

// @deprecate Please use `writeTsconfig` instead.
export const writeTSConfig = writeTsConfig;
// eslint-disable-next-line import/no-unused-modules
export { implicitBaseUrlSymbol } from "./read-tsconfig";
