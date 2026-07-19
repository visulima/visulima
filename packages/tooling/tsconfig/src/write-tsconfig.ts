import type { WriteJsonOptions } from "@visulima/fs";
import { writeJson, writeJsonSync } from "@visulima/fs";
import { toPath } from "@visulima/fs/utils";
import { join } from "@visulima/path";
import type { TsConfigJson } from "type-fest";

import { normalizeCompilerOptionsForWrite } from "./utils/normalize-compiler-options-for-write";

export interface WriteTsConfigOptions extends WriteJsonOptions {
    /** The directory to write the config into. Defaults to `process.cwd()`. */
    cwd?: URL | string;

    /**
     * The file name to write. Defaults to `tsconfig.json`. Useful when emitting a derived project
     * file (e.g. `tsconfig.build.json`) next to an existing config.
     */
    fileName?: string;

    /**
     * The TypeScript major version the written config targets. When set, compiler options removed in
     * that version are dropped — e.g. `7` removes `baseUrl` so the config is accepted by the
     * TypeScript 7 native compiler.
     */
    typescriptMajor?: number;
}

/**
 * Serialize a resolved `TsConfigJson` into a config the tsconfig parser accepts: numeric enum values
 * (`target: 99`) are rewritten to their string names (`"esnext"`), and — when `typescriptMajor` is set —
 * options removed in that TypeScript version are dropped. The input object is not mutated.
 */
const prepareTsConfig = (tsConfig: TsConfigJson, typescriptMajor: number | undefined): TsConfigJson => {
    if (!tsConfig.compilerOptions) {
        return tsConfig;
    }

    return {
        ...tsConfig,
        compilerOptions: normalizeCompilerOptionsForWrite(tsConfig.compilerOptions, { removedForMajor: typescriptMajor }),
    };
};

/**
 * An asynchronous function that writes the provided TypeScript configuration object to a tsconfig file.
 *
 * Numeric enum compiler options are normalized to their string names, so a resolved `CompilerOptions`
 * object (e.g. from `readTsConfig`) can be written back to a valid config.
 * @param tsConfig The TypeScript configuration object to write. The type of `tsConfig` is `TsConfigJson`.
 * @param options Optional. Write options plus the target directory (`cwd`), `fileName`, and `typescriptMajor`.
 * @returns A `Promise` that resolves when the tsconfig file has been written.
 * The return type of function is `Promise&lt;void>`.
 */
export const writeTsConfig = async (tsConfig: TsConfigJson, options: WriteTsConfigOptions = {}): Promise<void> => {
    const { cwd, fileName = "tsconfig.json", typescriptMajor, ...writeOptions } = options;

    const directory = toPath(cwd ?? process.cwd());

    await writeJson(join(directory, fileName), prepareTsConfig(tsConfig, typescriptMajor), writeOptions);
};

/**
 * A function that writes the provided TypeScript configuration object to a tsconfig file.
 *
 * Numeric enum compiler options are normalized to their string names, so a resolved `CompilerOptions`
 * object (e.g. from `readTsConfig`) can be written back to a valid config.
 * @param tsConfig The TypeScript configuration object to write. The type of `tsConfig` is `TsConfigJson`.
 * @param options Optional. Write options plus the target directory (`cwd`), `fileName`, and `typescriptMajor`.
 * @returns Nothing.
 */
export const writeTsConfigSync = (tsConfig: TsConfigJson, options: WriteTsConfigOptions = {}): void => {
    const { cwd, fileName = "tsconfig.json", typescriptMajor, ...writeOptions } = options;

    const directory = toPath(cwd ?? process.cwd());

    writeJsonSync(join(directory, fileName), prepareTsConfig(tsConfig, typescriptMajor), writeOptions);
};
