// eslint-disable-next-line import/no-extraneous-dependencies
import { AbortController } from "abort-controller";
// eslint-disable-next-line import/no-extraneous-dependencies
import { GoogleAuth } from "google-auth-library";
import type { IncomingMessage } from "node:http";
import { resolve } from "node:url";
// eslint-disable-next-line import/no-extraneous-dependencies
import fetch from "node-fetch";

import type { HttpError } from "../../utils";
import { ERRORS, getHeader, throwErrorCode } from "../../utils";
import LocalMetaStorage from "../local/local-meta-storage";
import MetaStorage from "../meta-storage";
import BaseStorage from "../storage";
import type { FileInit, FilePart, FileQuery } from "../utils/file";
import { getFileStatus, partMatch } from "../utils/file";
import FetchError from "./fetch-error";
import GCSConfig from "./gcs-config";
import GCSFile from "./gcs-file";
import GCSMetaStorage from "./gcs-meta-storage";
import type { ClientError, GCStorageOptions } from "./types.d";
import { buildContentRange, getRangeEnd } from "./utils";

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
class GCStorage extends BaseStorage<GCSFile> {
    private readonly bucket: string;

    private authClient: GoogleAuth;

    private readonly storageBaseURI: string;

    private readonly uploadBaseURI: string;

    protected meta: MetaStorage<GCSFile>;

    constructor(public config: GCStorageOptions = {}) {
        super(config);

        if (config.metaStorage) {
            this.meta = config.metaStorage;
        } else {
            const metaConfig = { ...config, ...config.metaStorageConfig, logger: this.logger };
            const localMeta = "directory" in metaConfig;

            if (localMeta) {
                this.logger?.debug("Using local meta storage");
            }

            this.meta = localMeta ? new LocalMetaStorage(metaConfig) : new GCSMetaStorage(metaConfig);
        }

        // eslint-disable-next-line no-param-reassign
        config.keyFile ||= process.env.GCS_KEYFILE;

        const bucketName = config.bucket || process.env.GCS_BUCKET;

        if (!bucketName) {
            throw new Error("GCS bucket is not defined");
        }

        this.bucket = bucketName;
        this.storageBaseURI = [GCSConfig.storageAPI, this.bucket, "o"].join("/");
        this.uploadBaseURI = [GCSConfig.uploadAPI, this.bucket, "o"].join("/");

        // eslint-disable-next-line no-param-reassign
        config.scopes ||= GCSConfig.authScopes;

        this.authClient = new GoogleAuth(config);

        this.accessCheck().catch((error: ClientError) => {
            this.isReady = false;
            this.logger?.error("Unable to open bucket: %O", error);
        });
    }

    public normalizeError(error: ClientError): HttpError {
        const statusCode = +error.code || 500;

        if (error.config) {
            return {
                message: error.message,
                code: `GCS${statusCode}`,
                statusCode,
                name: error.name,
                retryable: statusCode >= 499,
            };
        }
        return super.normalizeError(error);
    }

    private async accessCheck(): Promise<any> {
        return this.authClient.request({ url: `${GCSConfig.storageAPI}/${this.bucket}` });
    }

    public async create(request: IncomingMessage, config: FileInit): Promise<GCSFile> {
        const file = new GCSFile(config);

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

        if (origin) {
            headers.Origin = origin;
        }

        const options = {
            body: JSON.stringify({ metadata: file.metadata }),
            headers,
            method: "POST" as const,
            params: { name: file.name, size: file.size, uploadType: "resumable" },
            url: this.uploadBaseURI,
        };
        const response = await this.authClient.request(options);

        file.uri = response.headers.location as string;

        if (this.config.clientDirectUpload) {
            file.GCSUploadURI = file.uri;

            this.logger?.debug("send uploadURI to client: %s", file.GCSUploadURI);

            file.status = "created";

            return file;
        }

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
            // eslint-disable-next-line no-param-reassign
            file.bytesWritten = await this.internalWrite({ ...file, ...part });
            // eslint-disable-next-line no-param-reassign
            file.status = getFileStatus(file);

            if (file.status === "completed") {
                // eslint-disable-next-line no-param-reassign
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
            // eslint-disable-next-line no-param-reassign
            file.status = "deleted";

            await Promise.all([this.authClient.request({ method: "DELETE", url: file.uri, validateStatus }), this.deleteMeta(file.id)]);

            return { ...file };
        }

        return { id } as GCSFile;
    }

    public async copy(name: string, destination: string): Promise<Record<string, string>> {
        type CopyProgress = {
            rewriteToken?: string;
            kind: string;
            objectSize: number;
            totalBytesRewritten: number;
            done: boolean;
            resource: Record<string, any>;
        };

        const newPath = resolve(`/${this.bucket}/${name}`, encodeURI(destination));
        const [, bucket, ...pathSegments] = newPath.split("/");
        const filename = pathSegments.join("/");
        const url = `${this.storageBaseURI}/${name}/rewriteTo/b/${bucket}/o/${filename}`;

        let progress = {} as CopyProgress;

        const options = {
            body: "",
            headers: { "Content-Type": "application/json" },
            method: "POST" as const,
            url,
        };

        do {
            options.body = progress.rewriteToken ? JSON.stringify({ rewriteToken: progress.rewriteToken }) : "";
            // eslint-disable-next-line no-await-in-loop,unicorn/no-await-expression-member
            progress = (await this.authClient.request<CopyProgress>(options)).data;
        } while (progress.rewriteToken);

        return progress.resource;
    }

    public async move(name: string, destination: string): Promise<Record<string, string>> {
        const resource = await this.copy(name, destination);
        const url = `${this.storageBaseURI}/${name}`;

        await this.authClient.request({ method: "DELETE" as const, url });

        return resource;
    }

    protected async getBinary(file: GCSFile): Promise<Buffer> {
        const response = await this.authClient.request({ responseType: "arraybuffer", url: file.uri });

        return Buffer.from(response.data);
    }

    protected async internalWrite(part: Partial<FilePart> & GCSFile): Promise<number> {
        const { size, uri = "", body } = part;
        const contentRange = buildContentRange(part);
        const options: Record<string, any> = { method: "PUT" };

        if (body?.on) {
            const abortController = new AbortController();

            body.on("aborted", () => abortController.abort());

            options.body = body;
            options.signal = abortController.signal;
        }

        options.headers = { "Content-Range": contentRange, Accept: "application/json" };

        try {
            const response = await fetch(uri, options);

            if (response.status === 308) {
                const range = response.headers.get("range");

                return range ? getRangeEnd(range) : 0;
            }

            if (response.ok) {
                const data = (await response.json()) as Record<string, any>;

                this.logger?.debug("uploaded %O", data);

                return size as number;
            }

            const message = await response.text();

            throw new FetchError(message, `GCS${response.status}`, { uri });
        } catch (error) {
            this.logger?.error(uri, error);

            throw error;
        }
    }

    private internalOnComplete = (file: GCSFile): Promise<any> => this.deleteMeta(file.id);
}

export default GCStorage;
