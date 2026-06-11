import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";

import { useCallback, useEffect, useRef, useState } from "react";

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

const PATH_SEPARATOR_PATTERN = /[/\\]/;

/**
 * Reject namespaces that could escape the `~/.cache/visulima-tui/` directory.
 * The namespace is interpolated directly into a file path, so path separators
 * (`/`, `\`) and traversal segments (`..`) must be rejected defensively even
 * though it is developer-supplied rather than end-user input.
 */
const assertSafeNamespace = (namespace: string): void => {
    if (namespace === "" || namespace === "." || namespace === ".." || PATH_SEPARATOR_PATTERN.test(namespace) || namespace.includes("\0")) {
        throw new Error(`[visulima/tui] usePersistentState: invalid namespace ${JSON.stringify(namespace)} — must not be empty or contain path separators.`);
    }
};

/**
 * Default file-backed storage. Reads/writes a single JSON object per
 * namespace, keyed by `key`. The directory is created on first write and
 * updates use a temp-file + rename to avoid partial writes if the process
 * crashes mid-write. Errors are forwarded to `process.stderr.write` so they
 * are visible without crashing the UI.
 *
 * The namespace object is parsed from disk once (lazily) and kept in memory;
 * subsequent reads/writes operate on the cached object instead of re-reading
 * and re-parsing the whole file on every call.
 */
export const createFileStorage = (namespace: string): PersistentStorage => {
    assertSafeNamespace(namespace);

    const filePath = path.join(homedir(), ".cache", "visulima-tui", `${namespace}.json`);

    let cache: Record<string, string> | undefined;

    const reportError = (operation: string, error: unknown): void => {
        const message = error instanceof Error ? error.message : String(error);

        process.stderr.write(`[visulima/tui] persistent-state ${operation} failed: ${message}\n`);
    };

    const load = (): Record<string, string> => {
        if (cache !== undefined) {
            return cache;
        }

        try {
            const raw = readFileSync(filePath, "utf8");
            const parsed = JSON.parse(raw);

            cache = parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
        } catch (error) {
            // ENOENT and EACCES are expected on first run; log everything else.
            const code = (error as NodeJS.ErrnoException | undefined)?.code;

            if (code !== "ENOENT" && code !== "EACCES") {
                reportError("read", error);
            }

            cache = {};
        }

        return cache;
    };

    return {
        read: (key) => load()[key],
        write: (key, value) => {
            const directory = path.dirname(filePath);
            const temporaryPath = `${filePath}.tmp.${process.pid}`;

            const current = load();

            current[key] = value;

            try {
                mkdirSync(directory, { recursive: true });

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
 * the call-site.
 *
 * Persistence happens in a commit-phase effect, **not** inside the state
 * updater — updaters must be pure (React may double-invoke them under
 * StrictMode or discard them under concurrent rendering), so writing from
 * inside one risked double or phantom disk writes. Writing after commit means
 * only values that actually render are persisted.
 *
 * **Lifecycle note:** the storage backend (resolved from `options.storage`
 * or a fresh `createFileStorage(namespace)`) is captured once on mount and
 * never replaced. Mutating `options.storage` on subsequent renders has no
 * effect — remount the hook (e.g. via a `key` prop) if you need to swap
 * backends at runtime.
 * @param key Unique identifier within the backend namespace.
 * @param initialValue Value used when the backend has no entry for `key`.
 * @param options Optional storage backend + namespace overrides.
 * @returns A `[value, setValue]` tuple. Writes flush in a post-commit effect.
 */
const usePersistentState = <T>(key: string, initialValue: T, options?: UsePersistentStateOptions): readonly [T, (value: T | ((previous: T) => T)) => void] => {
    const storageRef = useRef<PersistentStorage | undefined>(undefined);

    storageRef.current ??= options?.storage ?? createFileStorage(options?.namespace ?? "tui");

    const storage = storageRef.current;

    const [value, setValue] = useState<T>(() => readInitial(storage, key, initialValue));

    // Tracks the value that has already been persisted, so the effect does not
    // re-serialize and re-write the same value. Seeded on the first render with
    // the value sourced from storage so the mount effect is a no-op for an
    // unchanged value (we only persist values that actually change).
    const persistedRef = useRef<{ key: string; value: T } | undefined>(undefined);

    persistedRef.current ??= { key, value };

    // Persist after commit. The updater (below) stays pure.
    useEffect(() => {
        if (persistedRef.current?.key === key && Object.is(persistedRef.current.value, value)) {
            return;
        }

        try {
            storage.write(key, JSON.stringify(value));
            persistedRef.current = { key, value };
        } catch {
            // Non-serializable value; skip persistence.
        }
    }, [key, value, storage]);

    const update = useCallback((next: T | ((previous: T) => T)) => {
        setValue(next);
    }, []);

    return [value, update] as const;
};

export default usePersistentState;

export { usePersistentState };
