import type { Logger } from "../utils";
import type { MetaStorageOptions } from "./types";
import { FileName } from "./utils/file";

/**
 * Stores upload metadata
 */
class MetaStorage<T> {
    protected prefix = "";

    protected suffix = "";

    protected readonly logger?: Logger;

    constructor(config?: MetaStorageOptions) {
        this.prefix = config?.prefix || "";
        this.suffix = config?.suffix || ".META";

        if (this.prefix) {
            FileName.INVALID_PREFIXES.push(this.prefix);
        }

        if (this.suffix) {
            FileName.INVALID_SUFFIXES.push(this.suffix);
        }

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
    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
    public async delete(_id: string): Promise<void> {
        // eslint-disable-next-line radar/no-duplicate-string
        throw new Error("Not implemented");
    }

    /**
     * Retrieves upload metadata
     */
    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
    public async get(_id: string): Promise<T> {
        throw new Error("Not implemented");
    }

    /**
     * Mark upload active
     */
    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
    public async touch(_id: string, _file: T): Promise<T> {
        throw new Error("Not implemented");
    }

    /**
     * Retrieves a list of upload.
     */
    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
    public async list(): Promise<T[]> {
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
