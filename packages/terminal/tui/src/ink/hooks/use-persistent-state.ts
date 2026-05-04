import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";

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
     * Namespace used by the default file storage. Separates keys across
     * independent applications sharing the user's home directory.
     * @default "tui"
     */
    readonly namespace?: string;

    /**
     * Custom storage backend. When omitted, the default is a file on disk at
     * `~/.cache/visulima-tui/&lt;namespace>.json`.
     */
    readonly storage?: PersistentStorage;
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
 * namespace, keyed by `key`. The directory is created on first write and
 * updates use a temp-file + rename to avoid partial writes if the process
 * crashes mid-write. Errors are forwarded to `process.stderr.write` so they
 * are visible without crashing the UI.
 */
export const createFileStorage = (namespace: string): PersistentStorage => {
    const filePath = path.join(homedir(), ".cache", "visulima-tui", `${namespace}.json`);

    const reportError = (operation: string, error: unknown): void => {
        const message = error instanceof Error ? error.message : String(error);

        process.stderr.write(`[visulima/tui] persistent-state ${operation} failed: ${message}\n`);
    };

    const load = (): Record<string, string> => {
        try {
            const raw = readFileSync(filePath, "utf8");
            const parsed = JSON.parse(raw) as unknown;

            if (parsed && typeof parsed === "object") {
                return parsed as Record<string, string>;
            }

            return {};
        } catch (error) {
            // ENOENT and EACCES are expected on first run; log everything else.
            const code = (error as NodeJS.ErrnoException | undefined)?.code;

            if (code !== "ENOENT" && code !== "EACCES") {
                reportError("read", error);
            }

            return {};
        }
    };

    return {
        read: (key) => load()[key],
        write: (key, value) => {
            const directory = path.dirname(filePath);
            const temporaryPath = `${filePath}.tmp.${process.pid}`;

            try {
                mkdirSync(directory, { recursive: true });

                const current = load();

                current[key] = value;

                // Write to a temp file in the same directory then atomically
                // rename — prevents readers from ever seeing a half-written
                // file, and guarantees we either keep the old contents or
                // see the new ones.
                // eslint-disable-next-line unicorn/no-null -- JSON.stringify replacer requires `null`, not `undefined`
                writeFileSync(temporaryPath, JSON.stringify(current, null, 2), {
                    encoding: "utf8",
                    flag: "w",
                });
                renameSync(temporaryPath, filePath);
            } catch (error) {
                reportError("write", error);
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
 *
 * **Lifecycle note:** the storage backend (resolved from `options.storage`
 * or a fresh `createFileStorage(namespace)`) is captured once on mount and
 * never replaced. Mutating `options.storage` on subsequent renders has no
 * effect — remount the hook (e.g. via a `key` prop) if you need to swap
 * backends at runtime.
 * @param key Unique identifier within the backend namespace.
 * @param initialValue Value used when the backend has no entry for `key`.
 * @param options Optional storage backend + namespace overrides.
 * @returns A `[value, setValue]` tuple. Writes flush synchronously after
 * the React state update.
 */
const usePersistentState = <T>(key: string, initialValue: T, options?: UsePersistentStateOptions): readonly [T, (value: T | ((previous: T) => T)) => void] => {
    const storageRef = useRef(options?.storage ?? createFileStorage(options?.namespace ?? "tui"));

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
