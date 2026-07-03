import type { FSWatcher } from "node:fs";
import { watch } from "node:fs";

import { dirname, relative, resolve } from "@visulima/path";
import type { TaskResults } from "@visulima/task-runner";

import { pail } from "../io/logger";
import { startWatchmanWatcher } from "./watchman";

/**
 * Debounced multi-directory file watcher. Watches one or more project
 * roots recursively and invokes `onChange` at most once per debounce
 * window. Ignores edits inside `node_modules` and `.git`.
 *
 * Prefers the Watchman daemon when both the `fb-watchman` module and
 * the `watchman` binary are available (it scales far better on large
 * trees), and falls back to `node:fs.watch({ recursive: true })` —
 * supported on Linux, macOS, and Windows since Node 20+ — otherwise.
 */
export interface WatchHandle {
    close: () => void;
}

export interface WatchOptions {
    /** Debounce window in milliseconds. Defaults to 150 ms. */
    debounceMs?: number;

    /**
     * Optional predicate invoked against every raw file event
     * (relative path as provided by `node:fs.watch`). Used by
     * tracked-access watch mode to drop changes to files the last
     * run didn't actually read. Return `false` to discard the event.
     */
    filter?: (path: string) => boolean;
    /** Fired when a watched file changes (after debounce). */
    onChange: (changedPaths: string[]) => void | Promise<void>;
    /** Project roots to watch, resolved to absolute paths. */
    paths: string[];
}

const IGNORE_PATTERNS = [/node_modules(?:\/|$)/, /\.git(?:\/|$)/, /\.vis(?:\/|$)/];

/**
 * The set of workspace-relative paths that a run actually read, plus
 * the minimal set of directories that contain them. Used by
 * tracked-access watch mode to only re-trigger runs when a file the
 * previous run actually consumed changes — drops noise from unrelated
 * edits under the project roots.
 *
 * `files` stays workspace-relative because `node:fs.watch` emits
 * paths relative to the watched root.
 */
export interface TrackedWatchTargets {
    directories: string[];
    files: Set<string>;
}

/**
 * Extracts the set of files every task in `results` reported as an
 * input. Returns empty sets when no task carries hash details — the
 * caller falls back to watching project roots in that case.
 *
 * Directories are deduplicated and pruned so a parent dir shadows its
 * descendants — watching both would double-fire events.
 */
export const collectTrackedWatchTargets = (results: TaskResults, workspaceRoot: string): TrackedWatchTargets => {
    const files = new Set<string>();
    const directories = new Set<string>();

    for (const [, result] of results) {
        const nodes = result.task.hashDetails?.nodes;

        if (!nodes) {
            continue;
        }

        for (const filePath of Object.keys(nodes)) {
            files.add(filePath);
            directories.add(dirname(resolve(workspaceRoot, filePath)));
        }
    }

    // Prune descendants — watching a parent covers everything beneath.
    const sorted = [...directories].sort();
    const pruned: string[] = [];

    for (const directory of sorted) {
        if (pruned.some((parent) => directory === parent || directory.startsWith(`${parent}/`))) {
            continue;
        }

        pruned.push(directory);
    }

    return { directories: pruned, files };
};

/**
 * Translates a set of workspace-relative tracked paths into a filter
 * suitable for {@link startWatcher}. The watcher emits paths relative
 * to its watched root — which, after pruning, may be any ancestor
 * directory — so we match on the **suffix** of the tracked path
 * instead of an exact comparison.
 */
export const createTrackedFileFilter = (trackedFiles: Set<string>, workspaceRoot: string, watchedDirectories: string[]): ((path: string) => boolean) => {
    const lookup = new Set<string>();

    for (const file of trackedFiles) {
        const absolute = resolve(workspaceRoot, file);

        for (const directory of watchedDirectories) {
            if (absolute === directory || absolute.startsWith(`${directory}/`)) {
                const rel = relative(directory, absolute);

                if (rel.length > 0) {
                    lookup.add(rel);
                }
            }
        }
    }

    return (path: string) => {
        const normalized = path.replaceAll("\\", "/");

        return lookup.has(normalized);
    };
};

const shouldIgnore = (path: string): boolean => {
    const normalized = path.replaceAll("\\", "/");

    return IGNORE_PATTERNS.some((pattern) => pattern.test(normalized));
};

/**
 * Starts recursive file watchers on the given paths and invokes
 * {@link WatchOptions.onChange} after a debounce window.
 * @param options Watcher configuration.
 * @returns A handle to close all watchers.
 */
export const startWatcher = (options: WatchOptions): WatchHandle => {
    const { debounceMs = 150, filter, onChange, paths } = options;
    let pendingChanges = new Set<string>();
    let timer: NodeJS.Timeout | undefined;

    const flush = (): void => {
        timer = undefined;

        const changes = [...pendingChanges];

        pendingChanges = new Set();

        if (changes.length === 0) {
            return;
        }

        Promise.resolve(onChange(changes)).catch((error: unknown) => {
            pail.error("[vis watch] onChange handler failed:", error);
        });
    };

    // Shared by both backends so ignore rules, the tracked-file
    // filter, and debouncing behave identically regardless of whether
    // the event came from Watchman or node:fs.watch.
    const emit = (filename: string): void => {
        if (shouldIgnore(filename)) {
            return;
        }

        if (filter && !filter(filename)) {
            return;
        }

        pendingChanges.add(filename);

        if (timer) {
            clearTimeout(timer);
        }

        timer = setTimeout(flush, debounceMs);
    };

    const watchmanHandle = startWatchmanWatcher(paths, emit);

    if (watchmanHandle) {
        return {
            close: () => {
                if (timer) {
                    clearTimeout(timer);
                }

                watchmanHandle.close();
            },
        };
    }

    const watchers: FSWatcher[] = [];

    for (const path of paths) {
        try {
            const watcher = watch(path, { recursive: true }, (_eventType, filename) => {
                if (!filename) {
                    return;
                }

                emit(filename);
            });

            watchers.push(watcher);
        } catch (error) {
            pail.warn(`[vis watch] unable to watch ${path}: ${(error as Error).message}`);
        }
    }

    return {
        close: () => {
            if (timer) {
                clearTimeout(timer);
            }

            for (const watcher of watchers) {
                try {
                    watcher.close();
                } catch {
                    // ignore
                }
            }
        },
    };
};
