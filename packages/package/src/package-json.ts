import { existsSync } from "node:fs";
import { join } from "node:path";

import type { WriteJsonOptions } from "@visulima/fs";
import { findUp, findUpSync, readJson, readJsonSync, writeJson, writeJsonSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { parseJson, toPath } from "@visulima/fs/utils";
import type { Input } from "normalize-package-data";
import normalizeData from "normalize-package-data";
import type { JsonObject } from "type-fest";

import type { NormalizedPackageJson, PackageJson } from "./types";

export type NormalizedReadResult = {
    packageJson: NormalizedPackageJson;
    path: string;
};

/**
 * An asynchronous function to find the package.json file in the specified directory or its parent directories.
 *
 * @param cwd - The current working directory.
 * @returns A `Promise` that resolves to an object containing the parsed package.json data and the file path.
 * The type of the returned promise is `Promise<NormalizedReadResult>`.
 * @throws An `Error` if the package.json file cannot be found.
 */
export const findPackageJson = async (cwd?: URL | string): Promise<NormalizedReadResult> => {
    const filePath = await findUp("package.json", {
        ...(cwd && { cwd }),
        type: "file",
    });

    if (!filePath) {
        throw new NotFoundError("Could not find package.json");
    }

    const packageJson = await readJson(filePath);

    normalizeData(packageJson as Input);

    return {
         
        packageJson: packageJson as NormalizedPackageJson,
        path: filePath,
    };
};

export const findPackageJsonSync = (cwd?: URL | string): NormalizedReadResult => {
    const filePath = findUpSync("package.json", {
        ...(cwd && { cwd }),
        type: "file",
    });

    if (!filePath) {
        throw new NotFoundError("Could not find package.json");
    }

    const packageJson = readJsonSync(filePath);

    normalizeData(packageJson as Input);

    return {
         
        packageJson: packageJson as NormalizedPackageJson,
        path: filePath,
    };
};

/**
 * An asynchronous function to write the package.json file with the given data.
 *
 * @param data - The package.json data to write. The data is an intersection type of `PackageJson` and a record where keys are `string` and values can be any type.
 * @param options - Optional. The options for writing the package.json. If not provided, an empty object will be used `{}`.
 *                 This is an intersection type of `WriteJsonOptions` and a record with an optional `cwd` key which type is `Options["cwd"]`.
 *                 `cwd` represents the current working directory. If not specified, the default working directory will be used.
 * @returns A `Promise` that resolves once the package.json file has been written. The type of the returned promise is `Promise<void>`.
 */
 
export const writePackageJson = async <T = PackageJson>(data: T, options: WriteJsonOptions & { cwd?: URL | string } = {}): Promise<void> => {
     
    const { cwd, ...writeOptions } = options;
    const directory = toPath(options.cwd ?? process.cwd());

    await writeJson(join(directory, "package.json"), data, writeOptions);
};

 
export const writePackageJsonSync = <T = PackageJson>(data: T, options: WriteJsonOptions & { cwd?: URL | string } = {}): void => {
     
    const { cwd, ...writeOptions } = options;
    const directory = toPath(options.cwd ?? process.cwd());

    writeJsonSync(join(directory, "package.json"), data, writeOptions);
};

export const parsePackageJson = (packageFile: JsonObject | string): NormalizedPackageJson => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const isObject = packageFile !== null && typeof packageFile === "object" && !Array.isArray(packageFile);
    const isString = typeof packageFile === "string";

    if (!isObject && !isString) {
        throw new TypeError("`packageFile` should be either an `object` or a `string`.");
    }

    const json = isObject
        ? structuredClone(packageFile)
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        : existsSync(packageFile as string)
          ? readJsonSync(packageFile as string)
          : parseJson(packageFile as string);

    normalizeData(json as Input);

    return json as NormalizedPackageJson;
};
