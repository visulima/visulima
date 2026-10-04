import { ERRORS, extractHttpStatus, isUploadError, throwErrorCode } from "../utils/errors";
import type { MetaStorageOptions } from "./meta-storage-options";
import type { File } from "./utils/file";

/**
 * Key of the version token a {@link MetaStorage} attaches to the records it reads (an ETag, a
 * generation, a content hash). A non-enumerable symbol property: never persisted, and invisible to
 * equality checks and serialization, so a copy of a record has to carry it over explicitly.
 */
export const META_VERSION: unique symbol = Symbol("visulima.storage.metaVersion");

/**
 * Returns the version token {@link MetaStorage.get} attached to `file`, if any.
 * @param file A record read from a meta storage, or a copy of one
 * @returns The version token
 */
export const getMetaVersion = (file: object): string | undefined => (file as { [META_VERSION]?: string })[META_VERSION];

/**
 * Attaches a version token to `file`; `undefined` removes it.
 * @param file The record
 * @param version The version token
 */
export const setMetaVersion = (file: object, version: string | undefined): void => {
    if (version === undefined) {
        Reflect.deleteProperty(file, META_VERSION);
    } else {
        Object.defineProperty(file, META_VERSION, { configurable: true, enumerable: false, value: version, writable: true });
    }
};

/**
 * Whether `error` is a {@link MetaStorage.get} reporting that no record exists. Every other error
 * is a failure of the store and must not be read as "absent".
 * @param error The error thrown by the meta storage
 * @returns True for a missing record
 */
export const isMetaNotFound = (error: unknown): boolean => isUploadError(error) && error.UploadErrorCode === ERRORS.FILE_NOT_FOUND;

/**
 * Rethrows an error of a backend read, turning a 404 into the FILE_NOT_FOUND that
 * {@link MetaStorage.get} reports for a missing record.
 * @param error The backend error
 */
export const rethrowNotFound = (error: unknown): never => {
    const { $metadata, code } = error as { $metadata?: { httpStatusCode?: number }; code?: unknown };

    if (($metadata?.httpStatusCode ?? extractHttpStatus(error) ?? Number(code)) === 404) {
        return throwErrorCode(ERRORS.FILE_NOT_FOUND);
    }

    throw error;
};

/**
 * Stores upload metadata.
 */
class MetaStorage<T extends File = File> {
    /**
     * Whether {@link MetaStorage.saveIfVersion} is implemented. Records written by several
     * requests at once (chunked uploads) are then merged safely across processes, not just
     * within one.
     */
    public readonly supportsConditionalSave: boolean = false;

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
     * Saves upload metadata only if the stored record still has `version`, the token
     * {@link MetaStorage.get} attached to it (an atomic compare-and-swap). On success the new
     * version is attached to the returned record.
     * @returns The saved record, or `undefined` when the stored record changed or is gone
     */
    // eslint-disable-next-line class-methods-use-this
    public async saveIfVersion(_id: string, _file: T, _version: string): Promise<T | undefined> {
        throw new Error("Not implemented");
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
     * @throws {UploadError} FILE_NOT_FOUND when no record exists; any other error is a failure of the store
     */
    // eslint-disable-next-line class-methods-use-this
    public async get(_id: string): Promise<T> {
        throw new Error("Not implemented");
    }

    /**
     * Lists the stored upload records.
     * @returns The records, or `undefined` when this store can't enumerate them
     */
    // eslint-disable-next-line class-methods-use-this
    public async list(): Promise<T[] | undefined> {
        return undefined;
    }

    /**
     * Marks upload active.
     */
    // eslint-disable-next-line class-methods-use-this
    public async touch(_id: string, _file: T): Promise<T> {
        throw new Error("Not implemented");
    }

    /**
     * Backend access probe (e.g. a bucket HEAD request). Subclasses set it in their constructor
     * only when they created the backend client themselves; a caller-supplied client is trusted
     * as-is and never probed.
     */
    protected accessProbe?: () => Promise<void>;

    /**
     * Runs {@link MetaStorage.accessProbe} once, lazily, on the first operation instead of from
     * the constructor. A detached probe can only end up as an unhandled rejection; awaiting it
     * here throws the failure to the caller of the operation instead. A failed probe is forgotten
     * so the next operation retries it (e.g. after a transient network error). Returns
     * immediately when no probe is set.
     */
    protected async ensureAccess(): Promise<void> {
        const probe = this.accessProbe;

        if (probe === undefined) {
            return;
        }

        this.accessCheckPromise ??= probe().then(
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
