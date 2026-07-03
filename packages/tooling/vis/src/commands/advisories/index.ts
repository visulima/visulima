/**
 * `vis advisories` — offline OSV advisory DB management.
 *
 * Three sub-commands at the top level:
 *   sync    Download + ingest one or more ecosystem dumps into the local cache.
 *   status  Print DB path, schema version, per-ecosystem row counts and ETag.
 *   prune   Delete the local cache (full reset).
 *
 * Two `advisories bloom` sub-commands for the MAL-* bloom prefilter:
 *   bloom sync    Fetch + verify the `endevco/osv-bloom` filter.
 *   bloom status  Print bloom cache freshness and parameters.
 *
 * Read paths (`status`) are pure JS. Mutating paths (`sync`, `prune`) call
 * into the native crate.
 */

import type { Command, CreateOptions } from "@visulima/cerebro";
import { lazyNamed } from "@visulima/cerebro";

const dbPathOption = {
    description: "Override the cache DB path (defaults to <cache>/vis/advisories/db.sqlite via @visulima/find-cache-dir).",
    name: "db",
    type: String,
} as const;

const formatOption = {
    description: "Output format: table (default) or json.",
    name: "format",
    type: String,
} as const;

const advisoriesSync: Command = {
    commandPath: ["advisories"],
    description: "Download and ingest one or more OSV ecosystem dumps into the local cache",
    examples: [
        ["vis advisories sync", "Sync the npm ecosystem (default)"],
        ["vis advisories sync --ecosystem npm", "Sync a single explicit ecosystem"],
        ["vis advisories sync --ecosystem npm,PyPI", "Sync several ecosystems in one pass"],
        ["vis advisories sync --force", "Re-download even when the ETag matches"],
        ["vis advisories sync --source https://mirror.example.com", "Use a corporate OSV mirror (must be in allowedHosts)"],
    ],
    group: "Security & Health",
    loader: lazyNamed(() => import("./sync"), "advisoriesSyncExecute"),
    name: "sync",
    options: [
        {
            description: "Comma-separated list of ecosystems to sync (default: npm).",
            name: "ecosystem",
            type: String,
        },
        {
            defaultValue: false,
            description: "Re-download and re-ingest even if the upstream ETag is unchanged.",
            name: "force",
            type: Boolean,
        },
        {
            description: "Override the advisory source URL. Must be https and resolve to an allowed host.",
            name: "source",
            type: String,
        },
        dbPathOption,
        formatOption,
    ],
};

const advisoriesStatus: Command = {
    commandPath: ["advisories"],
    description: "Print the local advisory DB summary: path, schema version, ecosystems, row counts, last sync, ETag",
    examples: [
        ["vis advisories status", "Human-readable summary"],
        ["vis advisories status --format json", "Machine-readable for CI freshness checks"],
    ],
    group: "Security & Health",
    loader: lazyNamed(() => import("./status"), "advisoriesStatusExecute"),
    name: "status",
    options: [dbPathOption, formatOption],
};

const advisoriesPrune: Command = {
    commandPath: ["advisories"],
    description: "Delete the local advisory DB. The next `vis audit --offline` will fail until you re-sync",
    examples: [
        ["vis advisories prune", "Confirm and delete the local DB"],
        ["vis advisories prune --force", "Delete without confirmation"],
    ],
    group: "Security & Health",
    loader: lazyNamed(() => import("./prune"), "advisoriesPruneExecute"),
    name: "prune",
    options: [
        dbPathOption,
        {
            defaultValue: false,
            description: "Skip the confirmation prompt.",
            name: "force",
            type: Boolean,
        },
        formatOption,
    ],
};

const bloomCacheDirOption = {
    description: "Override the bloom cache directory (defaults to <cache>/vis/osv-bloom/).",
    name: "cache-dir",
    type: String,
} as const;

const advisoriesBloomSync: Command = {
    commandPath: ["advisories", "bloom"],
    description: "Fetch and verify the endevco/osv-bloom MAL-* prefilter into the local cache",
    examples: [
        ["vis advisories bloom sync", "Fetch the bloom filter from the default upstream"],
        ["vis advisories bloom sync --force", "Re-download even when the set digest matches"],
        ["vis advisories bloom sync --source https://bloom.example.com", "Use an internal mirror (must be in allowedHosts)"],
    ],
    group: "Security & Health",
    loader: lazyNamed(() => import("./bloom-sync"), "advisoriesBloomSyncExecute"),
    name: "sync",
    options: [
        {
            defaultValue: false,
            description: "Re-download and re-verify even when the upstream set digest is unchanged.",
            name: "force",
            type: Boolean,
        },
        {
            description: "Override the bloom source URL. Must be https and resolve to an allowed host.",
            name: "source",
            type: String,
        },
        bloomCacheDirOption,
        formatOption,
    ],
};

const advisoriesBloomStatus: Command = {
    commandPath: ["advisories", "bloom"],
    description: "Print the local osv-bloom cache freshness: built-at, filter size, m/k parameters, set digest",
    examples: [
        ["vis advisories bloom status", "Human-readable summary"],
        ["vis advisories bloom status --format json", "Machine-readable for CI freshness checks"],
    ],
    group: "Security & Health",
    loader: lazyNamed(() => import("./bloom-status"), "advisoriesBloomStatusExecute"),
    name: "status",
    options: [bloomCacheDirOption, formatOption],
};

const advisoriesCommands: Command[] = [advisoriesSync, advisoriesStatus, advisoriesPrune, advisoriesBloomSync, advisoriesBloomStatus];

export default advisoriesCommands;

/** Typed options for `vis advisories sync` (cache refresh from the OSV dump). */
export type AdvisoriesSyncOptions = CreateOptions<{
    db: string | undefined;
    ecosystem: string | undefined;
    force: boolean | undefined;
    format: string | undefined;
    source: string | undefined;
}>;

/** Typed options for `vis advisories status` (cache freshness report). */
export type AdvisoriesStatusOptions = CreateOptions<{
    db: string | undefined;
    format: string | undefined;
}>;

/** Typed options for `vis advisories prune` (delete the local cache). */
export type AdvisoriesPruneOptions = CreateOptions<{
    db: string | undefined;
    force: boolean | undefined;
    format: string | undefined;
}>;

/** Typed options for `vis advisories bloom sync`. */
export type AdvisoriesBloomSyncOptions = CreateOptions<{
    "cache-dir": string | undefined;
    force: boolean | undefined;
    format: string | undefined;
    source: string | undefined;
}>;

/** Typed options for `vis advisories bloom status`. */
export type AdvisoriesBloomStatusOptions = CreateOptions<{
    "cache-dir": string | undefined;
    format: string | undefined;
}>;
