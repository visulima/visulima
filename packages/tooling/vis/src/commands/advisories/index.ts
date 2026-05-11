/**
 * `vis advisories` — offline OSV advisory DB management.
 *
 * Three sub-commands:
 *   sync    Download + ingest one or more ecosystem dumps into the local cache.
 *   status  Print DB path, schema version, per-ecosystem row counts and ETag.
 *   prune   Delete the local cache (full reset).
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

const advisoriesCommands: Command[] = [advisoriesSync, advisoriesStatus, advisoriesPrune];

export default advisoriesCommands;

export type AdvisoriesSyncOptions = CreateOptions<{
    db: string | undefined;
    ecosystem: string | undefined;
    force: boolean | undefined;
    format: string | undefined;
    source: string | undefined;
}>;

export type AdvisoriesStatusOptions = CreateOptions<{
    db: string | undefined;
    format: string | undefined;
}>;

export type AdvisoriesPruneOptions = CreateOptions<{
    db: string | undefined;
    force: boolean | undefined;
    format: string | undefined;
}>;
