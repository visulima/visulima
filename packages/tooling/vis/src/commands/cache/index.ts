import type { Command, CreateOptions } from "@visulima/cerebro";
import { lazyNamed } from "@visulima/cerebro";

const cacheDirectoryOption = {
    description: "Cache directory (overrides config and default). Relative paths are resolved against the workspace root.",
    name: "cache-dir",
    type: String,
} as const;

const scopeOption = {
    description: "Cache scope: 'shared' (default — main worktree's cache), 'worktree' (this checkout's local cache), or 'all' (both)",
    name: "scope",
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
        scopeOption,
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
        ["vis cache prune --keep-last=30", "Keep only the 30 most recent entries"],
    ],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "cachePruneExecute"),
    name: "prune",
    options: [
        cacheDirectoryOption,
        scopeOption,
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
        {
            description: "Keep only the N most recent entries (sorted newest-first by mtime)",
            name: "keep-last",
            type: Number,
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
        scopeOption,
        {
            description: "Output format: table or json (default: table)",
            name: "format",
            type: String,
        },
    ],
};

const formatOption = {
    description: "Output format: table or json (default: table)",
    name: "format",
    type: String,
} as const;

const runOption = {
    description: "Use a specific run ID from .task-runner/runs/ instead of the latest run",
    name: "run",
    type: String,
} as const;

const cacheWhy: Command = {
    argument: {
        description: "Task ID to explain (e.g. @my/app:build)",
        name: "taskId",
        type: String,
    },
    commandPath: ["cache"],
    description: "Explain why a task missed the cache by diffing hash inputs against the previous run",
    examples: [
        ["vis cache why @myorg/app:build", "Show which inputs changed since the last run"],
        ["vis cache why @myorg/app:build --json", "Machine-readable output for CI"],
        ["vis cache why @myorg/app:build --run 2026-04-28T...", "Inspect a specific historical run"],
    ],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "cacheWhyExecute"),
    name: "why",
    options: [formatOption, runOption],
};

const cacheHash: Command = {
    argument: {
        description: "Task ID to print the hash for (e.g. @my/app:build)",
        name: "taskId",
        type: String,
    },
    commandPath: ["cache"],
    description: "Print the recorded hash and per-input hash details for a task",
    examples: [
        ["vis cache hash @myorg/app:build", "Show the resolved hash + contributing inputs"],
        ["vis cache hash @myorg/app:build --json", "Machine-readable output"],
    ],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "cacheHashExecute"),
    name: "hash",
    options: [formatOption, runOption],
};

const cacheCommands: Command[] = [cacheList, cacheClean, cachePrune, cacheSize, cacheWhy, cacheHash];

export default cacheCommands;

export type CacheListOptions = CreateOptions<{
    "cache-dir": string | undefined;
    format: string | undefined;
    scope: string | undefined;
}>;

export type CacheCleanOptions = CreateOptions<{
    "cache-dir": string | undefined;
    "dry-run": boolean | undefined;
    force: boolean | undefined;
}>;

export type CachePruneOptions = CreateOptions<{
    "cache-dir": string | undefined;
    "keep-last": number | undefined;
    "max-age-days": number | undefined;
    "max-size": string | undefined;
    scope: string | undefined;
}>;

export type CacheSizeOptions = CreateOptions<{
    "cache-dir": string | undefined;
    format: string | undefined;
    scope: string | undefined;
}>;

export type CacheWhyOptions = CreateOptions<{
    format: string | undefined;
    run: string | undefined;
}>;

export type CacheHashOptions = CreateOptions<{
    format: string | undefined;
    run: string | undefined;
}>;
