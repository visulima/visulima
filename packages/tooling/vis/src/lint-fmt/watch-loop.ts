/**
 * Watch-mode loop for `vis lint --watch` and `vis fmt --watch`.
 *
 * The orchestrator already supports content-addressed caching (see
 * `cache.ts`), which makes a workspace-wide re-run cheap when only a
 * handful of files changed. The watch loop leans on that: every
 * iteration runs the same cycle the user would have run by hand, but
 * scoped to the union of files that changed since the previous run.
 *
 * Initial run uses the file list the caller derived from flags
 * (positional / --since / --staged) or `undefined` for "workspace-wide".
 * Subsequent runs are driven by `node:fs.watch` events, debounced into
 * batches and filtered to the extensions any eligible adapter claims.
 */

import { isAbsolute, join } from "@visulima/path";

import { startWatcher } from "../watch/watch";

export interface WatchLoopOptions {
    /** Lowercase extensions (no leading dot) the loop will react to. */
    readonly extensions: ReadonlyArray<string>;
    /** Absolute paths driving the initial run (undefined = workspace-wide). */
    readonly initialFiles: string[] | undefined;
    readonly label: "fmt" | "lint";

    /**
     * Optional log channel for status messages. Falls back to
     * `console.log` so the loop stays usable from a non-toolbox caller.
     */
    readonly log?: (message: string) => void;
    /** Cycle function — runs one pass of the orchestrator. */
    readonly runCycle: (files: string[] | undefined) => Promise<void>;
    readonly workspaceRoot: string;
}

const buildExtensionSet = (extensions: ReadonlyArray<string>): Set<string> => {
    const set = new Set<string>();

    for (const ext of extensions) {
        set.add(ext.toLowerCase());
    }

    return set;
};

const hasMatchingExtension = (path: string, extensions: Set<string>): boolean => {
    const lastDot = path.lastIndexOf(".");

    if (lastDot === -1 || lastDot === path.length - 1) {
        return false;
    }

    return extensions.has(path.slice(lastDot + 1).toLowerCase());
};

/**
 * Runs an initial cycle, then watches the workspace and re-runs the
 * cycle whenever files matching `extensions` change. Resolves only on
 * SIGINT / SIGTERM so callers should treat the returned promise as the
 * command's lifecycle in watch mode.
 */
export const runWatchLoop = async (options: WatchLoopOptions): Promise<void> => {
    const { extensions, initialFiles, label, log, runCycle, workspaceRoot } = options;
    const print = log ?? ((message: string): void => {
        process.stdout.write(`${message}\n`);
    });
    const extensionSet = buildExtensionSet(extensions);

    await runCycle(initialFiles);

    print(`▸ ${label}: watching workspace — press Ctrl-C to exit`);

    // Coalesce changes that arrive while a cycle is still running so we
    // never queue a backlog of redundant runs. The next run gets the
    // union of every file batched while it was waiting.
    let pendingFiles = new Set<string>();
    let running = false;

    const consumePending = async (): Promise<void> => {
        while (pendingFiles.size > 0) {
            const batch = [...pendingFiles];

            pendingFiles = new Set<string>();

            try {
                await runCycle(batch);
            } catch (error) {
                print(`✗ ${label}: watch cycle failed — ${(error as Error).message}`);
            }
        }
    };

    const watcher = startWatcher({
        debounceMs: 200,
        // Drop events for files no adapter cares about — node:fs.watch
        // is recursive, so we'd otherwise fire on every file in the
        // workspace.
        filter: (path) => hasMatchingExtension(path, extensionSet),
        onChange: async (changedRelative) => {
            for (const path of changedRelative) {
                pendingFiles.add(isAbsolute(path) ? path : join(workspaceRoot, path));
            }

            if (running) {
                return;
            }

            running = true;

            try {
                await consumePending();
            } finally {
                running = false;
            }
        },
        paths: [workspaceRoot],
    });

    await new Promise<void>((resolve) => {
        const stop = (): void => {
            watcher.close();
            process.off("SIGINT", stop);
            process.off("SIGTERM", stop);
            resolve();
        };

        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
    });
};
