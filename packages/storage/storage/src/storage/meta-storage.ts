import type { MetaStorageOptions } from "./meta-storage-options";
import type { File } from "./utils/file";

/**
 * Stores upload metadata.
 */
class MetaStorage<T extends File = File> {
    public prefix = "";

    public suffix = "";

    protected readonly logger?: Console;

    private accessCheckPromise?: Promise<void>;

    public constructor(config?: MetaStorageOptions) {
        this.prefix = config?.prefix ?? "";
        this.suffix = config?.suffix ?? ".META";

        this.logger = config?.logger;
    }

    /**
     * Saves upload metadata.
     */
    // eslint-disable-next-line class-methods-use-this
    public async save(_id: string, file: T): Promise<T> {
        return file;
    }

    /**
     * Deletes an upload metadata.
     */
    // eslint-disable-next-line class-methods-use-this
    public async delete(_id: string): Promise<void> {
        throw new Error("Not implemented");
    }

    /**
     * Retrieves upload metadata.
     */
    // eslint-disable-next-line class-methods-use-this
    public async get(_id: string): Promise<T> {
        throw new Error("Not implemented");
    }

    /**
     * Marks upload active.
     */
    // eslint-disable-next-line class-methods-use-this
    public async touch(_id: string, _file: T): Promise<T> {
        throw new Error("Not implemented");
    }

    /**
     * Runs a backend access probe once, lazily, on the first operation instead of from the
     * constructor. A detached probe can only end up as an unhandled rejection; awaiting it here
     * throws the failure to the caller of the operation instead. A failed probe is forgotten so
     * the next operation retries it (e.g. after a transient network error).
     * @param check The probe to run, e.g. a bucket HEAD request.
     */
    protected async ensureAccess(check: () => Promise<unknown>): Promise<void> {
        this.accessCheckPromise ??= check().then(
            () => undefined,
            (error: unknown) => {
                this.accessCheckPromise = undefined;

                throw error;
            },
        );

        await this.accessCheckPromise;
    }

    public getMetaName(id: string): string {
        return this.prefix + id + this.suffix;
    }

    public getIdFromMetaName(name: string): string {
        return name.slice(this.prefix.length, -this.suffix.length);
    }
}

export default MetaStorage;
