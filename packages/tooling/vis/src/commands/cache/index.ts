import type { Command, CreateOptions } from "@visulima/cerebro";
import { lazyNamed } from "@visulima/cerebro";

const cacheDirectoryOption = {
    description: "Cache directory (overrides config and default). Relative paths are resolved against the workspace root.",
    name: "cache-dir",
    type: String,
} as const;

const cacheList: Command = {
    commandPath: ["cache"],
    description: "List all cache entries",
    examples: [["vis cache list", "List all cache entries"]],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "cacheListExecute"),
    name: "list",
    options: [
        cacheDirectoryOption,
        {
            description: "Output format: table or json (default: table)",
            name: "format",
            type: String,
        },
    ],
};

const cacheClean: Command = {
    commandPath: ["cache"],
    description: "Remove all cache entries",
    examples: [
        ["vis cache clean", "Remove all cache entries"],
        ["vis cache clean --dry-run", "Preview what clean would remove"],
    ],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "cacheCleanExecute"),
    name: "clean",
    options: [
        cacheDirectoryOption,
        {
            defaultValue: false,
            description: "Preview without deleting",
            name: "dry-run",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Skip the confirmation prompt for out-of-workspace cache directories",
            name: "force",
            type: Boolean,
        },
    ],
};

const cachePrune: Command = {
    commandPath: ["cache"],
    description: "Remove old and oversized cache entries",
    examples: [
        ["vis cache prune", "Remove old and oversized entries"],
        ["vis cache prune --max-age-days=3 --max-size=500MB", "Prune with custom limits"],
    ],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "cachePruneExecute"),
    name: "prune",
    options: [
        cacheDirectoryOption,
        {
            description: "Remove entries older than N days",
            name: "max-age-days",
            type: Number,
        },
        {
            description: "Evict oldest entries until cache is under this size (e.g. 500MB)",
            name: "max-size",
            type: String,
        },
    ],
};

const cacheSize: Command = {
    commandPath: ["cache"],
    description: "Print the cache directory's on-disk footprint",
    examples: [["vis cache size --format=json", "Print total size as JSON"]],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "cacheSizeExecute"),
    name: "size",
    options: [
        cacheDirectoryOption,
        {
            description: "Output format: table or json (default: table)",
            name: "format",
            type: String,
        },
    ],
};

const cacheCommands: Command[] = [cacheList, cacheClean, cachePrune, cacheSize];

export default cacheCommands;

export type CacheListOptions = CreateOptions<{
    "cache-dir": string | undefined;
    "format": string | undefined;
}>;

export type CacheCleanOptions = CreateOptions<{
    "cache-dir": string | undefined;
    "dry-run": boolean | undefined;
    "force": boolean | undefined;
}>;

export type CachePruneOptions = CreateOptions<{
    "cache-dir": string | undefined;
    "max-age-days": number | undefined;
    "max-size": string | undefined;
}>;

export type CacheSizeOptions = CreateOptions<{
    "cache-dir": string | undefined;
    "format": string | undefined;
}>;
