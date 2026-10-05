import { ERRORS, throwErrorCode } from "../../utils/errors";
import MetaStorage, { setMetaVersion } from "../meta-storage";
import type { MetaStorageOptions } from "../meta-storage-options";
import type { File } from "../utils/file";

// Every save stores a new object, so its identity is the record's version. Keyed by object, the
// tokens stay right when several MemoryMetaStorage instances share one store map.
const versions = new WeakMap<object, string>();
let nextVersion = 0;

const versionOf = (stored: object): string => {
    let version = versions.get(stored);

    if (version === undefined) {
        nextVersion += 1;
        version = String(nextVersion);
        versions.set(stored, version);
    }

    return version;
};

/**
 * Map-backed metadata storage used by {@link MemoryStorage}. Holds a deep-copied
 * snapshot of each `File` so callers can mutate the returned object without leaking
 * back into the backing store.
 */
class MemoryMetaStorage<T extends File = File> extends MetaStorage<T> {
    public override readonly supportsConditionalSave: boolean = true;

    private readonly store: Map<string, T>;

    public constructor(config?: MetaStorageOptions & { store?: Map<string, T> }) {
        super(config);
        this.store = config?.store ?? new Map<string, T>();
    }

    public override async save(id: string, file: T): Promise<T> {
        const stored = { ...file };

        this.store.set(id, stored);
        setMetaVersion(file, versionOf(stored));

        return { ...file };
    }

    public override async saveIfVersion(id: string, file: T, version: string): Promise<T | undefined> {
        // Compare and save without awaiting in between, so no other save can interleave.
        const stored = this.store.get(id);

        if (stored === undefined || versionOf(stored) !== version) {
            return undefined;
        }

        return this.save(id, file);
    }

    public override async get(id: string): Promise<T> {
        const file = this.store.get(id);

        if (!file) {
            return throwErrorCode(ERRORS.FILE_NOT_FOUND, `Meta not found for id: ${id}`);
        }

        const copy = { ...file };

        setMetaVersion(copy, versionOf(file));

        return copy;
    }

    public override async list(): Promise<T[]> {
        return [...this.store.values()].map((file) => {
            return { ...file };
        });
    }

    public override async delete(id: string): Promise<void> {
        this.store.delete(id);
    }

    public override async touch(id: string, file: T): Promise<T> {
        return this.save(id, file);
    }

    /** Reset the in-memory metadata. Test/reset helper. */
    public clear(): void {
        this.store.clear();
    }
}

export default MemoryMetaStorage;
