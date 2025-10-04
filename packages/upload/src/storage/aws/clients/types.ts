import type { S3Client } from "@aws-sdk/client-s3";

export type HelperBaseParams = {
    /**
     * The name of the bucket where the file is stored.
     */
    bucketName: string;

    /**
     * The S3 client.
     */
    client: S3Client;
};

export type CreateCloudflareClientParams = {
    /**
     * Cloudflare R2 access key ID.
     */
    accessKeyId: string;

    /**
     * Cloudflare account ID.
     */
    accountId: string;

    /**
     * The jurisdiction where the data is stored.
     *
     * Only use this if you created your R2 bucket using a jurisdiction.
     */
    jurisdiction?: "eu" | "fedramp";

    /**
     * Cloudflare R2 secret access key.
     */
    secretAccessKey: string;
};

export type CreateMinioClientParams = {
    /**
     * Minio access key ID.
     */
    accessKeyId: string;

    /**
     * Minio endpoint.
     */
    endpoint: string;

    /**
     * Minio region.
     */
    region: string;

    /**
     * Minio secret access key.
     */
    secretAccessKey: string;
};

export type CreateBackblazeClientParams = {
    /**
     * Backblaze B2 application key.
     */
    applicationKey: string;

    /**
     * Backblaze B2 application key ID.
     */
    applicationKeyId: string;

    /**
     * Backblaze B2 region.
     */
    region: string;
};

export type CreateWasabiClientParams = {
    /**
     * Wasabi access key ID.
     */
    accessKeyId: string;

    /**
     * Wasabi region.
     */
    region: string;

    /**
     * Wasabi secret access key.
     */
    secretAccessKey: string;
};

export type CreateDigitalOceanClientParams = {
    /**
     * DigitalOcean Spaces key.
     */
    key: string;

    /**
     * DigitalOcean Spaces region.
     */
    region: string;

    /**
     * DigitalOcean Spaces secret.
     */
    secret: string;
};

export type CreateTigrisClientParams = {
    /**
     * Tigris access key ID.
     */
    accessKeyId: string;

    /**
     * Tigris endpoint.
     * @default `https://t3.storage.dev`
     */
    endpoint?: string;

    /**
     * Tigris secret access key.
     */
    secretAccessKey: string;
};
