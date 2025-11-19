import type { MetaStorageOptions } from "./types";
import type { File } from "./utils/file";

/**
 * Stores upload metadata
 */
class MetaStorage<T extends File = File> {
    public prefix = "";

    public suffix = "";

    protected readonly logger?: Console;

    public constructor(config?: MetaStorageOptions) {
        this.prefix = config?.prefix ?? "";
        this.suffix = config?.suffix ?? ".META";

        this.logger = config?.logger;
    }

    /**
     * Saves upload metadata
     */
    // eslint-disable-next-line class-methods-use-this
    public async save(_id: string, file: T): Promise<T> {
        return file;
    }

    /**
     * Deletes an upload metadata
     */
    // eslint-disable-next-line class-methods-use-this
    public async delete(_id: string): Promise<void> {
        throw new Error("Not implemented");
    }

    /**
     * Retrieves upload metadata
     */
    // eslint-disable-next-line class-methods-use-this
    public async get(_id: string): Promise<T> {
        throw new Error("Not implemented");
    }

    /**
     * Mark upload active
     */
    // eslint-disable-next-line class-methods-use-this
    public async touch(_id: string, _file: T): Promise<T> {
        throw new Error("Not implemented");
    }

    public getMetaName(id: string): string {
        return this.prefix + id + this.suffix;
    }

    public getIdFromMetaName(name: string): string {
        return name.slice(this.prefix.length, -this.suffix.length);
    }
}

export default MetaStorage;
