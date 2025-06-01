import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import revisionHash from "./revision-hash";

const mapCache = new Map<string, string>();

const ensurePath = (filename: string) => {
    const filepath = dirname(filename);

    if (!existsSync(filepath)) {
        mkdirSync(filepath, { recursive: true });
    }

    return filename;
};

const cache = (
    cachePath: string,
    options: {
        fileTTL?: number;
    } = {
        fileTTL: 1000 * 60 * 60 * 24 * 2, // 2 days
    },
) => {
    // cleanup old files
    if (existsSync(cachePath)) {
        readdirSync(cachePath).forEach((file) => {
            const fullFilePath = join(cachePath, file);

            const { birthtime } = statSync(fullFilePath);

            if (Date.now() - birthtime.getTime() > options.fileTTL!) {
                unlinkSync(fullFilePath);
            }
        });
    }

    return {
        clear: (): void => {
            mapCache.clear();

            readdirSync(cachePath).forEach((file) => {
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                unlinkSync(join(cachePath, file));
            });
        },
        delete: (key: string): void => {
            const hashKey = revisionHash(key);

            mapCache.delete(hashKey);

            const cacheFile = join(cachePath, hashKey);

            if (!existsSync(cacheFile)) {
                return;
            }

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            unlinkSync(cacheFile);
        },
        get: (key: string): string | undefined => {
            const hashKey = revisionHash(key);

            if (mapCache.has(hashKey)) {
                return mapCache.get(hashKey);
            }

            const cacheFile = join(cachePath, hashKey);

            if (!existsSync(cacheFile)) {
                return undefined;
            }

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            return readFileSync(cacheFile, "utf8");
        },
        has: (key: string): boolean => {
            const hashKey = revisionHash(key);

            if (mapCache.has(hashKey)) {
                return true;
            }

            return existsSync(join(cachePath, hashKey));
        },
        set: (key: string, value: string): void => {
            const hashKey = revisionHash(key);

            mapCache.set(hashKey, value);

            const cacheFile = ensurePath(join(cachePath, hashKey));

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            writeFileSync(cacheFile, value, "utf8");
        },
    };
};

export default cache;
