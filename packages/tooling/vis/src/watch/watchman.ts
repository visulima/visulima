import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

import { resolve } from "@visulima/path";

import { pail } from "../io/logger";

/**
 * Optional Watchman backend for the `startWatcher` file watcher.
 *
 * Facebook's `watchman` scales recursive watching far past
 * `node:fs.watch` on large trees (it shares one daemon-side crawl
 * across every project root instead of one inotify handle per file).
 * It is wired in opportunistically: if both the `fb-watchman` module
 * and the `watchman` binary are present we subscribe through the
 * daemon, otherwise the caller falls back to the native watcher.
 *
 * Detection is synchronous and cached so the caller can stay
 * synchronous and pick a backend without an async import race that
 * would defeat the fallback.
 */

interface WatchmanResponse {
    relative_path?: string;
    subscription?: string;
    warning?: string;
    watch: string;
}

interface WatchmanSubscriptionEvent {
    files?: string[];
    is_fresh_instance?: boolean;
    subscription?: string;
}

interface WatchmanClient {
    command: (args: unknown[], callback: (error: Error | null, response: WatchmanResponse) => void) => void;
    end: () => void;
    on: (event: "error" | "subscription", listener: (payload: never) => void) => void;
}

interface WatchmanModule {
    Client: new () => WatchmanClient;
}

const cjsRequire = createRequire(import.meta.url);

let cachedAvailability: boolean | undefined;

/**
 * True only when the `fb-watchman` module resolves *and* a working
 * `watchman` binary is on PATH. Both are required: the module is just
 * a thin client that shells out to the daemon, so a missing binary
 * would surface as an async error long after the sync backend choice.
 */
export const isWatchmanAvailable = (): boolean => {
    if (cachedAvailability !== undefined) {
        return cachedAvailability;
    }

    try {
        cjsRequire.resolve("fb-watchman");
    } catch {
        cachedAvailability = false;

        return false;
    }

    try {
        execFileSync("watchman", ["--version"], { stdio: "ignore", timeout: 2000 });
    } catch {
        cachedAvailability = false;

        return false;
    }

    cachedAvailability = true;

    return true;
};

interface WatchmanHandle {
    close: () => void;
}

/**
 * Subscribes to file changes for every path via the Watchman daemon.
 * Returns `undefined` when Watchman is unavailable so the caller can
 * fall back to the native watcher.
 *
 * `emit` receives the changed file path **relative to the watched
 * `path`**, matching the semantics of `node:fs.watch`'s `filename`
 * argument so both backends feed the shared debounce/ignore pipeline
 * identically.
 */
export const startWatchmanWatcher = (paths: string[], emit: (filename: string) => void): WatchmanHandle | undefined => {
    if (!isWatchmanAvailable()) {
        return undefined;
    }

    let watchman: WatchmanModule;

    try {
        watchman = cjsRequire("fb-watchman") as WatchmanModule;
    } catch (error) {
        pail.warn(`[vis watch] fb-watchman failed to load, using native watcher: ${(error as Error).message}`);

        return undefined;
    }

    const client = new watchman.Client();

    client.on("error", (error: never) => {
        pail.warn(`[vis watch] watchman error: ${(error as Error).message}`);
    });

    client.on("subscription", (event: never) => {
        const subscriptionEvent = event as WatchmanSubscriptionEvent;

        // Watchman replays the full tree on first connect — that is
        // not a change, so skip it (parity with fs.watch, which only
        // fires on actual edits).
        if (subscriptionEvent.is_fresh_instance) {
            return;
        }

        for (const name of subscriptionEvent.files ?? []) {
            emit(name);
        }
    });

    for (const [index, path] of paths.entries()) {
        const absolutePath = resolve(path);
        const subscriptionName = `vis-watch-${index}-${process.pid}`;

        client.command(["watch-project", absolutePath], (error: Error | null, response: WatchmanResponse) => {
            if (error) {
                pail.warn(`[vis watch] watchman could not watch ${path}: ${error.message}`);

                return;
            }

            // `relative_path` is `absolutePath` expressed relative to
            // the watch root Watchman picked (often the repo root).
            // Passing it back as `relative_root` makes the daemon emit
            // file names relative to `path`, matching fs.watch.
            const subscription: Record<string, unknown> = {
                expression: ["allof", ["type", "f"]],
                fields: ["name"],
            };

            if (response.relative_path) {
                subscription.relative_root = response.relative_path;
            }

            client.command(["subscribe", response.watch, subscriptionName, subscription], (subscribeError: Error | null) => {
                if (subscribeError) {
                    pail.warn(`[vis watch] watchman subscribe failed for ${path}: ${subscribeError.message}`);
                }
            });
        });
    }

    return {
        close: () => {
            // Watchman subscriptions are connection-scoped: ending the
            // client drops the socket and the daemon discards every
            // subscription made on it. No explicit `unsubscribe` is
            // needed (it would race `end()` anyway). This is what
            // makes the frequent watcher rebuilds in the run handler
            // safe — each rebuild is a fresh client, so the previous
            // subscription set dies with the previous connection.
            try {
                client.end();
            } catch {
                // ignore
            }
        },
    };
};
