/**
 * Background upgrade check - non-intrusive update notification.
 *
 * Per vite-plus upgrade-check RFC:
 * - Spawns async registry check while command runs (no latency impact)
 * - Shows single-line notice at most once per 24 hours
 * - Cached at ~/.vis/.upgrade-check.json
 * - Skipped in CI, test, quiet, non-TTY, and excluded commands
 * - 500ms timeout prevents network from delaying exit
 */

import { homedir } from "node:os";

import { bold, cyan, dim, green, yellow } from "@visulima/colorize";
import { ensureDirSync, isAccessibleSync, readJsonSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import isInCi from "is-in-ci";
import { gt } from "semver";

import { SYMBOLS } from "../io/symbols";

const VIS_HOME = join(homedir(), ".vis");
const CACHE_FILE = join(VIS_HOME, ".upgrade-check.json");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NOTICE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REGISTRY_TIMEOUT_MS = 500;

interface UpgradeCheckCache {
    /** Timestamp of last notice shown to user */
    lastNoticeAt: number;
    /** Timestamp of last registry query */
    lastQueryAt: number;
    /** Latest available version from registry */
    latestVersion: string;
}

/** Commands that should NOT trigger upgrade checks. */
const EXCLUDED_COMMANDS: Set<string> = new Set<string>(["--help", "--version", "-h", "-V", "help", "implode", "self-update", "upgrade"]);

const readCache = (): UpgradeCheckCache | undefined => {
    try {
        if (isAccessibleSync(CACHE_FILE)) {
            return readJsonSync(CACHE_FILE) as unknown as UpgradeCheckCache;
        }
    } catch {
        // Corrupted cache, will be recreated
    }

    return undefined;
};

const writeCache = (cache: UpgradeCheckCache): void => {
    try {
        ensureDirSync(VIS_HOME);

        writeFileSync(CACHE_FILE, JSON.stringify(cache));
    } catch {
        // Non-critical, skip
    }
};

/**
 * Fetches the latest version from npm registry with a timeout.
 * Returns undefined on any failure (network, timeout, parse error).
 */
const fetchLatestVersion = async (packageName: string): Promise<string | undefined> => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, REGISTRY_TIMEOUT_MS);

        const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
            headers: { accept: "application/json" },
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            return undefined;
        }

        const data = (await response.json()) as { version?: string };

        return data.version;
    } catch {
        // Network error, timeout, or abort - all expected
        return undefined;
    }
};

/**
 * Shows the upgrade notice if conditions are met.
 * Called after command execution completes.
 *
 * `semver.gt` runs in loose mode so it tolerates the `v` prefix that some
 * registries return (e.g. `v1.0.0`). Invalid version strings throw, so we
 * swallow the error and skip the notice rather than crashing the CLI on
 * a malformed registry response.
 */
const showUpgradeNotice = (currentVersion: string, cache: UpgradeCheckCache): void => {
    let isNewer = false;

    try {
        isNewer = gt(cache.latestVersion, currentVersion, { loose: true });
    } catch {
        return;
    }

    if (!isNewer) {
        return;
    }

    const now = Date.now();

    // Rate limit: once per 24 hours
    if (now - cache.lastNoticeAt < NOTICE_INTERVAL_MS) {
        return;
    }

    // Show the notice
    process.stderr.write(
        `\n${dim("vis update available:")} ${yellow(currentVersion)} ${dim(SYMBOLS.arrow)} ${green(bold(cache.latestVersion))}${dim(", run")} ${cyan("vis upgrade")}\n`,
    );

    // Update notice timestamp
    cache.lastNoticeAt = now;
    writeCache(cache);
};

/**
 * Determines if the upgrade check should run for this invocation.
 */
const shouldCheck = (command: string): boolean => {
    // Skip in CI
    if (isInCi) {
        return false;
    }

    // Skip in test mode
    if (process.env.VIS_CLI_TEST) {
        return false;
    }

    // Skip if opted out
    if (process.env.VIS_NO_UPDATE_CHECK === "1") {
        return false;
    }

    // Skip for non-TTY
    if (!process.stderr.isTTY) {
        return false;
    }

    // Skip for excluded commands
    if (EXCLUDED_COMMANDS.has(command)) {
        return false;
    }

    // Skip for quiet/json flags
    const args = new Set(process.argv.slice(2));

    if (args.has("--silent") || args.has("-s") || args.has("--json")) {
        return false;
    }

    return true;
};

/**
 * Runs the background upgrade check. Non-blocking.
 *
 * 1. Check if we need to query the registry (24h cooldown)
 * 2. If yes, fetch latest version asynchronously
 * 3. Return a promise that resolves with the check function to call after command
 */
const startUpgradeCheck = (currentVersion: string, command: string): (() => void) | undefined => {
    if (!shouldCheck(command)) {
        return undefined;
    }

    const cache = readCache();
    const now = Date.now();

    // If cache is fresh, just return the notice callback
    if (cache && now - cache.lastQueryAt < CHECK_INTERVAL_MS) {
        return () => {
            showUpgradeNotice(currentVersion, cache);
        };
    }

    // Need to query registry - fire async, don't await
    let pendingCache: UpgradeCheckCache | undefined = cache;

    // Fire and forget the registry query
    fetchLatestVersion("@visulima/vis")
        .then((latestVersion) => {
            if (latestVersion) {
                pendingCache = {
                    lastNoticeAt: cache?.lastNoticeAt ?? 0,
                    lastQueryAt: now,
                    latestVersion,
                };
                writeCache(pendingCache);
            }
        })
        .catch(() => {
            // Silently ignore network failures
        });

    // Return callback that shows notice with whatever data we have
    return () => {
        if (pendingCache) {
            showUpgradeNotice(currentVersion, pendingCache);
        }
    };
};

export { EXCLUDED_COMMANDS, shouldCheck, startUpgradeCheck };
