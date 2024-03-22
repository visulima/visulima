import { cwd } from "node:process";

import { ensureDirSync, isAccessible, isAccessibleSync, W_OK } from "@visulima/fs";
import { join } from "pathe";

import { findPackageRoot, findPackageRootSync } from "./package";

type Options = {
    create?: boolean;
    cwd?: URL | string;
};

const useDirectory = (directory: string, options: Options): string => {
    if (options.create) {
        ensureDirSync(directory);
    }

    return directory;
};

export const findCacheDirectory = async (name: string, options: Options): Promise<string | undefined> => {
    const rootDirectory = await findPackageRoot(options.cwd ?? cwd());

    if (!rootDirectory) {
        return undefined
    }

    const nodeModulesDirectory = join(rootDirectory, "node_modules");
    const cacheDirectory = join(nodeModulesDirectory, ".cache", name);
    const cacheNameDirectory = join(cacheDirectory, name);

    if (await isAccessible(cacheNameDirectory, W_OK) || await isAccessible(cacheDirectory, W_OK) || await isAccessible(nodeModulesDirectory, W_OK)) {
        return undefined;
    }

    return useDirectory(cacheNameDirectory, options);
};

export const findCacheDirectorySync = (name: string, options: Options): string | undefined => {
    const rootDirectory = findPackageRootSync(options.cwd ?? cwd());

    if (!rootDirectory) {
        return undefined
    }

    const nodeModulesDirectory = join(rootDirectory, "node_modules");
    const cacheDirectory = join(nodeModulesDirectory, ".cache", name);
    const cacheNameDirectory = join(cacheDirectory, name);

    if (isAccessibleSync(cacheNameDirectory, W_OK) || isAccessibleSync(cacheDirectory, W_OK) || isAccessibleSync(nodeModulesDirectory, W_OK)) {
        return undefined;
    }

    return useDirectory(cacheNameDirectory, options);
};
