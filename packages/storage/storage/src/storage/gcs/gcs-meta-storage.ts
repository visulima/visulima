import { randomUUID } from "node:crypto";

import type { GaxiosOptions, GaxiosResponse, RetryConfig } from "gaxios";
import { request } from "gaxios";
import { GoogleAuth } from "google-auth-library";

import package_ from "../../../package.json";
import MetaStorage, { rethrowNotFound, setMetaVersion } from "../meta-storage";
import type { File } from "../utils/file";
import { parseMetadata, stringifyMetadata } from "../utils/file/metadata";
import GCSConfig from "./gcs-config";
import type { ClientError, GCSMetaStorageOptions } from "./types";
import { retryOptions as baseRetryOptions } from "./utils";

/** HTTP status of a gaxios error. */
const errorStatus = (error: unknown): number | undefined => {
    const { code, response, status } = error as { code?: number | string; response?: { status?: number }; status?: number };

    return response?.status ?? status ?? (code === undefined ? undefined : Number(code));
};

class GCSMetaStorage<T extends File = File> extends MetaStorage<T> {
    /** Uses `ifGenerationMatch` preconditions. */
    public override readonly supportsConditionalSave: boolean = true;

    private authClient: GoogleAuth;

    private readonly storageBaseURI: string;

    private readonly uploadBaseURI: string;

    private readonly isCustomEndpoint: boolean = false;

    private readonly retryOptions: RetryConfig = {};

    private readonly useAuthWithCustomEndpoint: boolean;

    private readonly userProject: string | undefined;

    private readonly bucketName: string | undefined;

    public constructor(public readonly config: GCSMetaStorageOptions) {
        super(config);

        const { authClient, ...metaConfig } = config;
        const bucketName = metaConfig.bucket || process.env.GCS_BUCKET;

        if (authClient === undefined) {
            if (!bucketName) {
                throw new Error("GCS bucket is not defined");
            }

            if (!metaConfig.projectId) {
                throw new Error("Sorry, we cannot connect to Cloud Services without a project ID.");
            }

            metaConfig.scopes ||= GCSConfig.authScopes;

            this.authClient = new GoogleAuth(metaConfig);
        } else {
            this.authClient = authClient;
        }

        this.storageBaseURI = `${metaConfig.storageAPI || GCSConfig.storageAPI}/${bucketName}/o`;
        this.uploadBaseURI = `${metaConfig.uploadAPI || GCSConfig.uploadAPI}/${bucketName}/o`;
        const allowedHosts = ["storage.googleapis.com"];
        const storageBaseHost = new URL(this.storageBaseURI).hostname;

        this.isCustomEndpoint = !allowedHosts.includes(storageBaseHost);

        const { retryOptions, useAuthWithCustomEndpoint, userProject } = config;

        this.userProject = userProject;
        this.useAuthWithCustomEndpoint = useAuthWithCustomEndpoint || false;
        this.retryOptions = {
            ...baseRetryOptions,
            ...retryOptions,
        };

        this.bucketName = bucketName;

        if (authClient === undefined) {
            this.accessProbe = async () => {
                try {
                    await this.makeRequest({ url: this.storageBaseURI.replace("/o", "") });
                } catch (error: unknown) {
                    if ((error as ClientError).code === "404") {
                        throw new Error(`Bucket ${String(this.bucketName)} does not exist`, { cause: error });
                    }

                    throw error;
                }
            };
        }
    }

    public override async save(id: string, file: T): Promise<T> {
        await this.upload(id, file);

        return file;
    }

    public override async saveIfVersion(id: string, file: T, version: string): Promise<T | undefined> {
        try {
            await this.upload(id, file, version);
        } catch (error) {
            // 412: the generation no longer matches (or the object is gone).
            if (errorStatus(error) === 412) {
                return undefined;
            }

            throw error;
        }

        return file;
    }

    public override async delete(id: string): Promise<void> {
        await this.ensureAccess();

        const url = this.getMetaPath(id);

        await this.makeRequest({ method: "DELETE", url });
    }

    public override async get(id: string): Promise<T> {
        await this.ensureAccess();

        const url = this.getMetaPath(id);

        const { data, headers } = await this.makeRequest<T>({ params: { alt: "media" }, url }).catch(rethrowNotFound);

        if (data.metadata && typeof data.metadata === "string") {
            data.metadata = parseMetadata(data.metadata);
        }

        setMetaVersion(data, headers?.get("x-goog-generation") ?? undefined);

        return data;
    }

    public override async touch(id: string, file: T): Promise<T> {
        // For GCS, touching means updating the metadata
        return this.save(id, file);
    }

    private async upload(id: string, file: T, ifGenerationMatch?: string): Promise<void> {
        await this.ensureAccess();

        const transformedMetadata = { ...file } as unknown as Omit<T, "metadata"> & { metadata?: string };

        if (transformedMetadata.metadata) {
            transformedMetadata.metadata = stringifyMetadata(file.metadata);
        }

        // TODO: use JSON API multipart POST?
        const { data } = await this.makeRequest<{ generation?: string }>({
            body: JSON.stringify(transformedMetadata),
            headers: { "Content-Type": "application/json; charset=utf-8" },
            method: "POST",
            params: {
                name: this.getMetaName(id),
                uploadType: "media",
                ...(ifGenerationMatch === undefined ? {} : { ifGenerationMatch }),
            },
            url: this.uploadBaseURI,
        });

        setMetaVersion(file, data?.generation === undefined ? undefined : String(data.generation));
    }

    /**
     * Returns metafile URL path for the given upload ID.
     * @param id Upload ID to get metafile path for
     * @returns Full URL path to the metafile in GCS
     */
    private getMetaPath(id: string): string {
        return `${this.storageBaseURI}/${this.getMetaName(id)}`;
    }

    private async makeRequest<Data = unknown>(data: GaxiosOptions): Promise<GaxiosResponse<Data>> {
        if (typeof data.url === "string") {
            data.url = data.url
                // Some URIs have colon separators.
                // Bad: https://.../projects/:list
                // Good: https://.../projects:list
                .replaceAll("/:", ":");
        }

        data = {
            ...data,
            // Merge the caller's headers and params instead of replacing them: replacing dropped the
            // upload's name/uploadType, the get's alt=media and the Content-Type.
            headers: {
                "User-Agent": `${package_.name}/${package_.version}`,
                "x-goog-api-client": `gl-node/${process.versions.node} gccl/${package_.version} gccl-invocation-id/${randomUUID()}`,
                ...data.headers,
            },
            params: {
                ...(this.userProject === undefined ? {} : { userProject: this.userProject }),
                ...(data.params as Record<string, unknown>),
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
}

export default GCSMetaStorage;
