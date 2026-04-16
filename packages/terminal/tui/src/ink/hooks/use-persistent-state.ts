import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { useCallback, useRef, useState } from "react";

export type PersistentStorage = {
    /**
     * Return the persisted JSON-encoded string for `key`, or `undefined` if
     * nothing has been stored yet.
     */
    readonly read: (key: string) => string | undefined;

    /**
     * Persist `value` (a JSON-encoded string) for `key`. Errors are swallowed
     * by the hook so the UI keeps working in read-only environments.
     */
    readonly write: (key: string, value: string) => void;
};

export type UsePersistentStateOptions = {
    /**
     * Custom storage backend. When omitted, the default is a file on disk at
     * `~/.cache/visulima-tui/<namespace>.json`.
     */
    readonly storage?: PersistentStorage;

    /**
     * Namespace used by the default file storage. Separates keys across
     * independent applications sharing the user's home directory.
     * @default "tui"
     */
    readonly namespace?: string;
};

/**
 * In-memory storage shared across all hook instances that use it. Useful in
 * tests and in environments without file access.
 */
export const createMemoryStorage = (): PersistentStorage => {
    const memory = new Map<string, string>();

    return {
        read: (key) => memory.get(key),
        write: (key, value) => {
            memory.set(key, value);
        },
    };
};

/**
 * Default file-backed storage. Reads/writes a single JSON object per
 * namespace, keyed by `key`. Errors are caught and logged to stderr so a
 * read-only filesystem degrades gracefully.
 */
export const createFileStorage = (namespace: string): PersistentStorage => {
    const filePath = path.join(homedir(), ".cache", "visulima-tui", `${namespace}.json`);

    const load = (): Record<string, string> => {
        try {
            const raw = readFileSync(filePath, "utf8");
            const parsed = JSON.parse(raw) as unknown;

            if (parsed && typeof parsed === "object") {
                return parsed as Record<string, string>;
            }

            return {};
        } catch {
            return {};
        }
    };

    return {
        read: (key) => load()[key],
        write: (key, value) => {
            try {
                const current = load();

                current[key] = value;
                writeFileSync(filePath, JSON.stringify(current, null, 2), {
                    encoding: "utf8",
                    flag: "w",
                });
            } catch {
                // Swallow errors — read-only filesystems, permission issues.
            }
        },
    };
};

const readInitial = <T>(storage: PersistentStorage, key: string, fallback: T): T => {
    const raw = storage.read(key);

    if (raw === undefined) {
        return fallback;
    }

    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
};

/**
 * `useState` that persists its value through the configured `storage`
 * backend (file on disk by default). Behaves identically to `useState` at
 * the call-site; the writes happen synchronously after each update.
 */
const usePersistentState = <T>(
    key: string,
    initialValue: T,
    options?: UsePersistentStateOptions,
): readonly [T, (value: T | ((previous: T) => T)) => void] => {
    const storageRef = useRef<PersistentStorage>(options?.storage ?? createFileStorage(options?.namespace ?? "tui"));

    const [value, setValue] = useState<T>(() => readInitial(storageRef.current, key, initialValue));

    const update = useCallback(
        (next: T | ((previous: T) => T)) => {
            setValue((previous) => {
                const resolved = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;

                try {
                    storageRef.current.write(key, JSON.stringify(resolved));
                } catch {
                    // Non-serializable value; skip persistence.
                }

                return resolved;
            });
        },
        [key],
    );

    return [value, update] as const;
};

export default usePersistentState;
