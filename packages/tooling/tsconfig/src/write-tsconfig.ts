import type { WriteJsonOptions } from "@visulima/fs";
import { writeJson, writeJsonSync } from "@visulima/fs";
import { toPath } from "@visulima/fs/utils";
import { join } from "@visulima/path";
import type { TsConfigJson } from "type-fest";

/**
 * An asynchronous function that writes the provided TypeScript configuration object to a tsconfig.json file.
 * @param tsConfig The TypeScript configuration object to write. The type of `tsConfig` is `TsConfigJson`.
 * @param options Optional. The write options and the current working directory. The type of `options` is an
 * intersection type of `WriteOptions` and a Record type with an optional `cwd` key of type `string`.
 * @returns A `Promise` that resolves when the tsconfig.json file has been written.
 * The return type of function is `Promise&lt;void>`.
 */

export const writeTsConfig = async (tsConfig: TsConfigJson, options: WriteJsonOptions & { cwd?: URL | string } = {}): Promise<void> => {
    const { cwd, ...writeOptions } = options;

    const directory = toPath(cwd ?? process.cwd());

    await writeJson(join(directory, "tsconfig.json"), tsConfig, writeOptions);
};

/**
 * A function that writes the provided TypeScript configuration object to a tsconfig.json file.
 * @param tsConfig The TypeScript configuration object to write. The type of `tsConfig` is `TsConfigJson`.
 * @param options Optional. The write options and the current working directory. The type of `options` is an
 * intersection type of `WriteOptions` and a Record type with an optional `cwd` key of type `string`.
 * @returns A `Promise` that resolves when the tsconfig.json file has been written.
 * The return type of function is `Promise&lt;void>`.
 */

export const writeTsConfigSync = (tsConfig: TsConfigJson, options: WriteJsonOptions & { cwd?: URL | string } = {}): void => {
    const { cwd, ...writeOptions } = options;

    const directory = toPath(cwd ?? process.cwd());

    writeJsonSync(join(directory, "tsconfig.json"), tsConfig, writeOptions);
};
