// eslint-disable-next-line import/no-extraneous-dependencies
import { GoogleAuth } from "google-auth-library";
// eslint-disable-next-line import/no-extraneous-dependencies
import type { GaxiosOptions, GaxiosResponse, RetryConfig } from "gaxios";
// eslint-disable-next-line import/no-extraneous-dependencies
import gaxios from "gaxios";
import { randomUUID } from "node:crypto"

import MetaStorage from "../meta-storage";
import { File } from "../utils/file";
import GCSConfig from "./gcs-config";
import type { ClientError, GCSMetaStorageOptions } from "./types";
import pkg from "../../../package.json";
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

        if (typeof authClient !== "undefined") {
            this.authClient = authClient;
        } else {
            if (!bucketName) {
                throw new Error("GCS bucket is not defined");
            }

            if (!metaConfig.projectId) {
                throw new Error("Sorry, we cannot connect to Cloud Services without a project ID.");
            }

            // eslint-disable-next-line no-param-reassign
            metaConfig.scopes ||= GCSConfig.authScopes;

            this.authClient = new GoogleAuth(metaConfig);
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

        if (typeof authClient === "undefined") {
            this.accessCheck().catch((err: ClientError) => {
                if (err.code === "404") {
                    throw new Error(`Bucket ${bucketName} does not exist`);
                }

                throw err;
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

    private async makeRequest<T = any>(data: GaxiosOptions): Promise<GaxiosResponse<T>> {
        if (typeof data.url === "string") {
            data.url = data.url
                // Some URIs have colon separators.
                // Bad: https://.../projects/:list
                // Good: https://.../projects:list
                .replace(/\/:/g, ":");
        }

        data = {
            ...data,
            retry: true,
            retryConfig: this.retryOptions,
        };

        if (this.isCustomEndpoint && !this.useAuthWithCustomEndpoint) {
            const requestDefaults: GaxiosOptions = {
                timeout: 60000,
                headers: {
                    "User-Agent": `${pkg.name}/${pkg.version}`,
                    "x-goog-api-client": `gl-node/${process.versions.node} gccl/${pkg.version} gccl-invocation-id/${randomUUID()}`,
                },
                params: {
                    ...(typeof this.userProject !== "undefined" ? { userProject: this.userProject } : {}),
                },
            };
            return gaxios.request({ ...requestDefaults, ...data });
        } else {
            return this.authClient.request({
                params: {
                    ...(typeof this.userProject !== "undefined" ? { userProject: this.userProject } : {}),
                    ...data.params,
                },
                ...data,
            });
        }
    }
}

export default GCSMetaStorage;
