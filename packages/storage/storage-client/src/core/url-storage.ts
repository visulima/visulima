/* eslint-disable max-classes-per-file -- MemoryUrlStorage and LocalStorageUrlStorage are two tightly-coupled implementations of the same UrlStorage contract and belong in one module */
/* eslint-disable import/exports-last -- interfaces and classes are exported inline next to their definitions for readability of this small primitive module */
import type { FingerprintProtocol } from "./fingerprint";

/**
 * A single persisted upload session — the minimum data an adapter needs to
 * resume the upload in a brand-new process.
 *
 * For TUS, `uploadUrl` is the Location header returned from the initial POST.
 * For chunked-REST, `uploadUrl` carries the server-issued file ID (the same
 * value the adapter slots into `${endpoint}/${fileId}` for PATCH/HEAD).
 */
export interface UrlStorageEntry {
    /** When this entry was added (ms epoch). Lets callers prune stale entries. */
    createdAt: number;
    /** Endpoint the upload was created against. */
    endpoint: string;
    /** Stable per-file identifier — see `defaultFingerprint`. */
    fingerprint: string;
    /** File `lastModified` at the time the upload was created. */
    lastModified?: number;
    /** Which adapter wrote this entry. */
    protocol: FingerprintProtocol;
    /** File size in bytes at the time the upload was created. */
    size?: number;
    /** TUS uploadUrl or chunked-REST fileId. */
    uploadUrl: string;
}

export interface UrlStorage {
    addEntry: (entry: UrlStorageEntry) => Promise<void>;
    findEntry: (fingerprint: string) => Promise<UrlStorageEntry | undefined>;
    listEntries: () => Promise<UrlStorageEntry[]>;
    removeEntry: (fingerprint: string) => Promise<void>;
}

/**
 * In-memory storage — uploads survive within the same process only.
 * Used as the fallback when no persistent storage is available.
 */
export class MemoryUrlStorage implements UrlStorage {
    readonly #entries = new Map<string, UrlStorageEntry>();

    // eslint-disable-next-line @typescript-eslint/require-await -- UrlStorage interface is async to allow IndexedDB/etc. implementations
    public async addEntry(entry: UrlStorageEntry): Promise<void> {
        this.#entries.set(entry.fingerprint, entry);
    }

    // eslint-disable-next-line @typescript-eslint/require-await -- async to match interface
    public async findEntry(fingerprint: string): Promise<UrlStorageEntry | undefined> {
        return this.#entries.get(fingerprint);
    }

    // eslint-disable-next-line @typescript-eslint/require-await -- async to match interface
    public async listEntries(): Promise<UrlStorageEntry[]> {
        return [...this.#entries.values()];
    }

    // eslint-disable-next-line @typescript-eslint/require-await -- async to match interface
    public async removeEntry(fingerprint: string): Promise<void> {
        this.#entries.delete(fingerprint);
    }
}

const DEFAULT_LOCAL_STORAGE_PREFIX = "visulima-upload::";

interface LocalStorageLike {
    getItem: (key: string) => string | null;
    key: (index: number) => string | null;
    readonly length: number;
    removeItem: (key: string) => void;
    setItem: (key: string, value: string) => void;
}

/**
 * Persists entries to the browser's `localStorage`. One key per fingerprint,
 * prefixed to avoid collisions with the host application.
 */
export class LocalStorageUrlStorage implements UrlStorage {
    readonly #prefix: string;

    readonly #storage: LocalStorageLike;

    public constructor(storage?: LocalStorageLike, prefix: string = DEFAULT_LOCAL_STORAGE_PREFIX) {
        const resolved
            // eslint-disable-next-line n/no-unsupported-features/node-builtins -- guarded access to the browser localStorage global; Node's experimental localStorage is irrelevant here
            = storage ?? (typeof globalThis === "undefined" ? undefined : (globalThis as { localStorage?: LocalStorageLike }).localStorage);

        if (!resolved) {
            throw new Error("LocalStorageUrlStorage: no localStorage-like object available");
        }

        this.#storage = resolved;
        this.#prefix = prefix;
    }

    // eslint-disable-next-line @typescript-eslint/require-await -- async to match interface
    public async addEntry(entry: UrlStorageEntry): Promise<void> {
        this.#storage.setItem(this.#key(entry.fingerprint), JSON.stringify(entry));
    }

    // eslint-disable-next-line @typescript-eslint/require-await -- async to match interface
    public async findEntry(fingerprint: string): Promise<UrlStorageEntry | undefined> {
        const raw = this.#storage.getItem(this.#key(fingerprint));

        if (raw === null) {
            return undefined;
        }

        try {
            return JSON.parse(raw) as UrlStorageEntry;
        } catch {
            // Corrupt entry — drop it so the next upload can write a fresh one.
            this.#storage.removeItem(this.#key(fingerprint));

            return undefined;
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await -- async to match interface
    public async listEntries(): Promise<UrlStorageEntry[]> {
        const out: UrlStorageEntry[] = [];

        for (let index = 0; index < this.#storage.length; index += 1) {
            const key = this.#storage.key(index);

            if (!key?.startsWith(this.#prefix)) {
                continue;
            }

            const raw = this.#storage.getItem(key);

            if (raw === null) {
                continue;
            }

            try {
                out.push(JSON.parse(raw) as UrlStorageEntry);
            } catch {
                // Skip corrupt entries.
            }
        }

        return out;
    }

    // eslint-disable-next-line @typescript-eslint/require-await -- async to match interface
    public async removeEntry(fingerprint: string): Promise<void> {
        this.#storage.removeItem(this.#key(fingerprint));
    }

    #key(fingerprint: string): string {
        return `${this.#prefix}${fingerprint}`;
    }
}

/**
 * Picks the best available storage for the current runtime.
 * Browser → `LocalStorageUrlStorage`. Everywhere else → `MemoryUrlStorage`.
 */
export const defaultUrlStorage = (): UrlStorage => {
    const ls
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- guarded access to the browser localStorage global; Node's experimental localStorage is irrelevant here
        = typeof globalThis === "undefined" ? undefined : (globalThis as { localStorage?: LocalStorageLike }).localStorage;

    if (ls) {
        try {
            return new LocalStorageUrlStorage(ls);
        } catch {
            // Some environments (private mode, no quota) throw on first access — fall through.
        }
    }

    return new MemoryUrlStorage();
};
