import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { WriteJsonOptions } from "@visulima/fs";
import { findUp, writeJson } from "@visulima/fs";
import { toPath } from "@visulima/fs/utils";
import type { NormalizedPackageJson, PackageJson } from "read-pkg";
import { parsePackage } from "read-pkg";

export type { NormalizedPackageJson } from "read-pkg";

export type NormalizedReadResult = {
    packageJson: NormalizedPackageJson;
    path: string;
};

/**
 * An asynchronous function to find the package.json file in the specified directory or its parent directories.
 *
 * @param cwd - The current working directory. The type of `cwd` is part of an `Options` type, specifically `Options["cwd"]`.
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
        throw new Error("Could not find package.json");
    }

    return {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        packageJson: parsePackage(readFileSync(filePath, "utf8"), { normalize: true }),
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const writePackageJson = async (data: PackageJson & Record<string, any>, options: WriteJsonOptions & { cwd?: URL | string } = {}): Promise<void> => {
    const { cwd, ...writeOptions } = options;
    const directory = toPath(options.cwd ?? process.cwd());

    await writeJson(join(directory, "package.json"), data, writeOptions);
};

export { parsePackage as parsePackageJson } from "read-pkg";
