import { randomUUID } from "node:crypto";

import type { GaxiosOptions, GaxiosResponse, RetryConfig } from "gaxios";
import { request } from "gaxios";
import { GoogleAuth } from "google-auth-library";

import package_ from "../../../package.json";
import { detectFileTypeFromStream } from "../../utils/detect-file-type";
import { ERRORS, throwErrorCode, UploadError } from "../../utils/errors";
import toMilliseconds from "../../utils/primitives/to-milliseconds";
import type { HttpError } from "../../utils/types";
import LocalMetaStorage from "../local/local-meta-storage";
import type MetaStorage from "../meta-storage";
import BaseStorage from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch } from "../utils/file";
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
    public static override readonly name: string = "gcs";

    public override checksumTypes: string[] = ["md5", "crc32c"];

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

    public async create(config: FileInit): Promise<GCSFile> {
        return this.instrumentOperation("create", async () => {
            // Handle TTL option
            const processedConfig = { ...config };

            if (config.ttl) {
                const ttlMs = typeof config.ttl === "string" ? toMilliseconds(config.ttl) : config.ttl;

                if (ttlMs !== undefined) {
                    processedConfig.expiredAt = Date.now() + ttlMs;
                }
            }

            const file = new GCSFile(processedConfig);

            file.name = this.namingFunction(file);

            await this.validate(file);

            try {
                const existing = await this.getMeta(file.id);

                existing.bytesWritten = await this.internalWrite(existing);

                return existing;
                // eslint-disable-next-line no-empty
            } catch {}

            const headers: Record<string, string> = {
                "Content-Type": "application/json; charset=utf-8",
                "X-Goog-Upload-Command": "start",
                "X-Goog-Upload-Protocol": "resumable",
                "X-Upload-Content-Length": (file.size as number).toString(),
                "X-Upload-Content-Type": file.contentType,
            };

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

            await this.onCreate(file);

            return file;
        });
    }

    public async write(part: FilePart | FileQuery | GCSFile): Promise<GCSFile> {
        return this.instrumentOperation("write", async () => {
            let file: GCSFile;

            if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
                // part is a full file object (not a FilePart)
                file = part as GCSFile;
            } else {
                // part is FilePart or FileQuery
                file = await this.getMeta(part.id);

                await this.checkIfExpired(file);
            }

            if (file.status === "completed") {
                return file;
            }

            if (!partMatch(part, file)) {
                return throwErrorCode(ERRORS.FILE_CONFLICT);
            }

            await this.lock(part.id);

            try {
                // Detect file type from stream if contentType is not set or is default
                // Only detect on first write (when bytesWritten is 0 or NaN)
                if (
                    hasContent(part)
                    && (file.bytesWritten === 0 || Number.isNaN(file.bytesWritten))
                    && (!file.contentType || file.contentType === "application/octet-stream")
                ) {
                    try {
                        const { fileType, stream: detectedStream } = await detectFileTypeFromStream(part.body);

                        // Update contentType if file type was detected
                        if (fileType?.mime) {
                            file.contentType = fileType.mime;
                        }

                        // Use the stream from file type detection
                        part.body = detectedStream;
                    } catch {
                        // If file type detection fails, continue with original stream
                        // This is not a critical error
                    }
                }

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
        });
    }

    /**
     * Deletes an upload and its metadata.
     * @param query File query containing the file ID to delete.
     * @param query.id File ID to delete.
     * @returns Promise resolving to the deleted file object with status: "deleted".
     * @throws {UploadError} If the file metadata cannot be found.
     */
    public async delete({ id }: FileQuery): Promise<GCSFile> {
        return this.instrumentOperation("delete", async () => {
            const file = await this.getMeta(id);

            if (!file.uri) {
                throw new Error(`File ${id} does not have a valid URI`);
            }

            file.status = "deleted";

            await Promise.all([this.makeRequest({ method: "DELETE", url: file.uri, validateStatus }), this.deleteMeta(file.id)]);

            const deletedFile = { ...file };

            await this.onDelete(deletedFile);

            return deletedFile;
        });
    }

    /**
     * Copies an upload file to a new location.
     * @param name Source file name/ID.
     * @param destination Destination file name/ID.
     * @returns Promise resolving to the copied file object.
     * @throws {UploadError} If the source file cannot be found.
     */
    public async copy(name: string, destination: string): Promise<GCSFile> {
        return this.instrumentOperation("copy", async () => {
            interface CopyProgress {
                done: boolean;
                kind: string;
                objectSize: number;
                resource: Record<string, unknown>;
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
                // eslint-disable-next-line no-await-in-loop
                const response = await this.makeRequest<CopyProgress>(requestOptions);

                progress = response.data || ({} as CopyProgress);
            } while (progress.rewriteToken);

            // Return the copied file metadata
            return await this.getMeta(destination);
        });
    }

    /**
     * Moves an upload file to a new location.
     * @param name Source file name/ID.
     * @param destination Destination file name/ID.
     * @returns Promise resolving to the moved file object.
     * @throws {UploadError} If the source file cannot be found.
     */
    public async move(name: string, destination: string): Promise<GCSFile> {
        return this.instrumentOperation("move", async () => {
            const copiedFile = await this.copy(name, destination);
            const url = `${this.storageBaseURI}/${name}`;

            await this.makeRequest({ method: "DELETE" as const, url });

            return copiedFile;
        });
    }

    /**
     * Gets an uploaded file by ID with content buffer.
     * @param query File query object containing the file ID.
     * @param query.id Unique identifier of the file to retrieve.
     * @returns Promise resolving to file object with content buffer.
     * @throws {UploadError} If the file cannot be found (ERRORS.FILE_NOT_FOUND) or has expired (ERRORS.GONE).
     */
    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const { data } = await this.makeRequest<{ timeDeleted?: string; uri?: string }>({ params: { alt: "json" }, url: `${this.storageBaseURI}/${id}` });

            await this.checkIfExpired({ expiredAt: data.timeDeleted } as GCSFile);

            if (!data.uri) {
                throw new Error("File URI not found");
            }

            const response = await this.makeRequest<{ data: unknown }>({ params: { alt: "media" }, url: data.uri });

            const responseData = response.data;
            const bufferData = typeof responseData === "string" ? Buffer.from(responseData, "utf8") : Buffer.from(responseData as ArrayLike<number>);

            return {
                ...data,
                content: bufferData,
            } as FileReturn;
        });
    }

    public override async list(limit = 1000): Promise<GCSFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
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
            },
            { limit },
        );
    }

    protected async internalWrite(part: GCSFile & Partial<FilePart>): Promise<number> {
        const { body, bytesWritten, size, uri = "" } = part;
        const contentRange = buildContentRange(part);
        const options: Record<string, unknown> = { method: "PUT" };

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

    private internalOnComplete = (file: GCSFile): Promise<void> => this.deleteMeta(file.id);

    private async makeRequest<T = unknown>(data: GaxiosOptions): Promise<GaxiosResponse<T>> {
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

    private async accessCheck(): Promise<GaxiosResponse<unknown>> {
        return this.makeRequest({ url: this.storageBaseURI.replace("/o", "") });
    }
}

export default GCStorage;
