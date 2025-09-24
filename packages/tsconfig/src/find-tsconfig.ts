import { findUp, findUpSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";

import type { Options as ReadTsConfigOptions } from "./read-tsconfig";
import { readTsConfig } from "./read-tsconfig";
import type { TsConfigJsonResolved } from "./types";

const TsConfigFileCache = new Map<string, TsConfigResult>();

export type Options = ReadTsConfigOptions & {
    cache?: Map<string, TsConfigJsonResolved> | boolean;
    configFileName?: string;
};

export type TsConfigResult = {
    config: TsConfigJsonResolved;
    path: string;
};

/**
 * An asynchronous function that retrieves the TSConfig by searching for the "tsconfig.json" first,
 * second attempt is to look for the "jsconfig.json" file from a given current working directory.
 * @param cwd Optional. The current working directory from which to search for the "tsconfig.json" file.
 * The type of `cwd` is `string`.
 * @returns A `Promise` that resolves to the TSConfig result object.
 * The return type of the function is `Promise&lt;TsConfigResult>`.
 * @throws An `Error` when the "tsconfig.json" file is not found.
 */
export const findTsConfig = async (cwd?: URL | string, options: Options = {}): Promise<TsConfigResult> => {
    const configFileName = options.configFileName ?? "tsconfig.json";

    let filePath = await findUp(configFileName, {
        ...cwd && { cwd },
        type: "file",
    });

    if (!filePath) {
        filePath = await findUp("jsconfig.json", {
            ...cwd && { cwd },
            type: "file",
        });
    }

    if (!filePath) {
        throw new NotFoundError(`No such file or directory, for '${configFileName}' or 'jsconfig.json' found.`);
    }

    const cache = options.cache && typeof options.cache !== "boolean" ? options.cache : TsConfigFileCache;

    if (options.cache && cache.has(filePath)) {
        return cache.get(filePath) as TsConfigResult;
    }

    const output = {
        config: readTsConfig(filePath, {
            tscCompatible: options.tscCompatible,
        }),
        path: filePath,
    };

    if (options.cache) {
        cache.set(filePath, output);
    }

    return output;
};

export const findTsConfigSync = (cwd?: URL | string, options: Options = {}): TsConfigResult => {
    const configFileName = options.configFileName ?? "tsconfig.json";

    let filePath = findUpSync(configFileName, {
        ...cwd && { cwd },
        type: "file",
    });

    if (!filePath) {
        filePath = findUpSync("jsconfig.json", {
            ...cwd && { cwd },
            type: "file",
        });
    }

    if (!filePath) {
        throw new NotFoundError(`No such file or directory, for '${configFileName}' or 'jsconfig.json' found.`);
    }

    const cache = options.cache && typeof options.cache !== "boolean" ? options.cache : TsConfigFileCache;

    if (options.cache && cache.has(filePath)) {
        return cache.get(filePath) as TsConfigResult;
    }

    const output = {
        config: readTsConfig(filePath, {
            tscCompatible: options.tscCompatible,
        }),
        path: filePath,
    };

    if (options.cache) {
        cache.set(filePath, output);
    }

    return output;
};
