import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import type { GaxiosOptions, GaxiosResponse, RetryConfig } from "gaxios";
import { request } from "gaxios";
import { GoogleAuth } from "google-auth-library";

import package_ from "../../../package.json";
import { ERRORS, throwErrorCode } from "../../utils/errors";
import { getHeader } from "../../utils/http";
import toMilliseconds from "../../utils/primitives/to-milliseconds";
import type { HttpError } from "../../utils/types";
import LocalMetaStorage from "../local/local-meta-storage";
import type MetaStorage from "../meta-storage";
import BaseStorage from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, partMatch } from "../utils/file";
import FetchError from "./fetch-error";
import GCSConfig from "./gcs-config";
import GCSFile from "./gcs-file";
import GCSMetaStorage from "./gcs-meta-storage";
import type { ClientError, GCStorageOptions } from "./types";
import { buildContentRange, getRangeEnd, retryOptions as baseRetryOptions } from "./utils";

const validateStatus = (code: number): boolean => (code >= 200 && code < 300) || code === 308 || code === 499;

/**
 * Google cloud storage based backend.
 * @example
 * ```ts
 *  const storage = new GCStorage({
 *    bucket: <YOUR_BUCKET>,
 *    keyFile: <PATH_TO_KEY_FILE>,
 *    metaStorage: new MetaStorage(),
 *    clientDirectUpload: true,
 *    maxUploadSize: '15GB',
 *    allowMIME: ['video/*', 'image/*'],
 *    filename: file => file.originalName
 *  });
 * ```
 */
class GCStorage extends BaseStorage<GCSFile, FileReturn> {
    public static override readonly name = "gcs";

    public override checksumTypes = ["md5", "crc32c"];

    protected meta: MetaStorage<GCSFile>;

    private readonly bucket: string;

    private authClient: GoogleAuth;

    private readonly storageBaseURI: string;

    private readonly uploadBaseURI: string;

    private readonly isCustomEndpoint: boolean = false;

    private readonly retryOptions: RetryConfig = {};

    private readonly useAuthWithCustomEndpoint: boolean;

    private readonly userProject: string | undefined;

    public constructor(config: GCStorageOptions) {
        super(config);

        const bucketName = config.bucket || process.env.GCS_BUCKET;

        if (!bucketName) {
            throw new Error("GCS bucket is not defined");
        }

        if (!config.projectId) {
            throw new Error("Sorry, we cannot connect to Cloud Services without a project ID.");
        }

        this.bucket = bucketName;
        this.storageBaseURI = `${config.storageAPI || GCSConfig.storageAPI}/${this.bucket}/o`;
        this.uploadBaseURI = `${config.uploadAPI || GCSConfig.uploadAPI}/${this.bucket}/o`;
        this.isCustomEndpoint = !this.storageBaseURI.includes("storage.googleapis.com");

        const { retryOptions, useAuthWithCustomEndpoint, userProject } = config;

        this.userProject = userProject;
        this.useAuthWithCustomEndpoint = useAuthWithCustomEndpoint || false;
        this.retryOptions = {
            ...baseRetryOptions,
            ...retryOptions,
        };

        // eslint-disable-next-line no-param-reassign
        config.scopes ||= GCSConfig.authScopes;

        this.authClient = new GoogleAuth(config);

        const { bucket, metaStorage, metaStorageConfig, projectId } = config;

        if (metaStorage) {
            this.meta = metaStorage;
        } else {
            let metaConfig = { ...config, ...metaStorageConfig, logger: this.logger };

            const localMeta = "directory" in metaConfig;

            if (localMeta) {
                this.logger?.debug("Using local meta storage");

                this.meta = new LocalMetaStorage(metaConfig);
            } else {
                if (bucket === metaConfig.bucket && projectId === metaConfig.projectId) {
                    metaConfig = { ...metaConfig, authClient: this.authClient };
                }

                this.meta = new GCSMetaStorage(metaConfig);
            }
        }

        this.isReady = false;
        this.accessCheck()
            .then(() => {
                this.isReady = true;
            })
            .catch((error) => this.logger?.error("Storage access check failed: %O", error));
    }

    public override normalizeError(error: ClientError): HttpError {
        // Check if it's a client error with config
        if (error.config) {
            const statusCode = +error.code || 500;

            return {
                code: `GCS${statusCode}`,
                message: error.message,
                name: error.name,
                retryable: statusCode >= 499,
                statusCode,
            };
        }

        // For non-client errors, return generic upload error
        return {
            code: "GenericUploadError",
            message: `[${this.constructor.name}] ${error.message}`,
            name: error.name,
            statusCode: 500,
        };
    }

    public async create(request: IncomingMessage, config: FileInit): Promise<GCSFile> {
        // Handle TTL option
        const processedConfig = { ...config };

        if (config.ttl) {
            const ttlMs = typeof config.ttl === "string" ? toMilliseconds(config.ttl) : config.ttl;

            if (ttlMs !== null) {
                processedConfig.expiredAt = Date.now() + ttlMs;
            }
        }

        const file = new GCSFile(processedConfig);

        file.name = this.namingFunction(file, request);

        await this.validate(file);

        try {
            const existing = await this.getMeta(file.id);

            existing.bytesWritten = await this.internalWrite(existing);

            return existing;
            // eslint-disable-next-line no-empty
        } catch {}

        const origin = getHeader(request, "origin");
        const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" };

        headers["X-Upload-Content-Length"] = (file.size as number).toString();
        headers["X-Upload-Content-Type"] = file.contentType;
        headers["X-Goog-Upload-Protocol"] = "resumable";
        headers["X-Goog-Upload-Command"] = "start";

        if (origin) {
            headers.Origin = origin;
        }

        const options: GaxiosOptions = {
            body: JSON.stringify({ metadata: file.metadata }),
            headers,
            method: "POST" as const,
            params: { name: file.name, size: file.size, uploadType: "resumable" },
            url: this.uploadBaseURI,
        };
        const response = await this.makeRequest(options);

        if (response.status !== 200) {
            throw new Error("Expected 200 response from GCS");
        }

        const hdr = response.headers.get("X-Goog-Upload-Status") || response.headers.get("x-goog-upload-status");

        if (hdr !== "active") {
            throw new Error(`X-Goog-Upload-Status response header expected 'active' got: ${hdr}`);
        }

        file.uri = response.headers.get("location") as string;

        if (this.config.clientDirectUpload) {
            file.GCSUploadURI = file.uri;

            this.logger?.debug("send uploadURI to client: %s", file.GCSUploadURI);

            file.status = "created";

            return file;
        }

        file.bytesWritten = 0;

        await this.saveMeta(file);

        file.status = "created";

        return file;
    }

    public async write(part: FilePart | FileQuery): Promise<GCSFile> {
        const file = await this.getMeta(part.id);

        await this.checkIfExpired(file);

        if (file.status === "completed") {
            return file;
        }

        if (!partMatch(part, file)) {
            return throwErrorCode(ERRORS.FILE_CONFLICT);
        }

        await this.lock(part.id);

        try {
            file.bytesWritten = await this.internalWrite({ ...file, ...part });

            file.status = getFileStatus(file);

            if (file.status === "completed") {
                file.uri = `${this.storageBaseURI}/${file.name}`;

                await this.internalOnComplete(file);
            }
        } finally {
            await this.unlock(part.id);
        }

        return file;
    }

    public async delete({ id }: FileQuery): Promise<GCSFile> {
        const file = await this.getMeta(id).catch(() => null);

        if (file?.uri) {
            file.status = "deleted";

            await Promise.all([this.makeRequest({ method: "DELETE", url: file.uri, validateStatus }), this.deleteMeta(file.id)]);

            return { ...file };
        }

        return { id } as GCSFile;
    }

    public async copy(name: string, destination: string): Promise<Record<string, string>> {
        interface CopyProgress {
            done: boolean;
            kind: string;
            objectSize: number;
            resource: Record<string, any>;
            rewriteToken?: string;
            totalBytesRewritten: number;
        }

        const baseUrl = new URL(`/${this.bucket}/${name}`, "file://");
        const resolvedUrl = new URL(encodeURI(destination), baseUrl);
        const newPath = resolvedUrl.pathname;
        const [, bucket, ...pathSegments] = newPath.split("/");
        const filename = pathSegments.join("/");
        const url = `${this.storageBaseURI}/${name}/rewriteTo/b/${bucket}/o/${filename}`;

        let progress = {} as CopyProgress;

        const requestOptions = {
            body: "",
            headers: { "Content-Type": "application/json" },
            method: "POST" as const,
            url,
        };

        do {
            requestOptions.body = progress.rewriteToken ? JSON.stringify({ rewriteToken: progress.rewriteToken }) : "";
            // eslint-disable-next-line no-await-in-loop,unicorn/no-await-expression-member
            progress = (await this.makeRequest<CopyProgress>(requestOptions)).data;
        } while (progress.rewriteToken);

        return progress.resource;
    }

    public async move(name: string, destination: string): Promise<Record<string, string>> {
        const resource = await this.copy(name, destination);
        const url = `${this.storageBaseURI}/${name}`;

        await this.makeRequest({ method: "DELETE" as const, url });

        return resource;
    }

    /**
     * Get uploaded file.
     * @param id
     */
    public async get({ id }: FileQuery): Promise<FileReturn> {
        const { data } = await this.makeRequest({ params: { alt: "json" }, url: `${this.storageBaseURI}/${id}` });

        await this.checkIfExpired({ expiredAt: data.timeDeleted } as GCSFile);

        const response = await this.makeRequest({ params: { alt: "media" }, url: data.uri });

        return {
            ...data,
            content: Buffer.from(response.data),
        };
    }

    public override async list(limit = 1000): Promise<GCSFile[]> {
        const items: GCSFile[] = [];

        // Declare truncated as a flag that the while loop is based on.
        let truncated = true;
        let parameters: GaxiosOptions = { params: { maxResults: limit }, url: this.storageBaseURI };

        while (truncated) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const { data } = await this.makeRequest<{
                    items: { metadata?: GCSFile; name: string; timeCreated: string; updated: string }[];
                    nextPageToken?: string;
                }>(parameters);

                (data?.items || []).forEach(({ name, timeCreated, updated }) => {
                    items.push({
                        createdAt: timeCreated,
                        id: name,
                        modifiedAt: updated,
                    } as GCSFile);
                });

                truncated = data?.nextPageToken !== undefined;

                if (truncated) {
                    parameters = { ...parameters, params: { ...parameters.params, pageToken: data.nextPageToken } };
                }
            } catch (error) {
                truncated = false;

                throw error;
            }
        }

        return items;
    }

    protected async internalWrite(part: GCSFile & Partial<FilePart>): Promise<number> {
        const { body, bytesWritten, size, uri = "" } = part;
        const contentRange = buildContentRange(part);
        const options: Record<string, any> = { method: "PUT" };

        if (body?.on) {
            const abortController = new AbortController();

            body.on("aborted", () => abortController.abort());

            options.body = body;
            options.signal = abortController.signal;
        }

        options.headers = {
            Accept: "application/json",
            "Content-Range": contentRange,
            ...size === bytesWritten ? { "X-Goog-Upload-Command": "upload, finalize" } : {},
        };

        try {
            const response = await this.makeRequest({ url: uri, ...options });

            if (response.status === 308) {
                const range = response.headers.get("range");

                return range ? getRangeEnd(range) : 0;
            }

            if (response.status === 200) {
                this.logger?.debug("uploaded %O", response.data);

                return size as number;
            }

            throw new FetchError(response.data, `GCS${response.status}`, { uri });
        } catch (error) {
            this.logger?.error(uri, error);

            throw error;
        }
    }

    private internalOnComplete = (file: GCSFile): Promise<any> => this.deleteMeta(file.id);

    private async makeRequest<T = any>(data: GaxiosOptions): Promise<GaxiosResponse<T>> {
        if (typeof data.url === "string") {
            // eslint-disable-next-line no-param-reassign
            data.url = data.url
                // Some URIs have colon separators.
                // Bad: https://.../projects/:list
                // Good: https://.../projects:list
                .replaceAll("/:", ":");
        }

        // eslint-disable-next-line no-param-reassign
        data = {
            ...data,
            headers: {
                "User-Agent": `${package_.name}/${package_.version}`,
                "x-goog-api-client": `gl-node/${process.versions.node} gccl/${package_.version} gccl-invocation-id/${randomUUID()}`,
            },
            params: {
                ...this.userProject === undefined ? {} : { userProject: this.userProject },
            },
            retry: true,
            retryConfig: this.retryOptions,
            timeout: 60_000,
        };

        if (this.isCustomEndpoint && !this.useAuthWithCustomEndpoint) {
            return request(data);
        }

        return this.authClient.request(data);
    }

    private async accessCheck(): Promise<any> {
        return this.makeRequest({ url: this.storageBaseURI.replace("/o", "") });
    }
}

export default GCStorage;
