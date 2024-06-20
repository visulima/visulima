// eslint-disable-next-line unicorn/prevent-abbreviations
import { existsSync } from "node:fs";
import { cwd, env } from "node:process";

import { ensureDirSync, findUp, findUpSync, isAccessible, isAccessibleSync, W_OK } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { dirname, join } from "@visulima/path";

type Options = {
    create?: boolean;
    cwd?: URL | string;
    throwError?: boolean;
};

const useDirectory = (directory: string, options?: Options): string => {
    if (options?.create) {
        ensureDirSync(directory);
    }

    return directory;
};

const findCacheDirectory = async (name: string, options?: Options): Promise<string | undefined> => {
    if (env.CACHE_DIR && !["0", "1", "false", "true"].includes(env.CACHE_DIR)) {
        return useDirectory(join(env.CACHE_DIR, name), options);
    }

    const rootDirectory = await findUp("package.json", {
        cwd: options?.cwd ?? cwd(),
        type: "file",
    });

    if (!rootDirectory) {
        if (options?.throwError) {
            throw new NotFoundError("No such file or directory found.");
        }

        return undefined;
    }

    const nodeModulesDirectory = join(dirname(rootDirectory), "node_modules");
    const cacheDirectory = join(nodeModulesDirectory, ".cache");
    const cacheNameDirectory = join(cacheDirectory, name);

    // If node_modules/.cache/${name} exists: If it is writeable, return node_modules/.cache/${name}, otherwise return undefined
    // Otherwise, if node_modules/.cache exists: If it is writeable, return node_modules/.cache/${name}, otherwise return undefined
    // Otherwise: If node_modules is writeable, return node_modules/.cache/${name}, otherwise return undefined
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (existsSync(cacheNameDirectory) && !(await isAccessible(cacheNameDirectory, W_OK))) {
        return undefined;
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (existsSync(cacheDirectory) && !(await isAccessible(cacheDirectory, W_OK))) {
        return undefined;
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (existsSync(nodeModulesDirectory) && !(await isAccessible(nodeModulesDirectory, W_OK))) {
        return undefined;
    }

    return useDirectory(cacheNameDirectory, options);
};

const findCacheDirectorySync = (name: string, options?: Options): string | undefined => {
    if (env.CACHE_DIR && !["0", "1", "false", "true"].includes(env.CACHE_DIR)) {
        return useDirectory(join(env.CACHE_DIR, name), options);
    }

    const rootDirectory = findUpSync("package.json", {
        cwd: options?.cwd ?? cwd(),
        type: "file",
    });

    if (!rootDirectory) {
        if (options?.throwError) {
            throw new NotFoundError("No such file or directory found.");
        }

        return undefined;
    }

    const nodeModulesDirectory = join(dirname(rootDirectory), "node_modules");
    const cacheDirectory = join(nodeModulesDirectory, ".cache");
    const cacheNameDirectory = join(cacheDirectory, name);

    // If node_modules/.cache/${name} exists: If it is writeable, return node_modules/.cache/${name}, otherwise return undefined
    // Otherwise, if node_modules/.cache exists: If it is writeable, return node_modules/.cache/${name}, otherwise return undefined
    // Otherwise: If node_modules is writeable, return node_modules/.cache/${name}, otherwise return undefined
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (existsSync(cacheNameDirectory) && !isAccessibleSync(cacheNameDirectory, W_OK)) {
        return undefined;
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (existsSync(cacheDirectory) && !isAccessibleSync(cacheDirectory, W_OK)) {
        return undefined;
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (existsSync(nodeModulesDirectory) && !isAccessibleSync(nodeModulesDirectory, W_OK)) {
        return undefined;
    }

    return useDirectory(cacheNameDirectory, options);
};


export const findCacheDir = findCacheDirectory;
export const findCacheDirSync = findCacheDirectorySync;
