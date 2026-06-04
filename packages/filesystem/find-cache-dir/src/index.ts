import { cwd, env } from "node:process";

// eslint-disable-next-line import/no-extraneous-dependencies
import { ensureDirSync, findUp, findUpSync, isAccessible, isAccessibleSync, W_OK } from "@visulima/fs";
// eslint-disable-next-line import/no-extraneous-dependencies
import { NotFoundError } from "@visulima/fs/error";
// eslint-disable-next-line import/no-extraneous-dependencies
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

    if (!(await isAccessible(cacheNameDirectory, W_OK)) && (await isAccessible(cacheNameDirectory))) {
        return undefined;
    }

    if (!(await isAccessible(cacheDirectory, W_OK)) && (await isAccessible(cacheDirectory))) {
        return undefined;
    }

    if (!(await isAccessible(nodeModulesDirectory, W_OK)) && (await isAccessible(nodeModulesDirectory))) {
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

    if (!isAccessibleSync(cacheNameDirectory, W_OK) && isAccessibleSync(cacheNameDirectory)) {
        return undefined;
    }

    if (!isAccessibleSync(cacheDirectory, W_OK) && isAccessibleSync(cacheDirectory)) {
        return undefined;
    }

    if (!isAccessibleSync(nodeModulesDirectory, W_OK) && isAccessibleSync(nodeModulesDirectory)) {
        return undefined;
    }

    return useDirectory(cacheNameDirectory, options);
};

// eslint-disable-next-line unicorn/prevent-abbreviations
export const findCacheDir: (name: string, options?: Options) => Promise<string | undefined> = findCacheDirectory;
// eslint-disable-next-line unicorn/prevent-abbreviations
export const findCacheDirSync: (name: string, options?: Options) => string | undefined = findCacheDirectorySync;
