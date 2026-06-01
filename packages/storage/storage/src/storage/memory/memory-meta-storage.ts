import MetaStorage from "../meta-storage";
import type { MetaStorageOptions } from "../meta-storage-options";
import type { File } from "../utils/file";

/**
 * Map-backed metadata storage used by {@link MemoryStorage}. Holds a deep-copied
 * snapshot of each `File` so callers can mutate the returned object without leaking
 * back into the backing store.
 */
class MemoryMetaStorage<T extends File = File> extends MetaStorage<T> {
    private readonly store: Map<string, T>;

    public constructor(config?: MetaStorageOptions & { store?: Map<string, T> }) {
        super(config);
        this.store = config?.store ?? new Map<string, T>();
    }

    public override async save(id: string, file: T): Promise<T> {
        this.store.set(id, { ...file });

        return { ...file };
    }

    public override async get(id: string): Promise<T> {
        const file = this.store.get(id);

        if (!file) {
            throw new Error(`Meta not found for id: ${id}`);
        }

        return { ...file };
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
