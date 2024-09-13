// eslint-disable-next-line import/no-extraneous-dependencies
// eslint-disable-next-line import/no-extraneous-dependencies
import type { GaxiosOptions, GaxiosResponse, RetryConfig } from "gaxios";
// eslint-disable-next-line import/no-extraneous-dependencies
import gaxios from "gaxios";
// eslint-disable-next-line import/no-extraneous-dependencies
import { GoogleAuth } from "google-auth-library";
import { randomUUID } from "node:crypto";

import package_ from "../../../package.json";
import MetaStorage from "../meta-storage";
import { File } from "../utils/file";
import GCSConfig from "./gcs-config";
import type { ClientError, GCSMetaStorageOptions } from "./types";
import { retryOptions as baseRetryOptions } from "./utils";

class GCSMetaStorage<T extends File = File> extends MetaStorage<T> {
    private authClient: GoogleAuth;

    private readonly storageBaseURI: string;

    private readonly uploadBaseURI: string;

    private readonly isCustomEndpoint: boolean = false;

    private readonly retryOptions: RetryConfig = {};

    private readonly useAuthWithCustomEndpoint: boolean;

    private readonly userProject: string | undefined;

    constructor(readonly config: GCSMetaStorageOptions) {
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

            // eslint-disable-next-line no-param-reassign
            metaConfig.scopes ||= GCSConfig.authScopes;

            this.authClient = new GoogleAuth(metaConfig);
        } else {
            this.authClient = authClient;
        }

        this.storageBaseURI = `${metaConfig.storageAPI || GCSConfig.storageAPI}/${bucketName}/o`;
        this.uploadBaseURI = `${metaConfig.uploadAPI || GCSConfig.uploadAPI}/${bucketName}/o`;
        this.isCustomEndpoint = !this.storageBaseURI.includes("storage.googleapis.com");

        const { retryOptions, useAuthWithCustomEndpoint, userProject } = config;

        this.userProject = userProject;
        this.useAuthWithCustomEndpoint = useAuthWithCustomEndpoint || false;
        this.retryOptions = {
            ...baseRetryOptions,
            ...retryOptions,
        };

        if (authClient === undefined) {
            this.accessCheck().catch((error: ClientError) => {
                if (error.code === "404") {
                    throw new Error(`Bucket ${bucketName} does not exist`);
                }

                throw error;
            });
        }
    }

    public async save(id: string, file: T): Promise<T> {
        // TODO: use JSON API multipart POST?
        await this.makeRequest({
            body: JSON.stringify(file),
            headers: { "Content-Type": "application/json; charset=utf-8" },
            method: "POST",
            params: { name: encodeURIComponent(this.getMetaName(id)), uploadType: "media" },
            url: this.uploadBaseURI,
        });
        return file;
    }

    public async delete(id: string): Promise<void> {
        const url = this.getMetaPath(id);

        await this.makeRequest({ method: "DELETE", url });
    }

    public async get(id: string): Promise<T> {
        const url = this.getMetaPath(id);
        const { data } = await this.makeRequest<T>({ params: { alt: "media" }, url });

        return data;
    }

    private async accessCheck(): Promise<any> {
        return this.makeRequest({ url: this.storageBaseURI.replace("/o", "") });
    }

    /**
     * Returns metafile url
     * @param id - upload id
     */
    private getMetaPath(id: string): string {
        return `${this.storageBaseURI}/${this.getMetaName(id)}`;
    }

    private async makeRequest<Data = any>(data: GaxiosOptions): Promise<GaxiosResponse<Data>> {
        if (typeof data.url === "string") {
            // eslint-disable-next-line no-param-reassign
            data.url = data.url
                // Some URIs have colon separators.
                // Bad: https://.../projects/:list
                // Good: https://.../projects:list
                .replace(/\/:/g, ":");
        }

        // eslint-disable-next-line no-param-reassign
        data = {
            ...data,
            retry: true,
            retryConfig: this.retryOptions,
            timeout: 60_000,
            headers: {
                "User-Agent": `${package_.name}/${package_.version}`,
                "x-goog-api-client": `gl-node/${process.versions.node} gccl/${package_.version} gccl-invocation-id/${randomUUID()}`,
            },
            params: {
                ...(this.userProject === undefined ? {} : { userProject: this.userProject }),
            },
        };

        if (this.isCustomEndpoint && !this.useAuthWithCustomEndpoint) {
            return gaxios.request(data);
        }

        return this.authClient.request(data);
    }
}

export default GCSMetaStorage;
