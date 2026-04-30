import { rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

import { xxh3Hash } from "@shared/xxh3";
import { ensureDirSync, isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { DoctorResults, SectionId } from "./commands/doctor/sections";

const getCacheDirectory = (): string => join(homedir(), ".vis", "cache", "doctor");
const DEFAULT_TTL_MS = 30 * 60 * 1000;

interface CacheKeyInput {
    readonly configPath?: string;
    readonly lockfilePath?: string;
    readonly sections: ReadonlySet<SectionId>;
    readonly socketEnabled: boolean;
    readonly workspaceRoot: string;
}

interface SerializedResults extends Omit<DoctorResults, "sections"> {
    readonly sections: SectionId[];
}

interface CacheEntry {
    readonly createdAt: number;
    readonly results: SerializedResults;
    readonly ttlMs: number;
}

const safeMtime = (path: string | undefined): string => {
    if (!path) {
        return "";
    }

    try {
        return String(statSync(path).mtimeMs);
    } catch {
        return "";
    }
};

// Bump when the cached `DoctorResults` shape changes — older entries
// without the new field would deserialize with `undefined` properties
// and crash render code that assumes presence. Cheaper than a runtime
// schema check and self-invalidating.
const CACHE_SCHEMA_VERSION = 2;

export const buildDoctorCacheKey = (input: CacheKeyInput): string => {
    const payload = JSON.stringify({
        configMtime: safeMtime(input.configPath),
        lockfileMtime: safeMtime(input.lockfilePath),
        schema: CACHE_SCHEMA_VERSION,
        sections: [...input.sections].toSorted(),
        socketEnabled: input.socketEnabled,
        workspaceRoot: input.workspaceRoot,
    });

    return xxh3Hash(Buffer.from(payload));
};

export const readDoctorCache = (cacheKey: string): DoctorResults | undefined => {
    const filePath = join(getCacheDirectory(), `${cacheKey}.json`);

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    try {
        const entry = readJsonSync(filePath) as unknown as CacheEntry;

        if (Date.now() - entry.createdAt > entry.ttlMs) {
            rmSync(filePath, { force: true });

            return undefined;
        }

        // Set is the only field that can't survive JSON.stringify.
        return { ...entry.results, sections: new Set(entry.results.sections) };
    } catch {
        rmSync(filePath, { force: true });

        return undefined;
    }
};

export const writeDoctorCache = (cacheKey: string, results: DoctorResults, ttlMs: number = DEFAULT_TTL_MS): void => {
    ensureDirSync(getCacheDirectory());

    const entry: CacheEntry = {
        createdAt: Date.now(),
        results: { ...results, sections: [...results.sections] },
        ttlMs,
    };

    writeFileSync(join(getCacheDirectory(), `${cacheKey}.json`), JSON.stringify(entry, undefined, 2), "utf8");
};
