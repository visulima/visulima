// eslint-disable-next-line import/no-extraneous-dependencies
import { GoogleAuth } from "google-auth-library";

import MetaStorage from "../meta-storage";
import { File } from "../utils/file";
import GCSConfig from "./gcs-config";
import type { GCSMetaStorageOptions } from "./types";

class GCSMetaStorage<T extends File = File> extends MetaStorage<T> {
    authClient: GoogleAuth;

    storageBaseURI: string;

    uploadBaseURI: string;

    constructor(readonly config: GCSMetaStorageOptions) {
        super(config);

        // eslint-disable-next-line no-param-reassign
        config.keyFile ||= process.env.GCS_KEYFILE;

        const bucketName = config.bucket || process.env.GCS_BUCKET;

        if (!bucketName) {
            throw new Error("GCS bucket is not defined");
        }

        this.storageBaseURI = [GCSConfig.storageAPI, bucketName, "o"].join("/");
        this.uploadBaseURI = [GCSConfig.uploadAPI, bucketName, "o"].join("/");

        // eslint-disable-next-line no-param-reassign
        config.scopes ||= GCSConfig.authScopes;

        this.authClient = new GoogleAuth(config);
    }

    /**
     * Returns metafile url
     * @param id - upload id
     */
    private getMetaPath(id: string): string {
        return `${this.storageBaseURI}/${this.getMetaName(id)}`;
    }

    public async save(id: string, file: T): Promise<T> {
        // TODO: use JSON API multipart POST?
        await this.authClient.request({
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

        await this.authClient.request({ method: "DELETE", url });
    }

    public async get(id: string): Promise<T> {
        const url = this.getMetaPath(id);
        const { data } = await this.authClient.request<T>({ params: { alt: "media" }, url });

        return data;
    }

    public async list(): Promise<T[]> {
        const baseURL = this.storageBaseURI;
        const url = "/";
        const options = { baseURL, url, params: { prefix: encodeURIComponent(this.prefix) } };
        const { data } = await this.authClient.request<{
            items: { name: string; timeCreated: string; metadata?: T }[];
        }>(options);

        return data.items
            .filter((item) => item.name.endsWith(this.suffix))
            .map(({ name, timeCreated }) => {
                return {
                    id: this.getIdFromMetaName(name),
                    createdAt: new Date(timeCreated),
                };
            }) as T[];
    }
}

export default GCSMetaStorage;
