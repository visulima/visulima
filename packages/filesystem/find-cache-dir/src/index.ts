import { existsSync } from "node:fs";
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        ensureDirSync(directory);
    }

    return directory;
};

const findCacheDirectory = async (name: string, options?: Options): Promise<string | undefined> => {
    if (env.CACHE_DIR && !["0", "1", "false", "true"].includes(env.CACHE_DIR)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
        return useDirectory(join(env.CACHE_DIR, name), options);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const rootDirectory = await findUp("package.json", {
        cwd: options?.cwd ?? cwd(),
        type: "file",
    });

    if (!rootDirectory) {
        if (options?.throwError) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            throw new NotFoundError("No such file or directory found.");
        }

        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const nodeModulesDirectory = join(dirname(rootDirectory), "node_modules");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const cacheDirectory = join(nodeModulesDirectory, ".cache");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const cacheNameDirectory = join(cacheDirectory, name);

    // If node_modules/.cache/${name} exists: If it is writeable, return node_modules/.cache/${name}, otherwise return undefined
    // Otherwise, if node_modules/.cache exists: If it is writeable, return node_modules/.cache/${name}, otherwise return undefined
    // Otherwise: If node_modules is writeable, return node_modules/.cache/${name}, otherwise return undefined
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
    if (existsSync(cacheNameDirectory) && !await isAccessible(cacheNameDirectory, W_OK)) {
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
    if (existsSync(cacheDirectory) && !await isAccessible(cacheDirectory, W_OK)) {
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
    if (existsSync(nodeModulesDirectory) && !await isAccessible(nodeModulesDirectory, W_OK)) {
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return useDirectory(cacheNameDirectory, options);
};

const findCacheDirectorySync = (name: string, options?: Options): string | undefined => {
    if (env.CACHE_DIR && !["0", "1", "false", "true"].includes(env.CACHE_DIR)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
        return useDirectory(join(env.CACHE_DIR, name), options);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const rootDirectory = findUpSync("package.json", {
        cwd: options?.cwd ?? cwd(),
        type: "file",
    });

    if (!rootDirectory) {
        if (options?.throwError) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            throw new NotFoundError("No such file or directory found.");
        }

        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const nodeModulesDirectory = join(dirname(rootDirectory), "node_modules");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const cacheDirectory = join(nodeModulesDirectory, ".cache");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const cacheNameDirectory = join(cacheDirectory, name);

    // If node_modules/.cache/${name} exists: If it is writeable, return node_modules/.cache/${name}, otherwise return undefined
    // Otherwise, if node_modules/.cache exists: If it is writeable, return node_modules/.cache/${name}, otherwise return undefined
    // Otherwise: If node_modules is writeable, return node_modules/.cache/${name}, otherwise return undefined
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
    if (existsSync(cacheNameDirectory) && !isAccessibleSync(cacheNameDirectory, W_OK)) {
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
    if (existsSync(cacheDirectory) && !isAccessibleSync(cacheDirectory, W_OK)) {
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
    if (existsSync(nodeModulesDirectory) && !isAccessibleSync(nodeModulesDirectory, W_OK)) {
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return useDirectory(cacheNameDirectory, options);
};

// eslint-disable-next-line unicorn/prevent-abbreviations
export const findCacheDir: (name: string, options?: Options) => Promise<string | undefined> = findCacheDirectory;
// eslint-disable-next-line unicorn/prevent-abbreviations
export const findCacheDirSync: (name: string, options?: Options) => string | undefined = findCacheDirectorySync;
