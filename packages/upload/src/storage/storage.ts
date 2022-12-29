import { parse } from "bytes";
import Cache from "lru-cache";
import type { IncomingMessage } from "node:http";
import { setInterval } from "node:timers";
import { inspect } from "node:util";
import typeis from "type-is";

import type {
    ErrorResponses, HttpError, Logger, UploadResponse, ValidatorConfig,
} from "../utils";
import {
    ErrorMap, ERRORS, isEqual, Locker, normalizeHookResponse, normalizeOnErrorResponse, throwErrorCode, toMilliseconds, Validator,
} from "../utils";
import MetaStorage from "./meta-storage";
import type { BaseStorageOptions, PurgeList } from "./types";
import type { FileInit, FilePart, FileQuery } from "./utils/file";
import {
    File, FileName, isExpired, updateMetadata,
} from "./utils/file";

const defaults: BaseStorageOptions = {
    allowMIME: ["*/*"],
    maxUploadSize: "5TB",
    filename: ({ id }: File): string => id,
    useRelativeLocation: false,
    onComplete: (file: File) => file,
    onUpdate: (file: File) => file,
    onCreate: () => "",
    onDelete: () => "",
    onError: ({ statusCode, body, headers }: HttpError) => {
        return { statusCode, body: { error: body }, headers };
    },
    validation: {},
    maxMetadataSize: "8MB",
};

abstract class BaseStorage<TFile extends File = File> {
    public onCreate: (file: TFile) => Promise<UploadResponse>;

    public onUpdate: (file: TFile) => Promise<UploadResponse>;

    public onComplete: (file: TFile) => Promise<UploadResponse>;

    public onDelete: (file: TFile) => Promise<UploadResponse>;

    public onError: (error: HttpError) => UploadResponse;

    public maxUploadSize: number;

    public maxMetadataSize: number;

    public isReady = true;

    public checksumTypes: string[] = [];

    public errorResponses = {} as ErrorResponses;

    public cache: Cache<string, TFile>;

    public readonly logger?: Logger;

    protected locker: Locker;

    protected namingFunction: (file: TFile, request: any) => string;

    protected validation = new Validator<TFile>();

    protected abstract meta: MetaStorage<TFile>;

    protected constructor(public config: BaseStorageOptions<TFile>) {
        const options = { ...defaults, ...config } as Required<BaseStorageOptions<TFile>>;

        this.onCreate = normalizeHookResponse(options.onCreate);
        this.onUpdate = normalizeHookResponse(options.onUpdate);
        this.onComplete = normalizeHookResponse(options.onComplete);
        this.onDelete = normalizeHookResponse(options.onDelete);
        this.onError = normalizeOnErrorResponse(options.onError);
        this.namingFunction = options.filename;
        this.maxUploadSize = parse(options.maxUploadSize);
        this.maxMetadataSize = parse(options.maxMetadataSize);

        this.locker = new Locker({
            max: 1000,
            ttl: 30_000,
            ttlAutopurge: true,
        });
        this.cache = new Cache({
            max: 1000,
            maxEntrySize: this.maxMetadataSize,
            ttl: 60 * 5 * 1000,
            ttlAutopurge: true,
        });

        this.logger = options.logger;
        this.logger?.debug(`${this.constructor.name} config: ${inspect({ ...config, logger: this.logger.constructor })}`);

        const purgeInterval = toMilliseconds(options.expiration?.purgeInterval);

        if (purgeInterval) {
            this.startAutoPurge(purgeInterval);
        }

        const size: Required<ValidatorConfig<TFile>> = {
            value: this.maxUploadSize,
            isValid(file) {
                return Number(file.size) <= this.value;
            },
            response: ErrorMap.RequestEntityTooLarge as HttpError,
        };

        const mime: Required<ValidatorConfig<TFile>> = {
            value: options.allowMIME,
            isValid(file) {
                return !!typeis.is(file.contentType, this.value as string[]);
            },
            // @TODO: add better error handling for mime types
            response: ErrorMap.UnsupportedMediaType as HttpError,
        };

        const filename: ValidatorConfig<TFile> = {
            isValid(file) {
                return FileName.isValid(file.name);
            },
            response: ErrorMap.InvalidFileName,
        };

        this.validation.add({ size, mime, filename });
        this.validation.add({ ...options.validation });
    }

    public get tusExtension(): string[] {
        const extensions = ["creation", "creation-with-upload", "termination", "checksum", "creation-defer-length"];

        if (this.config.expiration) {
            extensions.push("expiration");
        }

        return extensions;
    }

    public async validate(file: TFile): Promise<any> {
        return this.validation.verify(file);
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
    normalizeError(_error: Error): HttpError {
        return {
            message: "Generic Upload Error",
            statusCode: 500,
            code: "GenericUploadError",
        };
    }

    /**
     * Saves upload metadata
     */
    public async saveMeta(file: TFile): Promise<TFile> {
        this.updateTimestamps(file);

        const previous = { ...this.cache.get(file.id) };

        this.cache.set(file.id, file, {
            size: Object.keys(file).length,
        });

        return isEqual(previous, file, "bytesWritten", "expiredAt", "hash") ? this.meta.touch(file.id, file) : this.meta.save(file.id, file);
    }

    /**
     * Deletes an upload metadata
     */
    public async deleteMeta(id: string): Promise<void> {
        this.cache.delete(id);

        return this.meta.delete(id);
    }

    /**
     * Retrieves upload metadata
     */
    public async getMeta(id: string): Promise<TFile> {
        let file = this.cache.get(id);

        if (!file) {
            try {
                file = await this.meta.get(id);

                this.cache.set(file.id, file, {
                    size: Object.keys(file).length,
                });
            } catch {
                return throwErrorCode(ERRORS.FILE_NOT_FOUND);
            }
        }

        return { ...file };
    }

    public async checkIfExpired(file: TFile): Promise<TFile> {
        if (isExpired(file)) {
            // eslint-disable-next-line no-void
            void this.delete(file).catch(() => null);
            // eslint-disable-next-line no-void
            void this.deleteMeta(file.id).catch(() => null);

            return throwErrorCode(ERRORS.GONE);
        }

        // eslint-disable-next-line compat/compat
        return file;
    }

    /**
     * Searches for and purges expired upload
     * @param maxAge - remove upload older than a specified age
     * @param prefix - filter upload
     */
    public async purge(maxAge?: number | string): Promise<PurgeList> {
        const maxAgeMs = toMilliseconds(maxAge || this.config.expiration?.maxAge);
        const purged = { items: [], maxAgeMs } as PurgeList;

        if (maxAgeMs) {
            const before = Date.now() - maxAgeMs;
            const list = await this.list();
            const expired = list.filter(
                (item) => Number(new Date((this.config.expiration?.rolling ? item.modifiedAt || item.createdAt : item.createdAt) as string | number)) < before,
            );

            // eslint-disable-next-line no-restricted-syntax
            for await (const { id, ...rest } of expired) {
                const deleted = await this.delete({ id });

                purged.items.push({ ...(deleted as TFile), ...rest });
            }

            if (purged.items.length > 0) {
                this.logger?.info(`Purge: removed ${purged.items.length} uploads`);
            }
        }

        return purged;
    }

    /**
     * Get uploaded file.
     *
     * @param {FileQuery} id
     */
    public async get({ id }: FileQuery): Promise<File> {
        const file = await this.checkIfExpired(await this.meta.get(id));

        return {
            ...file,
            content: await this.getBinary(file),
        };
    }


    /**
     * Retrieves a list of upload.
     */
    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
    public async list(_limit: number = 1000): Promise<TFile[]> {
        throw new Error("Not implemented");
    }

    /**
     * Set user-provided metadata as key-value pairs
     * @experimental
     */
    public async update({ id }: FileQuery, metadata: Partial<File>): Promise<TFile> {
        const file = await this.getMeta(id);

        updateMetadata(file as File, metadata);

        await this.saveMeta(file);

        return { ...file, status: "updated" };
    }

    /**
     * Prevent upload from being accessed by multiple requests
     */
    // eslint-disable-next-line class-methods-use-this
    protected async lock(key: string): Promise<string> {
        try {
            return this.locker.lock(key);
        } catch (error: any) {
            return throwErrorCode(ERRORS.FILE_LOCKED, error.message);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    protected async unlock(key: string): Promise<void> {
        this.locker.unlock(key);
    }

    protected abstract getBinary(file: TFile): Promise<Buffer>;

    protected isUnsupportedChecksum(algorithm = ""): boolean {
        return !!algorithm && !this.checksumTypes.includes(algorithm);
    }

    protected startAutoPurge(purgeInterval: number): void {
        if (purgeInterval >= 2_147_483_647) {
            throw new Error("“purgeInterval” must be less than 2147483647 ms");
        }

        // eslint-disable-next-line no-void
        setInterval(() => void this.purge().catch((error) => this.logger?.error(error)), purgeInterval);
    }

    protected updateTimestamps(file: TFile): TFile {
        // eslint-disable-next-line no-param-reassign
        file.createdAt ??= new Date().toISOString();

        const maxAgeMs = toMilliseconds(this.config.expiration?.maxAge);

        if (maxAgeMs) {
            // eslint-disable-next-line no-param-reassign
            file.expiredAt = this.config.expiration?.rolling
                ? new Date(Date.now() + maxAgeMs).toISOString()
                : new Date(+new Date(file.createdAt) + maxAgeMs).toISOString();
        }

        return file;
    }

    /**
     *  Creates a new upload and saves its metadata
     */
    public abstract create(request: IncomingMessage, file: FileInit): Promise<TFile>;

    /**
     *  Write part and/or return status of an upload
     */
    public abstract write(part: FilePart | FileQuery): Promise<TFile>;

    /**
     * Deletes an upload and its metadata
     */
    public abstract delete(query: FileQuery): Promise<TFile>;

    /**
     * Copy an upload file to a new location.
     *
     * @param {string} name
     * @param {string} destination
     */
    public abstract copy(name: string, destination: string): Promise<any>;

    /**
     * Move an upload file to a new location.
     *
     * @param {string} name
     * @param {string} destination
     */
    public abstract move(name: string, destination: string): Promise<any>;
}

export default BaseStorage;
