import { watch } from "node:fs";
import type { FSWatcher } from "node:fs";

/**
 * Debounced multi-directory file watcher. Watches one or more project
 * roots recursively and invokes `onChange` at most once per debounce
 * window. Ignores edits inside `node_modules` and `.git`.
 *
 * `node:fs.watch({ recursive: true })` is supported on Linux, macOS,
 * and Windows since Node 20+, so no additional dependency is needed.
 */
export interface WatchHandle {
    close: () => void;
}

export interface WatchOptions {
    /** Debounce window in milliseconds. Defaults to 150 ms. */
    debounceMs?: number;
    /** Fired when a watched file changes (after debounce). */
    onChange: (changedPaths: string[]) => void | Promise<void>;
    /** Project roots to watch, resolved to absolute paths. */
    paths: string[];
}

const IGNORE_PATTERNS = [/node_modules/, /\.git\//, /\.vis\//, /\.task-runner\//];

const shouldIgnore = (path: string): boolean => {
    return IGNORE_PATTERNS.some((pattern) => pattern.test(path));
};

export const startWatcher = (options: WatchOptions): WatchHandle => {
    const { debounceMs = 150, onChange, paths } = options;
    const watchers: FSWatcher[] = [];
    let pendingChanges = new Set<string>();
    let timer: NodeJS.Timeout | undefined;

    const flush = (): void => {
        const changes = [...pendingChanges];

        pendingChanges = new Set();

        if (changes.length === 0) {
            return;
        }

        Promise.resolve(onChange(changes)).catch((error) => {
            console.error("[vis watch] onChange handler failed:", error);
        });
    };

    for (const path of paths) {
        try {
            const watcher = watch(path, { recursive: true }, (_eventType, filename) => {
                if (!filename) {
                    return;
                }

                if (shouldIgnore(filename)) {
                    return;
                }

                pendingChanges.add(filename);

                if (timer) {
                    clearTimeout(timer);
                }

                timer = setTimeout(flush, debounceMs);
            });

            watchers.push(watcher);
        } catch (error) {
            console.warn(`[vis watch] unable to watch ${path}: ${(error as Error).message}`);
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
